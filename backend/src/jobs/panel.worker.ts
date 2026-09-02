/**
 * Panel rendering worker.
 *
 * Deliberately thin: it owns *when* and *how often* a panel is rendered, not
 * how. Image generation and persistence are the same functions the
 * synchronous path uses, so the two paths cannot drift apart.
 *
 * Where a broker-backed worker is pushed work, this one polls: it claims a
 * panel, renders it, and asks for another. Retry lives here too — the queue
 * has no supervisor of its own, so a panel with attempts left is released
 * back with a backoff, and only the last attempt is recorded as a failure.
 */

import crypto from "crypto";
import { getImageProvider } from "../services/ai.service";
import {
  isPersistedUrl,
  persistImage,
  persistImageBuffer,
} from "../services/image-storage";
import { storage } from "../services/storage.service";
import * as jobService from "./job.service";
import {
  claimNextPanel,
  isQueueEnabled,
  releasePanel,
  retryDelayMs,
  type PanelTask,
} from "./queue";

const DEFAULT_CONCURRENCY = 2;
/** How long to wait after finding nothing before asking again. */
const DEFAULT_POLL_INTERVAL_MS = 500;

/**
 * Renders one panel and writes the result to Mongo: the comic document for
 * content, the job ledger for bookkeeping. Throwing hands the retry decision
 * to the caller; only the final failed attempt is recorded as failed, so the
 * ledger reflects outcomes rather than every intermediate stumble.
 */
export async function renderPanel(job: PanelTask): Promise<{ imageUrl: string }> {
  const { jobId, userId, comicId, panelIndex, prompt, style } = job.data;

  await jobService.markRunning(jobId);

  try {
    const referenceImage = await downloadCharacterReference(job.data.characterRefUrl);

    const provider = getImageProvider();
    const result = await provider.generateImage({
      prompt,
      style,
      panelNumber: panelIndex + 1,
      size: "1024x1024",
      characterSheet: job.data.characterSheet || undefined,
      referenceImage,
    });

    const namespace = comicId || crypto.randomUUID();
    let finalUrl = result.imageUrl;
    let storagePublicId: string | undefined;

    if (result.imageBuffer) {
      const uploaded = await persistImageBuffer(result.imageBuffer, namespace, `panel-${panelIndex}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    } else if (finalUrl && !isPersistedUrl(finalUrl)) {
      const uploaded = await persistImage(finalUrl, namespace, `panel-${panelIndex}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    }

    if (comicId) {
      await writePanelToComic(comicId, userId, panelIndex, {
        imageUrl: finalUrl,
        storagePublicId,
        generationMeta: result.meta,
      });
    }

    await jobService.recordPanelResult(jobId, panelIndex, {
      status: "succeeded",
      imageUrl: finalUrl,
    });
    await jobService.finalizeIfComplete(jobId);

    return { imageUrl: finalUrl };
  } catch (err: any) {
    const message = err?.message || "Panel generation failed";
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      // Retries are exhausted: this panel is genuinely lost. Record it and let
      // the job close as `partial` so the siblings are still delivered.
      await jobService.recordPanelResult(jobId, panelIndex, {
        status: "failed",
        error: message,
      });
      await jobService.finalizeIfComplete(jobId);
      console.error(`[worker] Panel ${panelIndex} of job ${jobId} failed permanently: ${message}`);
    } else {
      console.warn(
        `[worker] Panel ${panelIndex} of job ${jobId} attempt ${job.attemptsMade + 1} failed, retrying: ${message}`,
      );
    }

    throw err;
  }
}

async function downloadCharacterReference(url?: string): Promise<Buffer | undefined> {
  if (!url) return undefined;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[worker] Character reference fetch returned HTTP ${response.status}`);
      return undefined;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    // The reference sheet is a consistency aid, not a requirement.
    console.warn("[worker] Could not download character reference (continuing without):", err);
    return undefined;
  }
}

async function writePanelToComic(
  comicId: string,
  userId: string,
  panelIndex: number,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const comic = await storage.getComic(comicId);
    if (!comic) return;

    const panels = [...(comic.panels || [])];
    if (!panels[panelIndex]) return;

    panels[panelIndex] = { ...panels[panelIndex], ...updates, error: undefined };
    await storage.updateComic(comicId, userId, { panels } as any);
  } catch (err) {
    console.error(`[worker] Failed to write panel ${panelIndex} to comic ${comicId}:`, err);
  }
}

export interface PanelWorker {
  /** Stops claiming and waits for panels already in flight. */
  close(): Promise<void>;
  /** Panels currently being rendered by this worker. */
  activeCount(): number;
}

export interface PanelWorkerOptions {
  concurrency?: number;
  pollIntervalMs?: number;
  /** Injectable so tests can drive the loop without rendering images. */
  processor?: (task: PanelTask) => Promise<unknown>;
}

/**
 * Starts the polling loop. Returns null when the queue is unavailable so the
 * caller can carry on without one.
 */
export function startPanelWorker(options: PanelWorkerOptions = {}): PanelWorker | null {
  if (!isQueueEnabled()) {
    console.log("[worker] No database connection — queued generation disabled");
    return null;
  }

  const concurrency =
    options.concurrency ??
    (Number.parseInt(process.env.PANEL_WORKER_CONCURRENCY || "", 10) || DEFAULT_CONCURRENCY);
  const pollIntervalMs =
    options.pollIntervalMs ??
    (Number.parseInt(process.env.PANEL_WORKER_POLL_MS || "", 10) || DEFAULT_POLL_INTERVAL_MS);
  const processor = options.processor ?? renderPanel;

  let running = true;
  const active = new Set<Promise<void>>();

  const handle = async (task: PanelTask) => {
    try {
      await processor(task);
    } catch {
      // renderPanel has already recorded a permanent failure if this was the
      // last attempt; anything short of that goes back on the queue.
      if (task.attemptsMade + 1 < task.opts.attempts) {
        await releasePanel(task, retryDelayMs(task.attemptsMade + 1)).catch((releaseErr) => {
          console.error("[worker] Could not release panel for retry:", releaseErr);
        });
      }
    }
  };

  const loop = (async () => {
    while (running) {
      if (active.size >= concurrency) {
        await Promise.race(active);
        continue;
      }

      let task: PanelTask | null = null;
      try {
        task = await claimNextPanel();
      } catch (err) {
        console.error("[worker] Claim failed:", err);
      }

      if (!task) {
        await sleep(pollIntervalMs);
        continue;
      }

      const inFlight = handle(task).finally(() => {
        active.delete(inFlight);
      });
      active.add(inFlight);
    }
  })();

  console.log(
    `[worker] Panel worker started (concurrency ${concurrency}, polling every ${pollIntervalMs}ms)`,
  );

  return {
    async close() {
      running = false;
      await loop;
      await Promise.allSettled([...active]);
    },
    activeCount() {
      return active.size;
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
