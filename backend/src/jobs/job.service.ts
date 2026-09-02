/**
 * Generation job ledger.
 *
 * Every function here is a no-op returning null when the ledger is
 * unavailable (no Mongo connection), so callers can record progress
 * unconditionally without branching. Bookkeeping must never be the reason a
 * comic fails to generate.
 *
 * The guarantees this file makes — no double render, no double count, no
 * double finalize — are enforced by MongoDB, not by application logic. Each
 * one is a single-document write, atomic on any deployment; see the note on
 * embedding in job.model.ts.
 */

import mongoose from "mongoose";
import {
  GenerationJobModel,
  isLedgerEnabled,
  toLedgerJob,
  toLedgerPanels,
  type GenerationJob,
  type GenerationJobPanel,
  type JobStatus,
} from "./job.model";

export { isLedgerEnabled };
export type { GenerationJob, GenerationJobPanel, JobStatus };

/**
 * Terminal states. A job that has reached one of these is never mutated again;
 * a re-run creates a new job rather than reopening an old one.
 */
const TERMINAL: readonly JobStatus[] = ["succeeded", "partial", "failed", "cancelled"];

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL.includes(status);
}

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["running", "cancelled", "failed"],
  running: ["succeeded", "partial", "failed", "cancelled"],
  succeeded: [],
  partial: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface CreateJobInput {
  userId: string;
  comicId?: string | null;
  draftId?: string | null;
  totalPanels: number;
  idempotencyKey?: string | null;
  maxAttempts?: number;
}

export interface CreateJobResult {
  job: GenerationJob;
  /** True when an existing job was returned instead of a new one being created. */
  reused: boolean;
}

/**
 * Creates a job and its panels as one document.
 *
 * When an idempotency key is supplied and already exists for this user, the
 * existing job is returned untouched with `reused: true` — the caller should
 * attach to it rather than starting a second generation. The uniqueness is
 * enforced by a partial unique index, so two concurrent requests cannot both
 * win: the loser catches the duplicate-key error and re-reads.
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult | null> {
  if (!isLedgerEnabled()) return null;

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existing) return { job: existing, reused: true };
  }

  try {
    const doc = await GenerationJobModel.create({
      userId: input.userId,
      comicId: input.comicId ?? null,
      draftId: input.draftId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      totalPanels: input.totalPanels,
      maxAttempts: input.maxAttempts ?? 3,
      panels: Array.from({ length: Math.max(0, input.totalPanels) }, (_, i) => ({
        panelNumber: i,
      })),
    });

    return { job: toLedgerJob(doc), reused: false };
  } catch (err) {
    // Lost the insert race on the idempotency index — the winner's job is authoritative.
    if (input.idempotencyKey && isDuplicateKey(err)) {
      const existing = await findByIdempotencyKey(input.userId, input.idempotencyKey);
      if (existing) return { job: existing, reused: true };
    }
    throw err;
  }
}

export async function findByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<GenerationJob | null> {
  if (!isLedgerEnabled()) return null;

  const doc = await GenerationJobModel.findOne({ userId, idempotencyKey }).lean();
  return doc ? toLedgerJob(doc) : null;
}

/**
 * The user's most recent unfinished job, so a client returning after a reload
 * can re-attach to work that carried on without it.
 */
export async function findActiveJob(
  userId: string,
  scope: { comicId?: string | null; draftId?: string | null } = {},
): Promise<GenerationJob | null> {
  if (!isLedgerEnabled()) return null;

  const filter: Record<string, unknown> = {
    userId,
    status: { $in: ["queued", "running"] },
  };

  if (scope.comicId) filter.comicId = scope.comicId;
  if (scope.draftId) filter.draftId = scope.draftId;

  const doc = await GenerationJobModel.findOne(filter).sort({ createdAt: -1 }).lean();
  return doc ? toLedgerJob(doc) : null;
}

export async function getJob(jobId: string): Promise<GenerationJob | null> {
  const doc = await findJobDoc(jobId);
  return doc ? toLedgerJob(doc) : null;
}

export async function getJobPanels(jobId: string): Promise<GenerationJobPanel[]> {
  const doc = await findJobDoc(jobId);
  return doc ? toLedgerPanels(doc) : [];
}

/** Marks a queued job as running. Safe to call twice; the second call is a no-op. */
export async function markRunning(jobId: string): Promise<GenerationJob | null> {
  if (!isValidJobId(jobId)) return null;

  const doc = await GenerationJobModel.findOneAndUpdate(
    { _id: jobId, status: "queued" },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true },
  ).lean();

  return doc ? toLedgerJob(doc) : null;
}

/**
 * Records a finished panel and advances the parent counter.
 *
 * A panel becoming successful for the first time is one update: the guard
 * `status: { $ne: "succeeded" }` on the matched array element and the `$inc`
 * of `completedPanels` are the same write, so the counter can never disagree
 * with the panels. If that write matches nothing, the panel had already
 * succeeded — a redelivery — and the fields are refreshed without touching
 * the counter.
 */
export async function recordPanelResult(
  jobId: string,
  panelNumber: number,
  result: { status: "succeeded" | "failed"; imageUrl?: string | null; error?: string | null },
): Promise<void> {
  if (!isValidJobId(jobId)) return;

  const fields = {
    "panels.$.status": result.status,
    "panels.$.imageUrl": result.imageUrl ?? null,
    "panels.$.error": result.error ?? null,
    "panels.$.updatedAt": new Date(),
  };

  if (result.status === "succeeded") {
    const claimed = await GenerationJobModel.updateOne(
      {
        _id: jobId,
        panels: { $elemMatch: { panelNumber, status: { $ne: "succeeded" } } },
      },
      { $set: fields, $inc: { "panels.$.attempts": 1, completedPanels: 1 } },
    );

    if (claimed.matchedCount > 0) return;
  }

  await GenerationJobModel.updateOne(
    { _id: jobId, "panels.panelNumber": panelNumber },
    { $set: fields, $inc: { "panels.$.attempts": 1 } },
  );
}

/**
 * Closes a job out. The final status is derived from the panels rather than
 * passed in, so it always reflects what actually happened.
 *
 * The update is guarded on the status that was read, making it a
 * compare-and-swap: if another process finalized this job in the meantime the
 * write matches nothing, and that process's result is returned instead. This
 * is what stops two workers finishing the last two panels at the same instant
 * from both closing the job out.
 */
export async function finalizeJob(jobId: string): Promise<GenerationJob | null> {
  const current = await findJobDoc(jobId);
  if (!current) return null;
  if (isTerminal(current.status)) return toLedgerJob(current);

  const panels = toLedgerPanels(current);
  const succeeded = panels.filter((p) => p.status === "succeeded").length;
  const next: JobStatus =
    succeeded === panels.length && panels.length > 0
      ? "succeeded"
      : succeeded === 0
        ? "failed"
        : "partial";

  if (!canTransition(current.status, next)) return toLedgerJob(current);

  const updated = await GenerationJobModel.findOneAndUpdate(
    { _id: jobId, status: current.status },
    { $set: { status: next, finishedAt: new Date() } },
    { new: true },
  ).lean();

  if (!updated) return getJob(jobId);
  return toLedgerJob(updated);
}

/**
 * Finalizes a job only once every panel has stopped moving. Lets the caller
 * record panel results without tracking how many are left — whichever panel
 * happens to finish last closes the job out.
 */
export async function finalizeIfComplete(jobId: string): Promise<GenerationJob | null> {
  const doc = await findJobDoc(jobId);
  if (!doc) return null;

  const panels = toLedgerPanels(doc);
  if (panels.length === 0) return null;

  const stillMoving = panels.some((p) => p.status === "pending" || p.status === "running");
  if (stillMoving) return null;

  return finalizeJob(jobId);
}

export async function failJob(jobId: string, message: string): Promise<void> {
  if (!isValidJobId(jobId)) return;

  await GenerationJobModel.updateOne(
    { _id: jobId },
    { $set: { status: "failed", lastError: message, finishedAt: new Date() } },
  );
}

async function findJobDoc(jobId: string): Promise<any | null> {
  if (!isValidJobId(jobId)) return null;
  return GenerationJobModel.findById(jobId).lean();
}

/**
 * Job ids reach us straight out of URLs, so a malformed one becomes "no such
 * job" rather than a CastError bubbling up from the driver.
 */
function isValidJobId(jobId: string): boolean {
  return isLedgerEnabled() && Boolean(jobId) && mongoose.isValidObjectId(jobId);
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
