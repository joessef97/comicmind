/**
 * Queue integration tests. These verify the claim semantics that a mock would
 * simply assert into existence — chiefly that two workers polling at the same
 * instant never come away with the same panel, and that a claim left behind by
 * a dead worker becomes available again.
 *
 * Skipped when no mongod answers.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GenerationJobModel } from "../../backend/src/jobs/job.model";
import { createJob, getJobPanels } from "../../backend/src/jobs/job.service";
import {
  claimNextPanel,
  countWaitingPanels,
  enqueuePanels,
  releasePanel,
  retryDelayMs,
  type PanelJobData,
} from "../../backend/src/jobs/queue";
import { connectTestMongo, disconnectTestMongo, dropTestMongo } from "../helpers/mongo";

const hasDb = await connectTestMongo("comicmind-test-queue");
const userId = `queue-user-${Date.now()}`;

function panel(jobId: string, panelIndex: number): PanelJobData {
  return {
    jobId,
    userId,
    comicId: null,
    draftId: null,
    panelIndex,
    prompt: `panel ${panelIndex}`,
    style: "anime",
  };
}

async function newJob(totalPanels: number): Promise<string> {
  const created = await createJob({ userId, totalPanels });
  return created!.job.id;
}

describe.skipIf(!hasDb)("panel queue", () => {
  beforeAll(async () => {
    await GenerationJobModel.syncIndexes();
  });

  // Claiming is not scoped to a job, so each test starts from an empty queue.
  beforeEach(async () => {
    await GenerationJobModel.deleteMany({});
  });

  afterAll(async () => {
    await dropTestMongo();
    await disconnectTestMongo();
  });

  it("enqueues one unit of work per panel", async () => {
    const jobId = await newJob(3);
    const count = await enqueuePanels([0, 1, 2].map((i) => panel(jobId, i)));

    expect(count).toBe(3);
    expect(await countWaitingPanels(jobId)).toBe(3);
  });

  it("carries the payload the worker needs onto the panel", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([
      { ...panel(jobId, 0), prompt: "a lighthouse at dusk", characterSheet: "sheet" },
    ]);

    const task = await claimNextPanel();
    expect(task!.data.jobId).toBe(jobId);
    expect(task!.data.panelIndex).toBe(0);
    expect(task!.data.prompt).toBe("a lighthouse at dusk");
    expect(task!.data.style).toBe("anime");
    expect(task!.data.characterSheet).toBe("sheet");
  });

  it("does not re-enqueue a panel that is already queued", async () => {
    const jobId = await newJob(2);

    expect(await enqueuePanels([panel(jobId, 0), panel(jobId, 1)])).toBe(2);
    // A retried submit of the same generation must not re-render live work.
    expect(await enqueuePanels([panel(jobId, 0), panel(jobId, 1)])).toBe(0);
    expect(await countWaitingPanels(jobId)).toBe(2);
  });

  it("hands the same panel to only one claimer", async () => {
    const jobId = await newJob(4);
    await enqueuePanels([0, 1, 2, 3].map((i) => panel(jobId, i)));

    // Four claims racing on one document. Mongo serializes them, and each
    // re-evaluates the match, so each gets a different panel.
    const tasks = await Promise.all([
      claimNextPanel(),
      claimNextPanel(),
      claimNextPanel(),
      claimNextPanel(),
    ]);

    const indexes = tasks.map((t) => t!.data.panelIndex).sort();
    expect(indexes).toEqual([0, 1, 2, 3]);
    expect(await countWaitingPanels(jobId)).toBe(0);
  });

  it("leaves nothing to claim once every panel is taken", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([panel(jobId, 0)]);

    expect((await claimNextPanel())!.data.jobId).toBe(jobId);
    expect(await countWaitingPanels(jobId)).toBe(0);
  });

  it("does not claim a panel that was never enqueued", async () => {
    // A ledger job recorded by the synchronous path has panels but no work.
    const jobId = await newJob(2);
    expect(await countWaitingPanels(jobId)).toBe(0);
  });

  it("returns a released panel to the queue and spends an attempt", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([panel(jobId, 0)]);

    const task = await claimNextPanel();
    await releasePanel(task!, 0);

    expect(await countWaitingPanels(jobId)).toBe(1);

    const retried = await claimNextPanel();
    expect(retried!.data.jobId).toBe(jobId);
    expect(retried!.attemptsMade).toBe(1);
  });

  it("holds a released panel back until its backoff elapses", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([panel(jobId, 0)]);

    const task = await claimNextPanel();
    await releasePanel(task!, 60_000);

    // Still owed to the queue, but not yet available.
    expect(await countWaitingPanels(jobId)).toBe(1);
    const panels = await getJobPanels(jobId);
    expect(panels[0].status).toBe("pending");

    expect(await claimNextPanel()).toBeNull();
  });

  it("ignores a release from a worker that already lost the panel", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([panel(jobId, 0)]);

    const stale = await claimNextPanel();
    // Someone else reclaimed it: the token on the panel is no longer ours.
    await GenerationJobModel.updateOne(
      { _id: jobId, "panels.panelNumber": 0 },
      { $set: { "panels.$.claimToken": "someone-else" } },
    );

    await releasePanel(stale!, 0);

    // The current holder's claim stands rather than being reset underneath it.
    const panels = await getJobPanels(jobId);
    expect(panels[0].status).toBe("running");
  });

  it("reclaims a panel from a worker that vanished mid-render", async () => {
    const jobId = await newJob(1);
    await enqueuePanels([panel(jobId, 0)]);

    const lost = await claimNextPanel();
    expect(lost).not.toBeNull();
    // Nothing is left to claim while the claim is fresh.
    expect(await claimNextPanel()).toBeNull();

    // The worker holding it died. Age its claim past the visibility timeout,
    // which is what a crashed process leaves behind.
    await GenerationJobModel.updateOne(
      { _id: jobId, "panels.panelNumber": 0 },
      { $set: { "panels.$.claimedAt": new Date(Date.now() - 60 * 60 * 1_000) } },
    );

    const reclaimed = await claimNextPanel();
    expect(reclaimed!.data.jobId).toBe(jobId);
    expect(reclaimed!.data.panelIndex).toBe(0);
    // A new claim, so the old worker can no longer release it.
    expect(reclaimed!.claimToken).not.toBe(lost!.claimToken);
  });

  it("backs off exponentially between attempts", () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(10_000);
    expect(retryDelayMs(3)).toBe(20_000);
  });
});
