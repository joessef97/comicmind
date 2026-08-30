/**
 * Generation job control plane (PostgreSQL)
 * ─────────────────────────────────────────
 * Postgres owns *job state* only. Comic and panel content stays in MongoDB —
 * see backend/src/modules/comics/comic.model.ts. The split is deliberate:
 * the ledger needs transactions, uniqueness guarantees and an audit trail,
 * while comic panels are document-shaped and already work well as documents.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * `partial` is a success-with-holes: some panels rendered, some exhausted their
 * retries. It is distinct from `failed`, which means the job never produced
 * anything usable. Keeping them apart is what lets the UI offer "retry the
 * three panels that failed" instead of "start over".
 */
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const panelStatus = pgEnum("panel_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Mongo ObjectId strings — this database holds no FK to Mongo. */
    userId: text("user_id").notNull(),
    comicId: text("comic_id"),
    draftId: text("draft_id"),

    /** Client-supplied Idempotency-Key header. Null for internally created jobs. */
    idempotencyKey: text("idempotency_key"),

    status: jobStatus("status").notNull().default("queued"),

    totalPanels: integer("total_panels").notNull(),
    /** Maintained in the same transaction as the panel row it counts. */
    completedPanels: integer("completed_panels").notNull().default(0),

    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    /**
     * The idempotency guarantee lives here, not in application code: a
     * concurrent duplicate submit loses the insert race and is served the
     * existing job instead of paying for a second generation.
     */
    uniqueIndex("generation_jobs_user_idempotency_key")
      .on(table.userId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),

    index("generation_jobs_user_created_idx").on(table.userId, table.createdAt),
    /** Supports "does this user already have a job running?" and worker sweeps. */
    index("generation_jobs_status_idx").on(table.status),
  ],
);

export const generationJobPanels = pgTable(
  "generation_job_panels",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),

    panelNumber: integer("panel_number").notNull(),
    status: panelStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),

    /** Mirrors the URL written to Mongo, so the ledger alone explains what happened. */
    imageUrl: text("image_url"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Makes worker writes idempotent under redelivery: a panel that is
     * delivered twice updates one row rather than appending a second.
     */
    uniqueIndex("generation_job_panels_job_panel_key").on(table.jobId, table.panelNumber),
  ],
);

export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;
export type GenerationJobPanel = typeof generationJobPanels.$inferSelect;
export type NewGenerationJobPanel = typeof generationJobPanels.$inferInsert;
