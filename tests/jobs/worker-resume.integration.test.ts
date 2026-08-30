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
 * Needs real Redis and real Postgres; skips without them, runs in CI.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../../backend/src/db";
import { generationJobs } from "../../backend/src/db/schema";
import {
  createJob,
  getJob,
  getJobPanels,
  markRunning,
  recordPanelResult,
  finalizeIfComplete,
} from "../../backend/src/jobs/job.service";
import {
  PANEL_QUEUE_NAME,
  closeQueue,
  enqueuePanels,
  getPanelQueue,
  getRedisConnection,
  queuePrefix,
  type PanelJobData,
} from "../../backend/src/jobs/queue";

// Isolate this file's Redis keys: vitest runs test files in parallel and
// they would otherwise consume each other's jobs off the shared queue.
process.env.BULLMQ_PREFIX = "test-resume";

const hasInfra = Boolean(process.env.REDIS_URL && process.env.DATABASE_URL);
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
async function processPanel(job: Job<PanelJobData>) {
  const { jobId, panelIndex } = job.data;
  await markRunning(jobId);
  await recordPanelResult(jobId, panelIndex, {
    status: "succeeded",
    imageUrl: `https://cdn.test/${jobId}-${panelIndex}.png`,
  });
  await finalizeIfComplete(jobId);
}

function startWorker(processor: (job: Job<PanelJobData>) => Promise<void>, concurrency = 1) {
  return new Worker<PanelJobData>(PANEL_QUEUE_NAME, processor, {
    connection: getRedisConnection() as unknown as ConnectionOptions,
    // Must match the queue, or this worker listens on a namespace nothing writes to.
    prefix: queuePrefix(),
    concurrency,
  });
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

describe.skipIf(!hasInfra)("worker restart", () => {
  beforeEach(async () => {
    const queue = getPanelQueue();
    if (queue) await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    const queue = getPanelQueue();
    if (queue) await queue.obliterate({ force: true });
    const db = getDb();
    if (db) await db.delete(generationJobs).where(eq(generationJobs.userId, userId));
    await closeQueue();
    await closeDb();
  });

  it("resumes panels queued before the worker stopped", async () => {
    const total = 8;
    const created = await createJob({ userId, totalPanels: total });
    const ledgerJobId = created!.job.id;

    await enqueuePanels(
      Array.from({ length: total }, (_, i) => panelData(ledgerJobId, i)),
    );

    // First worker renders exactly two panels, then shuts down the way
    // `docker compose stop worker` does. Pausing from inside the processor
    // rather than waiting from outside makes the cutoff deterministic: on a
    // fast runner the whole job set is drained well inside a poll interval.
    const stopAfter = 2;
    let handled = 0;
    let first: Worker<PanelJobData>;

    first = startWorker(async (job) => {
      handled += 1;
      await processPanel(job);
      if (handled >= stopAfter) {
        // pause(true) = do not wait for active jobs. The default waits, and
        // this call is itself inside an active job, so it would deadlock.
        await first.pause(true);
      }
    });

    await waitFor(async () => handled >= stopAfter);
    await first.close();

    const midway = await getJob(ledgerJobId);
    expect(midway!.completedPanels).toBe(stopAfter);
    // The point of the test: work was left behind, not silently dropped.
    expect(midway!.completedPanels).toBeLessThan(total);
    expect(midway!.status).toBe("running");

    // A fresh worker takes over the leftovers.
    const second = startWorker(processPanel);

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
    expect(await getPanelQueue()!.getWaitingCount()).toBe(3);

    const job = await getJob(ledgerJobId);
    expect(job!.status).toBe("queued");
    expect(job!.completedPanels).toBe(0);
  });
});
