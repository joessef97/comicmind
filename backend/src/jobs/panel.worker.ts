/**
 * Panel rendering worker.
 *
 * Deliberately thin: it owns *when* and *how often* a panel is rendered, not
 * how. Image generation and persistence are the same functions the
 * synchronous path uses, so the two paths cannot drift apart.
 */

import crypto from "crypto";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { getImageProvider } from "../services/ai.service";
import {
  isPersistedUrl,
  persistImage,
  persistImageBuffer,
} from "../services/image-storage";
import { storage } from "../services/storage.service";
import * as jobService from "./job.service";
import {
  PANEL_QUEUE_NAME,
  getRedisConnection,
  queuePrefix,
  type PanelJobData,
} from "./queue";

const DEFAULT_CONCURRENCY = 2;

/**
 * Renders one panel and writes the result to Mongo (content) and Postgres
 * (ledger). Throwing propagates to BullMQ, which applies the configured
 * backoff and retries; only the final failed attempt is recorded as failed,
 * so the ledger reflects outcomes rather than every intermediate stumble.
 */
export async function renderPanel(job: Job<PanelJobData>): Promise<{ imageUrl: string }> {
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

/**
 * Starts the worker. Returns null when Redis is unavailable so the caller can
 * carry on without a queue.
 */
export function startPanelWorker(): Worker<PanelJobData> | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  const concurrency =
    Number.parseInt(process.env.PANEL_WORKER_CONCURRENCY || "", 10) || DEFAULT_CONCURRENCY;

  const worker = new Worker<PanelJobData>(PANEL_QUEUE_NAME, renderPanel, {
    connection: connection as unknown as ConnectionOptions,
    prefix: queuePrefix(),
    concurrency,
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log(`[worker] Panel worker started (concurrency ${concurrency})`);
  return worker;
}
