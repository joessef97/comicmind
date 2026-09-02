/**
 * Ledger integration tests — these exercise real MongoDB semantics that a
 * mock cannot verify: the partial unique index behind the idempotency
 * guarantee, and the single-document update that keeps `completedPanels` in
 * step with the panels it counts.
 *
 * Skipped automatically when no mongod answers, so `npm test` still runs
 * offline. CI provides a mongo service container, so they always run there.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenerationJobModel } from "../../backend/src/jobs/job.model";
import { connectTestMongo, disconnectTestMongo, dropTestMongo } from "../helpers/mongo";
import {
  createJob,
  finalizeJob,
  getJob,
  getJobPanels,
  markRunning,
  recordPanelResult,
} from "../../backend/src/jobs/job.service";

const hasDb = await connectTestMongo("comicmind-test-ledger");
const userId = `test-user-${Date.now()}`;

describe.skipIf(!hasDb)("generation ledger", () => {
  beforeAll(async () => {
    // The idempotency guarantee is an index, so it has to exist before the
    // race test can prove anything.
    await GenerationJobModel.syncIndexes();
  });

  afterAll(async () => {
    await dropTestMongo();
    await disconnectTestMongo();
  });

  it("creates a job with one entry per panel", async () => {
    const created = await createJob({ userId, totalPanels: 4 });
    expect(created).not.toBeNull();
    expect(created!.reused).toBe(false);
    expect(created!.job.status).toBe("queued");
    expect(created!.job.completedPanels).toBe(0);

    const panels = await getJobPanels(created!.job.id);
    expect(panels).toHaveLength(4);
    expect(panels.map((p) => p.panelNumber)).toEqual([0, 1, 2, 3]);
    expect(panels.every((p) => p.status === "pending")).toBe(true);
  });

  it("returns the existing job when an idempotency key is reused", async () => {
    const key = `idem-${Date.now()}`;

    const first = await createJob({ userId, totalPanels: 3, idempotencyKey: key });
    const second = await createJob({ userId, totalPanels: 3, idempotencyKey: key });

    expect(first!.reused).toBe(false);
    expect(second!.reused).toBe(true);
    expect(second!.job.id).toBe(first!.job.id);

    // The duplicate must not have created a second set of panels.
    const panels = await getJobPanels(first!.job.id);
    expect(panels).toHaveLength(3);
  });

  it("survives concurrent submits with the same key", async () => {
    const key = `race-${Date.now()}`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createJob({ userId, totalPanels: 2, idempotencyKey: key }),
      ),
    );

    const ids = new Set(results.map((r) => r!.job.id));
    expect(ids.size).toBe(1);
    expect(await GenerationJobModel.countDocuments({ userId, idempotencyKey: key })).toBe(1);
  });

  it("lets many jobs exist without a key", async () => {
    // The unique index is partial; without that, the second of these would
    // collide with the first on (userId, null).
    const a = await createJob({ userId, totalPanels: 1 });
    const b = await createJob({ userId, totalPanels: 1 });
    expect(a!.job.id).not.toBe(b!.job.id);
  });

  it("counts a panel once even if its result is delivered twice", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });
    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });

    const job = await getJob(jobId);
    expect(job!.completedPanels).toBe(1);

    // The attempt counter still moves — redelivery is visible in the audit trail.
    const panels = await getJobPanels(jobId);
    expect(panels[0].attempts).toBe(2);
  });

  it("counts each panel once under concurrent delivery", async () => {
    const created = await createJob({ userId, totalPanels: 4 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    // Four workers landing at the same instant: the counter is advanced by the
    // same write that claims the panel, so none of them can double-count.
    await Promise.all(
      [0, 1, 2, 3].map((n) =>
        recordPanelResult(jobId, n, { status: "succeeded", imageUrl: `https://x/${n}.png` }),
      ),
    );

    const job = await getJob(jobId);
    expect(job!.completedPanels).toBe(4);
  });

  it("ends partial when some panels fail and some succeed", async () => {
    const created = await createJob({ userId, totalPanels: 3 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });
    await recordPanelResult(jobId, 1, { status: "failed", error: "content policy" });
    await recordPanelResult(jobId, 2, { status: "succeeded", imageUrl: "https://x/2.png" });

    const job = await finalizeJob(jobId);
    expect(job!.status).toBe("partial");
    expect(job!.completedPanels).toBe(2);
    expect(job!.finishedAt).not.toBeNull();
  });

  it("ends succeeded only when every panel succeeded", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });
    await recordPanelResult(jobId, 1, { status: "succeeded", imageUrl: "https://x/1.png" });

    const job = await finalizeJob(jobId);
    expect(job!.status).toBe("succeeded");
  });

  it("ends failed when no panel succeeded", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    await recordPanelResult(jobId, 0, { status: "failed", error: "timeout" });
    await recordPanelResult(jobId, 1, { status: "failed", error: "timeout" });

    const job = await finalizeJob(jobId);
    expect(job!.status).toBe("failed");
  });

  it("does not re-finalize a terminal job", async () => {
    const created = await createJob({ userId, totalPanels: 1 });
    const jobId = created!.job.id;
    await markRunning(jobId);
    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });

    const first = await finalizeJob(jobId);
    const second = await finalizeJob(jobId);

    expect(first!.status).toBe("succeeded");
    expect(second!.finishedAt?.getTime()).toBe(first!.finishedAt?.getTime());
  });

  it("settles on one outcome when finalized concurrently", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;
    await markRunning(jobId);
    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });
    await recordPanelResult(jobId, 1, { status: "succeeded", imageUrl: "https://x/1.png" });

    // The compare-and-swap on status means the loser reports the winner's
    // result rather than writing a second finishedAt.
    const [a, b] = await Promise.all([finalizeJob(jobId), finalizeJob(jobId)]);
    expect(a!.status).toBe("succeeded");
    expect(b!.status).toBe("succeeded");
    expect(a!.finishedAt?.getTime()).toBe(b!.finishedAt?.getTime());
  });

  it("only marks a queued job as running", async () => {
    const created = await createJob({ userId, totalPanels: 1 });
    const jobId = created!.job.id;

    expect(await markRunning(jobId)).not.toBeNull();
    // Already running — the second call must not reset startedAt.
    expect(await markRunning(jobId)).toBeNull();
  });

  it("removes a job's panels with the job", async () => {
    // Panels are embedded, so there are no orphans to clean up separately.
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;

    await GenerationJobModel.deleteOne({ _id: jobId });

    expect(await getJob(jobId)).toBeNull();
    expect(await getJobPanels(jobId)).toEqual([]);
  });
});
