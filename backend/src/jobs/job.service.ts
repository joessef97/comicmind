import crypto from "crypto";
import mongoose from "mongoose";
import { GenerationJobModel, type IGenerationJob, type JobStatus, type PanelStatus } from "./job.model";

export type { JobStatus } from "./job.model";

const TERMINAL: readonly JobStatus[] = ["succeeded", "partial", "failed", "cancelled"];
const MAX_PANEL_ATTEMPTS = 3;
const PANEL_LEASE_MS = 15 * 60 * 1_000;

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

export interface PanelJobInput {
  prompt: string;
  style: string;
  characterSheet?: string;
  characterRefUrl?: string;
}

export interface JobPanelRecord extends PanelJobInput {
  panelNumber: number;
  status: PanelStatus;
  attempts: number;
  error: string | null;
  imageUrl: string | null;
}

export interface GenerationJobRecord {
  id: string;
  userId: string;
  comicId: string | null;
  draftId: string | null;
  idempotencyKey: string | null;
  status: JobStatus;
  totalPanels: number;
  completedPanels: number;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface ClaimedPanel {
  jobId: string;
  userId: string;
  comicId: string | null;
  draftId: string | null;
  panelNumber: number;
  prompt: string;
  style: string;
  characterSheet?: string;
  characterRefUrl?: string;
  attempts: number;
  maxAttempts: number;
  leaseToken: string;
}

export interface CreateJobInput {
  userId: string;
  comicId?: string | null;
  draftId?: string | null;
  totalPanels: number;
  panelInputs?: PanelJobInput[];
  idempotencyKey?: string | null;
  maxAttempts?: number;
}

export interface CreateJobResult {
  job: GenerationJobRecord;
  reused: boolean;
}

function toJobRecord(job: IGenerationJob): GenerationJobRecord {
  return {
    id: job._id.toString(),
    userId: job.userId,
    comicId: job.comicId,
    draftId: job.draftId,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    totalPanels: job.totalPanels,
    completedPanels: job.completedPanels,
    lastError: job.lastError ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
  };
}

function toPanelRecord(panel: any): JobPanelRecord {
  return {
    panelNumber: panel.panelNumber,
    prompt: panel.prompt ?? "",
    style: panel.style ?? "",
    characterSheet: panel.characterSheet,
    characterRefUrl: panel.characterRefUrl,
    status: panel.status,
    attempts: panel.attempts,
    error: panel.error ?? null,
    imageUrl: panel.imageUrl ?? null,
  };
}

export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(input.userId, idempotencyKey);
    if (existing) return { job: existing, reused: true };
  }

  const panelInputs = input.panelInputs ?? [];
  const panels = Array.from({ length: input.totalPanels }, (_, panelNumber) => ({
    panelNumber,
    prompt: panelInputs[panelNumber]?.prompt ?? "",
    style: panelInputs[panelNumber]?.style ?? "",
    characterSheet: panelInputs[panelNumber]?.characterSheet,
    characterRefUrl: panelInputs[panelNumber]?.characterRefUrl,
    status: "pending" as const,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? MAX_PANEL_ATTEMPTS,
  }));

  try {
    const created = await GenerationJobModel.create({
      userId: input.userId,
      comicId: input.comicId ?? null,
      draftId: input.draftId ?? null,
      idempotencyKey,
      totalPanels: input.totalPanels,
      panels,
    });
    return { job: toJobRecord(created), reused: false };
  } catch (error) {
    if (idempotencyKey && isDuplicateKeyError(error)) {
      const existing = await findByIdempotencyKey(input.userId, idempotencyKey);
      if (existing) return { job: existing, reused: true };
    }
    throw error;
  }
}

export async function findByIdempotencyKey(userId: string, idempotencyKey: string) {
  const job = await GenerationJobModel.findOne({ userId, idempotencyKey });
  return job ? toJobRecord(job) : null;
}

export async function findActiveJob(
  userId: string,
  scope: { comicId?: string | null; draftId?: string | null } = {},
) {
  const query: Record<string, unknown> = { userId, status: { $in: ["queued", "running"] } };
  if (scope.comicId) query.comicId = scope.comicId;
  if (scope.draftId) query.draftId = scope.draftId;
  const job = await GenerationJobModel.findOne(query).sort({ createdAt: -1 });
  return job ? toJobRecord(job) : null;
}

export async function getJob(jobId: string) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  const job = await GenerationJobModel.findById(jobId);
  return job ? toJobRecord(job) : null;
}

export async function getJobPanels(jobId: string): Promise<JobPanelRecord[]> {
  if (!mongoose.isValidObjectId(jobId)) return [];
  const job = await GenerationJobModel.findById(jobId).select({ panels: 1 });
  return job ? job.panels.map(toPanelRecord).sort((a, b) => a.panelNumber - b.panelNumber) : [];
}

export async function markRunning(jobId: string): Promise<GenerationJobRecord | null> {
  if (!mongoose.isValidObjectId(jobId)) return null;
  const job = await GenerationJobModel.findOneAndUpdate(
    { _id: jobId, status: "queued" },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true },
  );
  return job ? toJobRecord(job) : null;
}

/** Atomically claims one ready panel from the MongoDB-backed job store. */
export async function claimNextPanel(): Promise<ClaimedPanel | null> {
  const now = new Date();
  const leaseToken = crypto.randomUUID();
  const eligiblePanel = {
    attempts: { $lt: MAX_PANEL_ATTEMPTS },
    $or: [
      {
        status: "pending",
        $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }],
      },
      { status: "running", leaseUntil: { $lte: now } },
    ],
  };

  const job = await GenerationJobModel.findOneAndUpdate(
    {
      status: { $in: ["queued", "running"] },
      panels: { $elemMatch: eligiblePanel },
    },
    {
      $set: {
        status: "running",
        startedAt: now,
        "panels.$.status": "running",
        "panels.$.leaseToken": leaseToken,
        "panels.$.leaseUntil": new Date(now.getTime() + PANEL_LEASE_MS),
      },
      $inc: { "panels.$.attempts": 1 },
      $unset: { "panels.$.nextAttemptAt": "" },
    },
    { new: true, sort: { createdAt: 1 } },
  );

  if (!job) return null;
  const panel = job.panels.find((candidate) => candidate.leaseToken === leaseToken);
  if (!panel) return null;

  return {
    jobId: job._id.toString(),
    userId: job.userId,
    comicId: job.comicId,
    draftId: job.draftId,
    panelNumber: panel.panelNumber,
    prompt: panel.prompt,
    style: panel.style,
    characterSheet: panel.characterSheet,
    characterRefUrl: panel.characterRefUrl,
    attempts: panel.attempts,
    maxAttempts: panel.maxAttempts,
    leaseToken,
  };
}

export async function releasePanelForRetry(
  jobId: string,
  panelNumber: number,
  leaseToken: string,
  error: string,
  nextAttemptAt: Date,
): Promise<void> {
  await GenerationJobModel.updateOne(
    { _id: jobId, panels: { $elemMatch: { panelNumber, leaseToken, status: "running" } } },
    {
      $set: {
        "panels.$.status": "pending",
        "panels.$.error": error,
        "panels.$.nextAttemptAt": nextAttemptAt,
      },
      $unset: { "panels.$.leaseToken": "", "panels.$.leaseUntil": "" },
    },
  );
}

export async function extendPanelLease(
  jobId: string,
  panelNumber: number,
  leaseToken: string,
): Promise<void> {
  await GenerationJobModel.updateOne(
    { _id: jobId, panels: { $elemMatch: { panelNumber, leaseToken, status: "running" } } },
    { $set: { "panels.$.leaseUntil": new Date(Date.now() + PANEL_LEASE_MS) } },
  );
}

export async function recordPanelResult(
  jobId: string,
  panelNumber: number,
  result: { status: "succeeded" | "failed"; imageUrl?: string | null; error?: string | null; attempts?: number },
  leaseToken?: string,
): Promise<void> {
  const panelMatch: Record<string, unknown> = { panelNumber, status: { $ne: "succeeded" } };
  if (leaseToken) panelMatch.leaseToken = leaseToken;

  const set: Record<string, unknown> = {
    "panels.$.status": result.status,
    "panels.$.imageUrl": result.imageUrl ?? null,
    "panels.$.error": result.error ?? null,
  };
  const update: Record<string, any> = {
    $set: set,
    $unset: { "panels.$.leaseToken": "", "panels.$.leaseUntil": "", "panels.$.nextAttemptAt": "" },
  };
  if (result.attempts !== undefined) set["panels.$.attempts"] = result.attempts;
  else if (!leaseToken) update.$inc = { "panels.$.attempts": 1 };
  if (result.status === "succeeded") update.$inc = { ...update.$inc, completedPanels: 1 };

  await GenerationJobModel.updateOne(
    { _id: jobId, panels: { $elemMatch: panelMatch } },
    update,
  );
}

/** Mark crashed, expired leases as failed after their last allowed attempt. */
export async function failExpiredPanels(): Promise<void> {
  const now = new Date();
  const jobs = await GenerationJobModel.find({
    status: { $in: ["queued", "running"] },
    panels: { $elemMatch: { status: "running", attempts: { $gte: MAX_PANEL_ATTEMPTS }, leaseUntil: { $lte: now } } },
  }).select({ _id: 1, panels: 1 });

  for (const job of jobs) {
    for (const panel of job.panels) {
      if (panel.status === "running" && panel.attempts >= panel.maxAttempts && panel.leaseUntil && panel.leaseUntil <= now) {
        await recordPanelResult(
          job._id.toString(),
          panel.panelNumber,
          { status: "failed", error: "Worker stopped before this panel completed", attempts: panel.attempts },
          panel.leaseToken,
        );
      }
    }
    await finalizeIfComplete(job._id.toString());
  }
}

export async function finalizeJob(jobId: string): Promise<GenerationJobRecord | null> {
  if (!mongoose.isValidObjectId(jobId)) return null;
  const current = await GenerationJobModel.findById(jobId);
  if (!current || isTerminal(current.status)) return current ? toJobRecord(current) : null;

  const panels = current.panels;
  if (panels.some((panel) => panel.status === "pending" || panel.status === "running")) return null;

  const succeeded = panels.filter((panel) => panel.status === "succeeded").length;
  const next: JobStatus = succeeded === panels.length && panels.length > 0
    ? "succeeded"
    : succeeded === 0
      ? "failed"
      : "partial";
  if (!canTransition(current.status, next)) return toJobRecord(current);

  const finalized = await GenerationJobModel.findOneAndUpdate(
    { _id: jobId, status: { $in: ["queued", "running"] } },
    { $set: { status: next, finishedAt: new Date() } },
    { new: true },
  );
  return finalized ? toJobRecord(finalized) : getJob(jobId);
}

export async function finalizeIfComplete(jobId: string): Promise<GenerationJobRecord | null> {
  const panels = await getJobPanels(jobId);
  if (panels.length === 0 || panels.some((panel) => panel.status === "pending" || panel.status === "running")) {
    return null;
  }
  return finalizeJob(jobId);
}

export async function failJob(jobId: string, message: string): Promise<void> {
  if (!mongoose.isValidObjectId(jobId)) return;
  await GenerationJobModel.updateOne(
    { _id: jobId, status: { $in: ["queued", "running"] } },
    { $set: { status: "failed", lastError: message, finishedAt: new Date() } },
  );
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}
