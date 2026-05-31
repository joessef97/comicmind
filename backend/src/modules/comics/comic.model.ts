import mongoose, { Schema, Document } from "mongoose";

// ── Shared Panel Types (also used by Drafts) ────────────────────────────

export interface IPanelGenerationMeta {
  model: string;
  prompt: string;
  style: string;
  createdAt: string;
  costEstimate: number;
}

export interface IPanel {
  number: number;
  description: string;
  dialogue: string;
  narration: string;
  imageUrl?: string;
  /** Cloud/disk storage identifier used for deletion (e.g. Cloudinary public ID) */
  storagePublicId?: string;
  error?: string;
  generationMeta?: IPanelGenerationMeta;
}

// ── Comic ───────────────────────────────────────────────────────────────

export interface IComic extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: IPanel[];
  characterSheet?: string;
  characterRefUrl?: string;
  published: boolean;
  shares: number;
  downloads: number;
  createdAt: Date;
}

const comicSchema = new Schema<IComic>(
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
      required: true,
      maxlength: 1000,
    },
    panels: {
      type: Schema.Types.Mixed,
      required: true,
    },
    characterSheet: {
      type: String,
      required: false,
    },
    characterRefUrl: {
      type: String,
      required: false,
      trim: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
    shares: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

comicSchema.index({ userId: 1, createdAt: -1 });
comicSchema.index({ published: 1, createdAt: -1 });

export const ComicModel = mongoose.model<IComic>("Comic", comicSchema);
