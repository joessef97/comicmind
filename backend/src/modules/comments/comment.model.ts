import mongoose, { Schema, Document } from "mongoose";

// ── Comment ─────────────────────────────────────────────────────────────

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  comicId: string;
  text: string;
  createdAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    userId: { type: String, required: true },
    comicId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

commentSchema.index({ comicId: 1, createdAt: -1 });

export const CommentModel = mongoose.model<IComment>("Comment", commentSchema);
