import mongoose, { Schema, type Document } from "mongoose";

export type JobStatus = "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
export type PanelStatus = "pending" | "running" | "succeeded" | "failed";

export interface IGenerationPanel {
  panelNumber: number;
  prompt: string;
  style: string;
  characterSheet?: string;
  characterRefUrl?: string;
  status: PanelStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  imageUrl?: string;
  leaseToken?: string;
  leaseUntil?: Date;
  nextAttemptAt?: Date;
}

export interface IGenerationJob extends Document {
  userId: string;
  comicId: string | null;
  draftId: string | null;
  idempotencyKey: string | null;
  status: JobStatus;
  panels: IGenerationPanel[];
  totalPanels: number;
  completedPanels: number;
  lastError?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

const panelSchema = new Schema<IGenerationPanel>(
  {
    panelNumber: { type: Number, required: true },
    prompt: { type: String, default: "" },
    style: { type: String, default: "" },
    characterSheet: String,
    characterRefUrl: String,
    status: { type: String, enum: ["pending", "running", "succeeded", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    error: String,
    imageUrl: String,
    leaseToken: String,
    leaseUntil: Date,
    nextAttemptAt: Date,
  },
  { _id: false },
);

const generationJobSchema = new Schema<IGenerationJob>(
  {
    userId: { type: String, required: true, index: true },
    comicId: { type: String, default: null },
    draftId: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "partial", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    panels: { type: [panelSchema], default: [] },
    totalPanels: { type: Number, required: true },
    completedPanels: { type: Number, default: 0 },
    lastError: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

generationJobSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);
generationJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
generationJobSchema.index({ status: 1, createdAt: 1 });

export const GenerationJobModel = mongoose.model<IGenerationJob>("GenerationJob", generationJobSchema);
