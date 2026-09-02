/**
 * Panel generation queue, on MongoDB.
 *
 * One unit of work per *panel*, not per comic. Panels are independent units
 * that already fail independently (see generateAllPanelImages in
 * ai.service.ts), so a panel that exhausts its retries costs exactly one
 * panel — the siblings still land, and the parent job closes as `partial`
 * rather than being lost entirely.
 *
 * There is no separate queue store: the work lives on the panel it describes,
 * inside the ledger document. That is what makes claiming safe without a
 * broker. `claimNextPanel` finds a job holding claimable work and marks one
 * panel taken in the *same* update, and single-document writes are atomic in
 * MongoDB — so two workers polling at the same instant cannot come away with
 * the same panel.
 *
 * A worker that dies mid-panel is covered by a visibility timeout rather than
 * a heartbeat: a claim older than VISIBILITY_TIMEOUT_MS is up for grabs again.
 * That is the one place this design trades latency for simplicity — a crashed
 * worker's panel waits out the timeout before anyone retries it.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import { GenerationJobModel, isLedgerEnabled } from "./job.model";

export interface PanelJobData {
  /** GenerationJob _id — the ledger document this panel belongs to. */
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

/**
 * A claimed panel, shaped so the renderer can ask "is this my last chance?"
 * without knowing how claiming works.
 */
export interface PanelTask {
  data: PanelJobData;
  /** Attempts already spent on this panel; 0 the first time it is claimed. */
  attemptsMade: number;
  opts: { attempts: number };
  claimToken: string;
}

/**
 * How long a claim is honoured before another worker may take the panel.
 * Comfortably longer than a slow render, since reclaiming a panel that is
 * still being worked on costs a duplicate image generation.
 */
export const VISIBILITY_TIMEOUT_MS =
  Number.parseInt(process.env.PANEL_VISIBILITY_TIMEOUT_MS || "", 10) || 5 * 60 * 1_000;

/**
 * The queue is the ledger, so it is available exactly when Mongo is. There is
 * no second service to configure.
 */
export function isQueueEnabled(): boolean {
  return isLedgerEnabled();
}

export function panelRetryPolicy(): { attempts: number; backoffMs: number } {
  return {
    attempts: Number.parseInt(process.env.PANEL_JOB_ATTEMPTS || "", 10) || 3,
    // Image generation fails mostly on rate limits and transient upstream
    // errors, both of which want space rather than an immediate retry.
    backoffMs: Number.parseInt(process.env.PANEL_JOB_BACKOFF_MS || "", 10) || 5_000,
  };
}

/** Exponential: 5s, 10s, 20s… */
export function retryDelayMs(attemptsMade: number): number {
  return panelRetryPolicy().backoffMs * 2 ** Math.max(0, attemptsMade - 1);
}

/**
 * Hands panels to the queue by writing their payload onto the ledger panels
 * that already exist for them.
 *
 * Panels are addressed by position, which is safe because createJob writes
 * them in panelNumber order and nothing reorders them. The `enqueued: false`
 * guard is what makes a retried submit harmless: a panel already queued,
 * running or finished is left exactly as it is, so re-submitting a generation
 * cannot re-render live work.
 *
 * Returns the number of panels newly enqueued. The read and the write are not
 * one operation, so two simultaneous submits can both report having enqueued a
 * panel — but they write identical fields to the same panel, so at most one
 * unit of work exists either way, which is the guarantee that matters.
 */
export async function enqueuePanels(panels: PanelJobData[]): Promise<number> {
  if (!isQueueEnabled() || panels.length === 0) return 0;

  let enqueued = 0;

  for (const [jobId, group] of groupByJob(panels)) {
    const job = await GenerationJobModel.findById(jobId).lean();
    if (!job) continue;

    const now = new Date();
    const set: Record<string, unknown> = {};

    for (const panel of group) {
      const existing = job.panels[panel.panelIndex];
      // Position must line up with panelNumber, or this would arm the wrong panel.
      if (!existing || existing.panelNumber !== panel.panelIndex) continue;
      if (existing.enqueued) continue;

      const at = `panels.${panel.panelIndex}`;
      set[`${at}.prompt`] = panel.prompt;
      set[`${at}.style`] = panel.style;
      set[`${at}.characterSheet`] = panel.characterSheet ?? null;
      set[`${at}.characterRefUrl`] = panel.characterRefUrl ?? null;
      set[`${at}.enqueued`] = true;
      set[`${at}.availableAt`] = now;
      enqueued += 1;
    }

    if (Object.keys(set).length > 0) {
      await GenerationJobModel.updateOne({ _id: jobId }, { $set: set });
    }
  }

  return enqueued;
}

/**
 * Takes the next available panel, or returns null when there is nothing to do.
 *
 * The query matches a job that holds at least one claimable panel; the
 * positional `$` then updates *that* panel, all in one atomic document write.
 * A random claim token identifies which panel was taken in the document that
 * comes back — the update itself does not report which element it matched.
 */
export async function claimNextPanel(): Promise<PanelTask | null> {
  if (!isQueueEnabled()) return null;

  const now = new Date();
  const staleBefore = new Date(now.getTime() - VISIBILITY_TIMEOUT_MS);
  const claimToken = crypto.randomUUID();

  const claimable = {
    enqueued: true,
    $or: [
      { status: "pending", availableAt: { $lte: now } },
      // A claim nobody renewed: the worker holding it is presumed gone.
      { status: "running", claimedAt: { $lte: staleBefore } },
    ],
  };

  const doc = await GenerationJobModel.findOneAndUpdate(
    {
      status: { $in: ["queued", "running"] },
      panels: { $elemMatch: claimable },
    },
    {
      $set: {
        "panels.$.status": "running",
        "panels.$.claimedAt": now,
        "panels.$.claimToken": claimToken,
        "panels.$.updatedAt": now,
      },
    },
    { new: true, sort: { createdAt: 1 } },
  ).lean();

  if (!doc) return null;

  const panel = doc.panels.find((p) => p.claimToken === claimToken);
  if (!panel) return null;

  return {
    data: {
      jobId: String(doc._id),
      userId: doc.userId,
      comicId: doc.comicId ?? null,
      draftId: doc.draftId ?? null,
      panelIndex: panel.panelNumber,
      prompt: panel.prompt ?? "",
      style: panel.style ?? "",
      characterSheet: panel.characterSheet ?? undefined,
      characterRefUrl: panel.characterRefUrl ?? undefined,
    },
    attemptsMade: panel.attempts,
    opts: { attempts: doc.maxAttempts },
    claimToken,
  };
}

/**
 * Puts a failed panel back for a later attempt, spending one of its tries.
 *
 * Guarded on the claim token so a worker that has already lost the panel to
 * the visibility timeout cannot reschedule it underneath the worker that now
 * holds it.
 */
export async function releasePanel(task: PanelTask, delayMs: number): Promise<void> {
  if (!isQueueEnabled()) return;

  const now = new Date();

  await GenerationJobModel.updateOne(
    {
      _id: task.data.jobId,
      panels: { $elemMatch: { panelNumber: task.data.panelIndex, claimToken: task.claimToken } },
    },
    {
      $set: {
        "panels.$.status": "pending",
        "panels.$.availableAt": new Date(now.getTime() + delayMs),
        "panels.$.claimedAt": null,
        "panels.$.claimToken": null,
        "panels.$.updatedAt": now,
      },
      $inc: { "panels.$.attempts": 1 },
    },
  );
}

/** Panels waiting to be claimed right now. Used by tests and diagnostics. */
export async function countWaitingPanels(jobId?: string): Promise<number> {
  if (!isQueueEnabled()) return 0;

  const match: Record<string, unknown> = { status: { $in: ["queued", "running"] } };
  // Aggregation bypasses Mongoose's schema casting, so the id has to be a
  // real ObjectId here rather than the string every other query accepts.
  if (jobId) {
    if (!mongoose.isValidObjectId(jobId)) return 0;
    match._id = new mongoose.Types.ObjectId(jobId);
  }

  const [result] = await GenerationJobModel.aggregate<{ count: number }>([
    { $match: match },
    { $unwind: "$panels" },
    { $match: { "panels.enqueued": true, "panels.status": "pending" } },
    { $count: "count" },
  ]);

  return result?.count ?? 0;
}

function groupByJob(panels: PanelJobData[]): Map<string, PanelJobData[]> {
  const groups = new Map<string, PanelJobData[]>();
  for (const panel of panels) {
    const group = groups.get(panel.jobId);
    if (group) group.push(panel);
    else groups.set(panel.jobId, [panel]);
  }
  return groups;
}
