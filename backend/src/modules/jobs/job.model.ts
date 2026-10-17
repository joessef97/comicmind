import mongoose, { Schema, Document } from "mongoose";

// ── Panel-level status (tracked individually for resume) ────────────────

export type JobPanelStatus = "pending" | "in_progress" | "completed" | "failed";

export interface IJobPanel {
  number: number;
  description: string;
  dialogue: string;
  narration: string;
  imageUrl?: string;
  storagePublicId?: string;
  generationMeta?: {
    model: string;
    prompt: string;
    style: string;
    createdAt: string;
    costEstimate: number;
  };
  status: JobPanelStatus;
  error?: string;
  /** How many times generation has been attempted for this panel */
  attempts: number;
}

// ── Job-level document ──────────────────────────────────────────────────

export type JobStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface IGenerationJob extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  style: string;
  idea: string;
  characterSheet?: string;
  characterRefUrl?: string;
  draftId?: string;
  status: JobStatus;
  panels: IJobPanel[];
  progress: { completed: number; total: number };
  /**
   * Worker lock with TTL.  A worker sets this to `now + lockTtlMs` when
   * it claims a job.  If the worker crashes, the lock expires and another
   * worker can reclaim the job via `findOneAndUpdate`.
   */
  workerLockUntil?: Date;
  /** Unique lease token; prevents a worker whose lease expired from writing stale results. */
  workerLockToken?: string;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-schemas ─────────────────────────────────────────────────────────

const jobPanelSchema = new Schema<IJobPanel>(
  {
    number: { type: Number, required: true },
    description: { type: String, required: true },
    dialogue: { type: String, default: "" },
    narration: { type: String, default: "" },
    imageUrl: String,
    storagePublicId: String,
    generationMeta: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed"],
      default: "pending",
    },
    error: String,
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const generationJobSchema = new Schema<IGenerationJob>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    style: { type: String, required: true },
    idea: { type: String, required: true, maxlength: 1000 },
    characterSheet: String,
    characterRefUrl: { type: String, trim: true },
    draftId: { type: String, index: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed", "cancelled"],
      default: "pending",
    },
    panels: [jobPanelSchema],
    progress: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 6 },
    },
    workerLockUntil: Date,
    workerLockToken: { type: String, index: true },
    completedAt: Date,
    error: String,
  },
  { timestamps: true },
);

// Compound index for the worker's atomic claim query:
//   "find the oldest pending job, OR the oldest in_progress job whose lock expired"
generationJobSchema.index({ status: 1, workerLockUntil: 1, createdAt: 1 });

export const GenerationJobModel = mongoose.model<IGenerationJob>(
  "GenerationJob",
  generationJobSchema,
);
