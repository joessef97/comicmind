/**
 * Generation job ledger.
 *
 * Every function here is a no-op returning null when the ledger is disabled
 * (no DATABASE_URL), so callers can record progress unconditionally without
 * branching. Bookkeeping must never be the reason a comic fails to generate.
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  generationJobPanels,
  generationJobs,
  type GenerationJob,
} from "../db/schema";

export type JobStatus = GenerationJob["status"];

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
 * Creates a job and its panel rows in one transaction.
 *
 * When an idempotency key is supplied and already exists for this user, the
 * existing job is returned untouched with `reused: true` — the caller should
 * attach to it rather than starting a second generation. The uniqueness is
 * enforced by a partial unique index, so two concurrent requests cannot both
 * win: the loser catches the constraint violation and re-reads.
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult | null> {
  const db = getDb();
  if (!db) return null;

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existing) return { job: existing, reused: true };
  }

  try {
    return await db.transaction(async (tx) => {
      const [job] = await tx
        .insert(generationJobs)
        .values({
          userId: input.userId,
          comicId: input.comicId ?? null,
          draftId: input.draftId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          totalPanels: input.totalPanels,
          maxAttempts: input.maxAttempts ?? 3,
        })
        .returning();

      if (input.totalPanels > 0) {
        await tx.insert(generationJobPanels).values(
          Array.from({ length: input.totalPanels }, (_, i) => ({
            jobId: job.id,
            panelNumber: i,
          })),
        );
      }

      return { job, reused: false };
    });
  } catch (err) {
    // Lost the insert race on the idempotency index — the winner's job is authoritative.
    if (input.idempotencyKey && isUniqueViolation(err)) {
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
  const db = getDb();
  if (!db) return null;

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        eq(generationJobs.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  return job ?? null;
}

export async function getJob(jobId: string): Promise<GenerationJob | null> {
  const db = getDb();
  if (!db) return null;

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  return job ?? null;
}

export async function getJobPanels(jobId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(generationJobPanels)
    .where(eq(generationJobPanels.jobId, jobId))
    .orderBy(generationJobPanels.panelNumber);
}

/** Marks a queued job as running. Safe to call twice; the second call is a no-op. */
export async function markRunning(jobId: string): Promise<GenerationJob | null> {
  const db = getDb();
  if (!db) return null;

  const [job] = await db
    .update(generationJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "queued")))
    .returning();

  return job ?? null;
}

/**
 * Records a finished panel and advances the parent counter in the same
 * transaction, so `completed_panels` can never disagree with the panel rows.
 * Redelivery of an already-succeeded panel does not double-count.
 */
export async function recordPanelResult(
  jobId: string,
  panelNumber: number,
  result: { status: "succeeded" | "failed"; imageUrl?: string | null; error?: string | null },
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ status: generationJobPanels.status })
      .from(generationJobPanels)
      .where(
        and(
          eq(generationJobPanels.jobId, jobId),
          eq(generationJobPanels.panelNumber, panelNumber),
        ),
      )
      .for("update")
      .limit(1);

    if (!previous) return;

    await tx
      .update(generationJobPanels)
      .set({
        status: result.status,
        imageUrl: result.imageUrl ?? null,
        error: result.error ?? null,
        attempts: sql`${generationJobPanels.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(generationJobPanels.jobId, jobId),
          eq(generationJobPanels.panelNumber, panelNumber),
        ),
      );

    // Only a pending/running panel becoming successful moves the counter.
    if (result.status === "succeeded" && previous.status !== "succeeded") {
      await tx
        .update(generationJobs)
        .set({ completedPanels: sql`${generationJobs.completedPanels} + 1` })
        .where(eq(generationJobs.id, jobId));
    }
  });
}

/**
 * Closes a job out. The final status is derived from the panel rows rather
 * than passed in, so it always reflects what actually happened.
 */
export async function finalizeJob(jobId: string): Promise<GenerationJob | null> {
  const db = getDb();
  if (!db) return null;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, jobId))
      .for("update")
      .limit(1);

    if (!current || isTerminal(current.status)) return current ?? null;

    const panels = await tx
      .select({ status: generationJobPanels.status })
      .from(generationJobPanels)
      .where(eq(generationJobPanels.jobId, jobId));

    const succeeded = panels.filter((p) => p.status === "succeeded").length;
    const next: JobStatus =
      succeeded === panels.length && panels.length > 0
        ? "succeeded"
        : succeeded === 0
          ? "failed"
          : "partial";

    if (!canTransition(current.status, next)) return current;

    const [job] = await tx
      .update(generationJobs)
      .set({ status: next, finishedAt: new Date() })
      .where(eq(generationJobs.id, jobId))
      .returning();

    return job ?? null;
  });
}

/**
 * Finalizes a job only once every panel has stopped moving. Lets the caller
 * record panel results without tracking how many are left — whichever panel
 * happens to finish last closes the job out.
 */
export async function finalizeIfComplete(jobId: string): Promise<GenerationJob | null> {
  const db = getDb();
  if (!db) return null;

  const panels = await getJobPanels(jobId);
  if (panels.length === 0) return null;

  const stillMoving = panels.some((p) => p.status === "pending" || p.status === "running");
  if (stillMoving) return null;

  return finalizeJob(jobId);
}

export async function failJob(jobId: string, message: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(generationJobs)
    .set({ status: "failed", lastError: message, finishedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
