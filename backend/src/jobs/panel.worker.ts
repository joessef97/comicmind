/** MongoDB-backed worker for independent comic panel generation. */

import crypto from "crypto";
import { getImageProvider } from "../services/ai.service";
import {
  isPersistedUrl,
  persistImage,
  persistImageBuffer,
} from "../services/image-storage";
import { storage } from "../services/storage.service";
import * as jobService from "./job.service";
import type { ClaimedPanel } from "./job.service";

const DEFAULT_CONCURRENCY = 2;
const POLL_INTERVAL_MS = 500;

export interface PanelWorkerHandle {
  close(): Promise<void>;
}

/** Generate one claimed panel and persist its result in MongoDB. */
export async function renderPanel(panel: ClaimedPanel): Promise<void> {
  const { jobId, userId, comicId, draftId, panelNumber, prompt, style, leaseToken } = panel;
  const heartbeat = setInterval(() => {
    void jobService.extendPanelLease(jobId, panelNumber, leaseToken).catch((err) => {
      console.error(`[worker] Could not extend lease for ${jobId}/${panelNumber}:`, err);
    });
  }, 60_000);
  heartbeat.unref?.();

  try {
    const referenceImage = await downloadCharacterReference(panel.characterRefUrl);
    const provider = getImageProvider();
    const result = await provider.generateImage({
      prompt,
      style,
      panelNumber: panelNumber + 1,
      size: "1024x1024",
      characterSheet: panel.characterSheet || undefined,
      referenceImage,
    });

    const namespace = comicId || crypto.randomUUID();
    let finalUrl = result.imageUrl;
    let storagePublicId: string | undefined;

    if (result.imageBuffer) {
      const uploaded = await persistImageBuffer(result.imageBuffer, namespace, `panel-${panelNumber}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    } else if (finalUrl && !isPersistedUrl(finalUrl)) {
      const uploaded = await persistImage(finalUrl, namespace, `panel-${panelNumber}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    }

    if (comicId) {
      await writePanelToComic(comicId, userId, panelNumber, {
        imageUrl: finalUrl,
        storagePublicId,
        generationMeta: result.meta,
      });
    }

    if (draftId) {
      await writePanelToDraft(draftId, userId, panelNumber, {
        imageUrl: finalUrl,
        storagePublicId,
        generationMeta: result.meta,
      });
    }

    await jobService.recordPanelResult(
      jobId,
      panelNumber,
      { status: "succeeded", imageUrl: finalUrl, attempts: panel.attempts },
      leaseToken,
    );
    await syncTerminalDraftStatus(draftId, userId, await jobService.finalizeIfComplete(jobId));
  } catch (err: any) {
    const message = err?.message || "Panel generation failed";
    if (panel.attempts >= panel.maxAttempts) {
      await jobService.recordPanelResult(
        jobId,
        panelNumber,
        { status: "failed", error: message, attempts: panel.attempts },
        leaseToken,
      );
      await syncTerminalDraftStatus(draftId, userId, await jobService.finalizeIfComplete(jobId));
      console.error(`[worker] Panel ${panelNumber} of job ${jobId} failed permanently: ${message}`);
      return;
    }

    const baseDelay = Number.parseInt(process.env.PANEL_RETRY_DELAY_MS || "", 10) || 5_000;
    const retryDelay = baseDelay * 2 ** Math.max(0, panel.attempts - 1);
    await jobService.releasePanelForRetry(
      jobId,
      panelNumber,
      leaseToken,
      message,
      new Date(Date.now() + retryDelay),
    );
    console.warn(
      `[worker] Panel ${panelNumber} of job ${jobId} attempt ${panel.attempts} failed; retrying in ${retryDelay}ms: ${message}`,
    );
  } finally {
    clearInterval(heartbeat);
  }
}

async function writePanelToDraft(
  draftId: string,
  userId: string,
  panelIndex: number,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    await storage.updateDraftPanel(draftId, userId, panelIndex, { ...updates, error: undefined });
  } catch (err) {
    console.error(`[worker] Failed to write panel ${panelIndex} to draft ${draftId}:`, err);
  }
}

async function syncTerminalDraftStatus(
  draftId: string | null | undefined,
  userId: string,
  job: Awaited<ReturnType<typeof jobService.finalizeIfComplete>>,
): Promise<void> {
  if (!draftId || !job || !jobService.isTerminal(job.status)) return;

  await storage.updateDraft(draftId, userId, {
    status: job.status === "failed" ? "FAILED" : "COMPLETED",
  } as any);
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
 * Starts polling MongoDB for ready panels. Atomic panel claims and expiring
 * leases let another worker recover work after a process exits unexpectedly.
 */
export function startPanelWorker(): PanelWorkerHandle {
  let running = true;
  const concurrency = Number.parseInt(process.env.PANEL_WORKER_CONCURRENCY || "", 10) || DEFAULT_CONCURRENCY;

  const loop = async (index: number) => {
    while (running) {
      try {
        if (index === 0) await jobService.failExpiredPanels();
        const panel = await jobService.claimNextPanel();
        if (panel) {
          await renderPanel(panel);
          continue;
        }
      } catch (err) {
        console.error("[worker] MongoDB panel polling failed:", err);
        await delay(2_000);
        continue;
      }
      await delay(POLL_INTERVAL_MS);
    }
  };

  const loops = Array.from({ length: Math.max(1, concurrency) }, (_, index) => loop(index));
  console.log(`[worker] MongoDB panel worker started (concurrency ${Math.max(1, concurrency)})`);

  return {
    async close() {
      running = false;
      await Promise.all(loops);
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
