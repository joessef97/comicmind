import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import * as jobService from "../../jobs/job.service";
import { enqueuePanels, isQueueEnabled, type PanelJobData } from "../../jobs/queue";
import { isLedgerEnabled } from "../../db";

/** Queued generation needs both halves; without either we fall back to the sync path. */
export function isQueuedGenerationAvailable(): boolean {
  return (
    process.env.GENERATION_MODE === "queue" && isQueueEnabled() && isLedgerEnabled()
  );
}

/**
 * POST /api/jobs/generate
 *
 * Hands panel rendering to the queue and returns immediately. The response is
 * the job id; progress is read back from the ledger, so a client that
 * disconnects here loses nothing.
 */
export async function createGenerationJob(req: AuthRequest, res: Response) {
  if (!isQueuedGenerationAvailable()) {
    return res.status(503).json({
      message: "Queued generation is not enabled on this deployment",
      mode: "sync",
    });
  }

  const { panels, style, comicId, draftId, characterSheet, characterRefUrl } = req.body ?? {};

  if (!Array.isArray(panels) || panels.length === 0) {
    return res.status(400).json({ message: "panels is required" });
  }
  if (typeof style !== "string" || !style.trim()) {
    return res.status(400).json({ message: "style is required" });
  }

  const idempotencyKey = req.header("Idempotency-Key")?.trim() || null;

  try {
    const created = await jobService.createJob({
      userId: req.userId!,
      comicId: typeof comicId === "string" ? comicId : null,
      draftId: typeof draftId === "string" ? draftId : null,
      totalPanels: panels.length,
      idempotencyKey,
    });

    if (!created) {
      return res.status(503).json({ message: "Generation ledger unavailable" });
    }

    // A replayed key returns the original job untouched. Re-enqueuing would
    // re-render panels the first submit already paid for.
    if (created.reused) {
      return res.status(200).json({
        jobId: created.job.id,
        status: created.job.status,
        reused: true,
      });
    }

    const jobs: PanelJobData[] = panels.map((panel: any, index: number) => ({
      jobId: created.job.id,
      userId: req.userId!,
      comicId: typeof comicId === "string" ? comicId : null,
      draftId: typeof draftId === "string" ? draftId : null,
      panelIndex: index,
      prompt: panel.description ?? "",
      style,
      characterSheet: typeof characterSheet === "string" ? characterSheet : undefined,
      characterRefUrl: typeof characterRefUrl === "string" ? characterRefUrl : undefined,
    }));

    const enqueued = await enqueuePanels(jobs);

    if (enqueued === 0) {
      await jobService.failJob(created.job.id, "Could not enqueue panels");
      return res.status(503).json({ message: "Could not enqueue generation" });
    }

    return res.status(202).json({
      jobId: created.job.id,
      status: created.job.status,
      totalPanels: created.job.totalPanels,
      reused: false,
    });
  } catch (err: any) {
    console.error("[jobs] Failed to create generation job:", err);
    return res.status(500).json({ message: "Failed to start generation" });
  }
}

/**
 * GET /api/jobs/active — the caller's unfinished job, if any.
 *
 * This is what makes a reload harmless: the client asks whether work is still
 * in flight and re-attaches instead of starting over.
 */
export async function getActiveGenerationJob(req: AuthRequest, res: Response) {
  const comicId = typeof req.query.comicId === "string" ? req.query.comicId : null;
  const draftId = typeof req.query.draftId === "string" ? req.query.draftId : null;

  const job = await jobService.findActiveJob(req.userId!, { comicId, draftId });
  if (!job) return res.status(200).json({ job: null });

  return res.status(200).json({
    job: {
      id: job.id,
      status: job.status,
      totalPanels: job.totalPanels,
      completedPanels: job.completedPanels,
      comicId: job.comicId,
      draftId: job.draftId,
    },
  });
}

/** GET /api/jobs/:id — current state plus per-panel detail. */
export async function getGenerationJob(req: AuthRequest, res: Response) {
  const jobId = String(req.params.id);
  const job = await jobService.getJob(jobId);

  if (!job) return res.status(404).json({ message: "Job not found" });
  if (job.userId !== req.userId) return res.status(404).json({ message: "Job not found" });

  const panels = await jobService.getJobPanels(job.id);

  return res.status(200).json({
    id: job.id,
    status: job.status,
    totalPanels: job.totalPanels,
    completedPanels: job.completedPanels,
    comicId: job.comicId,
    draftId: job.draftId,
    lastError: job.lastError,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    panels: panels.map((p) => ({
      panelNumber: p.panelNumber,
      status: p.status,
      attempts: p.attempts,
      imageUrl: p.imageUrl,
      error: p.error,
    })),
  });
}
