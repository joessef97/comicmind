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
  type PanelJobData,
} from "../../backend/src/jobs/queue";

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
    const created = await createJob({ userId, totalPanels: 4 });
    const ledgerJobId = created!.job.id;

    await enqueuePanels([0, 1, 2, 3].map((i) => panelData(ledgerJobId, i)));

    // First worker: handle two panels, then stop the way `docker compose stop`
    // does — gracefully, leaving the rest queued.
    let handled = 0;
    const first = startWorker(async (job) => {
      if (handled >= 2) {
        // Refuse further work so the remaining panels stay queued for the
        // next worker rather than being drained by this one.
        throw new Error("simulated shutdown");
      }
      handled += 1;
      await processPanel(job);
    });

    await waitFor(async () => handled >= 2);
    await first.close();

    const midway = await getJob(ledgerJobId);
    expect(midway!.completedPanels).toBeGreaterThanOrEqual(2);
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
    expect(job!.completedPanels).toBe(4);

    const panels = await getJobPanels(ledgerJobId);
    expect(panels.every((p) => p.status === "succeeded")).toBe(true);
    // Every panel rendered exactly once across both workers — a restart must
    // not re-render what the first worker already finished.
    expect(panels.every((p) => p.attempts === 1)).toBe(true);
  });

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
