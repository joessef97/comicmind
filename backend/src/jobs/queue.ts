/**
 * BullMQ wiring for panel generation.
 *
 * One queue job per *panel*, not per comic. Panels are independent units of
 * work that already fail independently (see generateAllPanelImages in
 * ai.service.ts), so making each one its own job means a panel that exhausts
 * its retries costs exactly one panel — the siblings still land, and the
 * parent job closes as `partial` rather than being lost entirely.
 *
 * Like the ledger, the queue is optional: without REDIS_URL there is no
 * connection and the caller falls back to the synchronous path.
 */

import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const PANEL_QUEUE_NAME = "comic-panel-generation";

export interface PanelJobData {
  /** generation_jobs.id — the ledger row this panel belongs to. */
  jobId: string;
  userId: string;
  comicId: string | null;
  draftId: string | null;
  panelIndex: number;
  prompt: string;
  style: string;
  characterSheet?: string;
  characterRefUrl?: string;
}

let connection: IORedis | null = null;
let queue: Queue<PanelJobData> | null = null;
let warned = false;

export function isQueueEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Shared Redis connection. BullMQ requires maxRetriesPerRequest to be null on
 * connections it uses for blocking commands, which is how workers wait for
 * work without polling.
 */
export function getRedisConnection(): IORedis | null {
  if (!isQueueEnabled()) {
    if (!warned) {
      warned = true;
      console.log("[queue] REDIS_URL not set — queued generation disabled");
    }
    return null;
  }

  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on("error", (err) => {
      console.error("[queue] Redis connection error:", err.message);
    });
  }

  return connection;
}

export function getPanelQueue(): Queue<PanelJobData> | null {
  const conn = getRedisConnection();
  if (!conn) return null;

  if (!queue) {
    queue = new Queue<PanelJobData>(PANEL_QUEUE_NAME, {
      connection: conn as unknown as ConnectionOptions,
      defaultJobOptions: defaultPanelJobOptions(),
    });
    console.log("[queue] Panel generation queue ready");
  }

  return queue;
}

export function defaultPanelJobOptions(): JobsOptions {
  return {
    attempts: Number.parseInt(process.env.PANEL_JOB_ATTEMPTS || "", 10) || 3,
    // Image generation fails mostly on rate limits and transient upstream
    // errors, both of which want space rather than an immediate retry.
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { age: 3_600, count: 1_000 },
    // Keep failures around longer than successes — they are the ones worth
    // inspecting after the fact.
    removeOnFail: { age: 24 * 3_600 },
  };
}

/**
 * Deterministic job id per panel. BullMQ refuses to enqueue a duplicate id
 * while the job still exists, so a retried submit of the same generation
 * cannot double-render a panel that is already queued or running.
 *
 * `:` is reserved by BullMQ's own Redis key namespacing and is rejected in
 * custom ids, hence the dashed form.
 */
export function panelJobId(ledgerJobId: string, panelIndex: number): string {
  return `${ledgerJobId}-panel-${panelIndex}`;
}

export async function enqueuePanels(panels: PanelJobData[]): Promise<number> {
  const q = getPanelQueue();
  if (!q) return 0;

  const added = await q.addBulk(
    panels.map((data) => ({
      name: "render-panel",
      data,
      opts: { jobId: panelJobId(data.jobId, data.panelIndex) },
    })),
  );

  return added.length;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
