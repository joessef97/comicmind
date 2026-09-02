/**
 * Worker restart durability.
 *
 * This is the claim the README makes concrete with `docker compose stop
 * worker` / `start worker`, so it deserves a test rather than an assertion of
 * faith: panels queued but not yet rendered must survive the worker going
 * away, and a fresh worker must pick them up and drive the ledger to a
 * terminal state.
 *
 * The processor here is a stand-in for renderPanel — it performs the same
 * ledger writes without calling OpenAI, since what is under test is queue and
 * ledger durability across a restart, not image generation. renderPanel's own
 * retry semantics are covered in worker.test.ts.
 *
 * Needs a reachable Mongo; skips without one, runs in CI.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GenerationJobModel } from "../../backend/src/jobs/job.model";
import {
  createJob,
  finalizeIfComplete,
  getJob,
  getJobPanels,
  markRunning,
  recordPanelResult,
} from "../../backend/src/jobs/job.service";
import { startPanelWorker } from "../../backend/src/jobs/panel.worker";
import {
  claimNextPanel,
  countWaitingPanels,
  enqueuePanels,
  type PanelJobData,
  type PanelTask,
} from "../../backend/src/jobs/queue";
import { connectTestMongo, disconnectTestMongo, dropTestMongo } from "../helpers/mongo";

const hasInfra = await connectTestMongo("comicmind-test-resume");
const userId = `resume-user-${Date.now()}`;

function panelData(jobId: string, panelIndex: number): PanelJobData {
  return {
    jobId,
    userId,
    comicId: null,
    draftId: null,
    panelIndex,
    prompt: `panel ${panelIndex}`,
    style: "noir",
  };
}

/** Mirrors renderPanel's ledger writes without the image call. */
async function processPanel(task: PanelTask) {
  const { jobId, panelIndex } = task.data;
  await markRunning(jobId);
  await recordPanelResult(jobId, panelIndex, {
    status: "succeeded",
    imageUrl: `https://cdn.test/${jobId}-${panelIndex}.png`,
  });
  await finalizeIfComplete(jobId);
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

describe.skipIf(!hasInfra)("worker restart", () => {
  beforeAll(async () => {
    await GenerationJobModel.syncIndexes();
  });

  beforeEach(async () => {
    await GenerationJobModel.deleteMany({});
  });

  afterAll(async () => {
    await dropTestMongo();
    await disconnectTestMongo();
  });

  it("resumes panels queued before the worker stopped", async () => {
    const total = 8;
    const created = await createJob({ userId, totalPanels: total });
    const ledgerJobId = created!.job.id;

    await enqueuePanels(Array.from({ length: total }, (_, i) => panelData(ledgerJobId, i)));

    // The first worker renders exactly two panels and then stops, the way
    // `docker compose stop worker` cuts it off. Claiming by hand rather than
    // racing a real loop against a timer keeps the cutoff exact: on a fast
    // runner a polling worker drains the whole set inside one interval.
    const stopAfter = 2;
    for (let i = 0; i < stopAfter; i++) {
      const task = await claimNextPanel();
      expect(task).not.toBeNull();
      await processPanel(task!);
    }

    const midway = await getJob(ledgerJobId);
    expect(midway!.completedPanels).toBe(stopAfter);
    // The point of the test: work was left behind, not silently dropped.
    expect(midway!.completedPanels).toBeLessThan(total);
    expect(midway!.status).toBe("running");
    expect(await countWaitingPanels(ledgerJobId)).toBe(total - stopAfter);

    // A fresh worker takes over the leftovers.
    const second = startPanelWorker({ processor: processPanel, pollIntervalMs: 20 })!;

    const finished = await waitFor(async () => {
      const job = await getJob(ledgerJobId);
      return job?.status === "succeeded";
    });

    await second.close();

    expect(finished).toBe(true);

    const job = await getJob(ledgerJobId);
    expect(job!.completedPanels).toBe(total);

    const panels = await getJobPanels(ledgerJobId);
    expect(panels.every((p) => p.status === "succeeded")).toBe(true);
    // Every panel rendered exactly once across both workers — a restart must
    // not re-render what the first worker already finished.
    expect(panels.every((p) => p.attempts === 1)).toBe(true);
  }, 30_000);

  it("keeps queued work when no worker is running at all", async () => {
    const created = await createJob({ userId, totalPanels: 3 });
    const ledgerJobId = created!.job.id;

    await enqueuePanels([0, 1, 2].map((i) => panelData(ledgerJobId, i)));

    // Nothing consumes the queue: the work waits rather than evaporating.
    expect(await countWaitingPanels(ledgerJobId)).toBe(3);

    const job = await getJob(ledgerJobId);
    expect(job!.status).toBe("queued");
    expect(job!.completedPanels).toBe(0);
  });

  it("picks up work enqueued after the worker was already running", async () => {
    const worker = startPanelWorker({ processor: processPanel, pollIntervalMs: 20 })!;

    const created = await createJob({ userId, totalPanels: 3 });
    const ledgerJobId = created!.job.id;
    await enqueuePanels([0, 1, 2].map((i) => panelData(ledgerJobId, i)));

    const finished = await waitFor(async () => {
      const job = await getJob(ledgerJobId);
      return job?.status === "succeeded";
    });

    await worker.close();
    expect(finished).toBe(true);
  }, 30_000);

  it("does not render a panel twice when two workers run at once", async () => {
    const total = 10;
    const created = await createJob({ userId, totalPanels: total });
    const ledgerJobId = created!.job.id;
    await enqueuePanels(Array.from({ length: total }, (_, i) => panelData(ledgerJobId, i)));

    // The topology a scaled deployment actually has: more than one consumer.
    const a = startPanelWorker({ processor: processPanel, pollIntervalMs: 10 })!;
    const b = startPanelWorker({ processor: processPanel, pollIntervalMs: 10 })!;

    const finished = await waitFor(async () => {
      const job = await getJob(ledgerJobId);
      return job?.status === "succeeded";
    });

    await Promise.all([a.close(), b.close()]);

    expect(finished).toBe(true);
    const panels = await getJobPanels(ledgerJobId);
    expect(panels.every((p) => p.attempts === 1)).toBe(true);
  }, 30_000);
});
