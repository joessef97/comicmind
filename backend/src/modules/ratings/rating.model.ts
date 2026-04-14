import mongoose, { Schema, Document } from "mongoose";

// ── Rating ──────────────────────────────────────────────────────────────

export interface IRating extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  comicId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    userId: { type: String, required: true },
    comicId: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  {
    timestamps: true,
  }
);

ratingSchema.index({ comicId: 1 });
ratingSchema.index({ comicId: 1, createdAt: -1 });
ratingSchema.index({ userId: 1, comicId: 1 }, { unique: true }); // one rating per user per comic

export const RatingModel = mongoose.model<IRating>("Rating", ratingSchema);
