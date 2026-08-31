/**
 * Queue integration tests. These verify BullMQ semantics that a mock would
 * simply assert into existence — chiefly that a deterministic job id makes
 * enqueueing idempotent.
 *
 * Skipped without REDIS_URL; CI provides a redis service container.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeQueue,
  enqueuePanels,
  getPanelQueue,
  panelJobId,
  type PanelJobData,
} from "../../backend/src/jobs/queue";

// Isolate this file's Redis keys: vitest runs test files in parallel and
// they would otherwise consume each other's jobs off the shared queue.
process.env.BULLMQ_PREFIX = "test-queue";

const hasRedis = Boolean(process.env.REDIS_URL);

function panel(jobId: string, panelIndex: number): PanelJobData {
  return {
    jobId,
    userId: "user-1",
    comicId: null,
    draftId: null,
    panelIndex,
    prompt: `panel ${panelIndex}`,
    style: "anime",
  };
}

describe.skipIf(!hasRedis)("panel queue", () => {
  beforeEach(async () => {
    const queue = getPanelQueue();
    if (queue) await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    const queue = getPanelQueue();
    if (queue) await queue.obliterate({ force: true });
    await closeQueue();
  });

  it("enqueues one job per panel", async () => {
    const ledgerJobId = `job-${Date.now()}`;
    const count = await enqueuePanels([0, 1, 2].map((i) => panel(ledgerJobId, i)));

    expect(count).toBe(3);
    expect(await getPanelQueue()!.getWaitingCount()).toBe(3);
  });

  it("uses a deterministic id per panel", async () => {
    const ledgerJobId = `job-${Date.now()}`;
    await enqueuePanels([panel(ledgerJobId, 1)]);

    const job = await getPanelQueue()!.getJob(panelJobId(ledgerJobId, 1));
    expect(job).toBeDefined();
    expect(job!.data.panelIndex).toBe(1);
  });

  it("does not double-enqueue a panel that is already queued", async () => {
    const ledgerJobId = `job-${Date.now()}`;

    await enqueuePanels([panel(ledgerJobId, 0), panel(ledgerJobId, 1)]);
    // A retried submit of the same generation must not re-render live work.
    await enqueuePanels([panel(ledgerJobId, 0), panel(ledgerJobId, 1)]);

    expect(await getPanelQueue()!.getWaitingCount()).toBe(2);
  });

  it("applies retry and backoff defaults", async () => {
    const ledgerJobId = `job-${Date.now()}`;
    await enqueuePanels([panel(ledgerJobId, 0)]);

    const job = await getPanelQueue()!.getJob(panelJobId(ledgerJobId, 0));
    expect(job!.opts.attempts).toBe(3);
    expect(job!.opts.backoff).toMatchObject({ type: "exponential", delay: 5_000 });
  });
});
