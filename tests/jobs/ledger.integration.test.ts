/**
 * Ledger integration tests — these exercise real Postgres semantics that a
 * mock cannot verify: the partial unique index, transactional counter updates,
 * and cascade deletes.
 *
 * Skipped automatically when DATABASE_URL is unset, so `npm test` still runs
 * offline. CI provides a postgres service container, so they always run there.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../../backend/src/db";
import { generationJobPanels, generationJobs } from "../../backend/src/db/schema";
import {
  createJob,
  finalizeJob,
  getJobPanels,
  markRunning,
  recordPanelResult,
} from "../../backend/src/jobs/job.service";

const hasDb = Boolean(process.env.DATABASE_URL);
const userId = `test-user-${Date.now()}`;

describe.skipIf(!hasDb)("generation ledger", () => {
  beforeAll(async () => {
    const db = getDb();
    if (!db) throw new Error("expected a database connection");
  });

  afterAll(async () => {
    const db = getDb();
    if (db) await db.delete(generationJobs).where(eq(generationJobs.userId, userId));
    await closeDb();
  });

  it("creates a job with one row per panel", async () => {
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

    // The duplicate must not have created a second set of panel rows.
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
  });

  it("counts a panel once even if its result is delivered twice", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;
    await markRunning(jobId);

    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });
    await recordPanelResult(jobId, 0, { status: "succeeded", imageUrl: "https://x/0.png" });

    const db = getDb()!;
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId));
    expect(job.completedPanels).toBe(1);

    // The attempt counter still moves — redelivery is visible in the audit trail.
    const panels = await getJobPanels(jobId);
    expect(panels[0].attempts).toBe(2);
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

  it("only marks a queued job as running", async () => {
    const created = await createJob({ userId, totalPanels: 1 });
    const jobId = created!.job.id;

    expect(await markRunning(jobId)).not.toBeNull();
    // Already running — the second call must not reset startedAt.
    expect(await markRunning(jobId)).toBeNull();
  });

  it("cascades panel rows when a job is deleted", async () => {
    const created = await createJob({ userId, totalPanels: 2 });
    const jobId = created!.job.id;

    const db = getDb()!;
    await db.delete(generationJobs).where(eq(generationJobs.id, jobId));

    const panels = await db
      .select()
      .from(generationJobPanels)
      .where(eq(generationJobPanels.jobId, jobId));
    expect(panels).toHaveLength(0);
  });
});
