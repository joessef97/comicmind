import mongoose, { Schema, Document } from "mongoose";
import type { IPanel } from "../comics/comic.model";

// ── Draft ───────────────────────────────────────────────────────────────

export interface IDraft extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: IPanel[];
  characterRefUrl?: string;
  status: "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
}

const draftSchema = new Schema<IDraft>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    style: {
      type: String,
      required: true,
    },
    idea: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    panels: {
      type: Schema.Types.Mixed,
      default: [],
    },
    characterRefUrl: {
      type: String,
      required: false,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATING", "COMPLETED", "FAILED"],
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
  }
);

draftSchema.index({ userId: 1, updatedAt: -1 });

export const DraftModel = mongoose.model<IDraft>("Draft", draftSchema);
