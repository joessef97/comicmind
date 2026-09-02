/**
 * Generation job control plane (MongoDB)
 * ──────────────────────────────────────
 * The ledger that tracks a durable generation: what was asked for, which
 * panels have landed, and how the job finally settled.
 *
 * **Panels are embedded, not a second collection.** That is the whole design.
 * A job has a handful of panels, all written by the same worker, and every
 * mutation the ledger performs touches exactly one job and its panels — so
 * embedding turns each of them into a single-document update. MongoDB
 * guarantees single-document writes are atomic on any deployment, which is
 * what lets `recordPanelResult` advance `completedPanels` in the same write
 * that marks the panel succeeded. A separate panels collection would have
 * needed multi-document transactions, and those require a replica set.
 *
 * Embedding is also what makes this collection the *queue*. A panel carries
 * both its work (the prompt and style to render) and its claim state, so a
 * worker takes the next piece of work with the same one-document update that
 * marks it taken — see backend/src/jobs/queue.ts.
 *
 * Comic and panel *content* still lives in the comics collection — see
 * backend/src/modules/comics/comic.model.ts. This collection holds job state
 * only, and keeps no references into comics beyond the plain id strings.
 */

import mongoose, { Schema } from "mongoose";

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
] as const;

export const PANEL_STATUSES = ["pending", "running", "succeeded", "failed"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type PanelStatus = (typeof PANEL_STATUSES)[number];

/** Plain shape the service returns, so callers never hold a Mongoose document. */
export interface GenerationJobPanel {
  panelNumber: number;
  status: PanelStatus;
  attempts: number;
  imageUrl: string | null;
  error: string | null;
  updatedAt: Date;
}

export interface GenerationJob {
  id: string;
  userId: string;
  comicId: string | null;
  draftId: string | null;
  idempotencyKey: string | null;
  status: JobStatus;
  totalPanels: number;
  completedPanels: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** The stored shape, as opposed to the `GenerationJob` the service hands out. */
interface GenerationJobPanelDoc {
  panelNumber: number;
  status: PanelStatus;
  attempts: number;
  error: string | null;
  imageUrl: string | null;
  updatedAt: Date;

  // Queue payload — what a worker needs to render this panel.
  prompt: string | null;
  style: string | null;
  characterSheet: string | null;
  characterRefUrl: string | null;

  // Claim state.
  enqueued: boolean;
  availableAt: Date | null;
  claimedAt: Date | null;
  claimToken: string | null;
}

interface GenerationJobDoc {
  _id: mongoose.Types.ObjectId;
  userId: string;
  comicId: string | null;
  draftId: string | null;
  idempotencyKey: string | null;
  status: JobStatus;
  totalPanels: number;
  completedPanels: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  panels: GenerationJobPanelDoc[];
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

const panelSchema = new Schema<GenerationJobPanelDoc>(
  {
    panelNumber: { type: Number, required: true },
    status: { type: String, enum: PANEL_STATUSES, required: true, default: "pending" },
    attempts: { type: Number, required: true, default: 0 },
    error: { type: String, default: null },

    /** Mirrors the URL written to the comic, so the ledger alone explains what happened. */
    imageUrl: { type: String, default: null },

    updatedAt: { type: Date, required: true, default: () => new Date() },

    // ── Queue payload ──────────────────────────────────────────────────
    // Written by enqueuePanels, read by whichever worker claims the panel.
    // Null on a job that was recorded but never handed to the queue.
    prompt: { type: String, default: null },
    style: { type: String, default: null },
    characterSheet: { type: String, default: null },
    characterRefUrl: { type: String, default: null },

    // ── Claim state ────────────────────────────────────────────────────
    /** False until enqueued, which is what keeps a bare ledger job off the queue. */
    enqueued: { type: Boolean, required: true, default: false },
    /** Earliest a worker may claim this panel; moved forward by retry backoff. */
    availableAt: { type: Date, default: null },
    /** When the current claim was taken. A stale claim is reclaimable. */
    claimedAt: { type: Date, default: null },
    /** Identifies the claim in the document the claiming update returns. */
    claimToken: { type: String, default: null },
  },
  { _id: false },
);

const generationJobSchema = new Schema<GenerationJobDoc>(
  {
    /** Mongo ObjectId strings; kept as plain strings, with no populated refs. */
    userId: { type: String, required: true },
    comicId: { type: String, default: null },
    draftId: { type: String, default: null },

    /** Client-supplied Idempotency-Key header. Null for internally created jobs. */
    idempotencyKey: { type: String, default: null },

    status: { type: String, enum: JOB_STATUSES, required: true, default: "queued" },

    totalPanels: { type: Number, required: true },
    /** Advanced by the same write that marks the panel it counts as succeeded. */
    completedPanels: { type: Number, required: true, default: 0 },

    attempts: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true, default: 3 },
    lastError: { type: String, default: null },

    panels: { type: [panelSchema], default: [] },

    createdAt: { type: Date, required: true, default: () => new Date() },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

/**
 * The idempotency guarantee lives here, not in application code: a concurrent
 * duplicate submit loses the insert race and is served the existing job
 * instead of paying for a second generation.
 *
 * The partial filter is what makes this workable — without it every job
 * created without a key would collide on `(userId, null)`.
 */
generationJobSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

generationJobSchema.index({ userId: 1, createdAt: -1 });
/** Supports "does this user already have a job running?" and worker sweeps. */
generationJobSchema.index({ status: 1 });
/**
 * The claim query: workers poll for a job holding claimable panels, oldest
 * first. Without this every poll is a collection scan.
 */
generationJobSchema.index({ status: 1, "panels.enqueued": 1, "panels.status": 1, createdAt: 1 });

export const GenerationJobModel: mongoose.Model<GenerationJobDoc> =
  (mongoose.models.GenerationJob as mongoose.Model<GenerationJobDoc>) ||
  mongoose.model<GenerationJobDoc>("GenerationJob", generationJobSchema, "generation_jobs");

/**
 * The ledger rides on the app's own Mongo connection, so it is available
 * whenever that connection is up. Callers still treat it as optional:
 * bookkeeping must never be the reason a comic fails to generate.
 */
export function isLedgerEnabled(): boolean {
  return mongoose.connection.readyState === 1;
}

export function toLedgerJob(doc: any): GenerationJob {
  return {
    id: String(doc._id),
    userId: doc.userId,
    comicId: doc.comicId ?? null,
    draftId: doc.draftId ?? null,
    idempotencyKey: doc.idempotencyKey ?? null,
    status: doc.status,
    totalPanels: doc.totalPanels,
    completedPanels: doc.completedPanels,
    attempts: doc.attempts,
    maxAttempts: doc.maxAttempts,
    lastError: doc.lastError ?? null,
    createdAt: doc.createdAt,
    startedAt: doc.startedAt ?? null,
    finishedAt: doc.finishedAt ?? null,
  };
}

export function toLedgerPanels(doc: any): GenerationJobPanel[] {
  return [...(doc?.panels ?? [])]
    .map((p: any) => ({
      panelNumber: p.panelNumber,
      status: p.status,
      attempts: p.attempts,
      imageUrl: p.imageUrl ?? null,
      error: p.error ?? null,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => a.panelNumber - b.panelNumber);
}
