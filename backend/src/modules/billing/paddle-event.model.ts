import mongoose, { Schema, Document } from "mongoose";

export interface IPaddleEvent extends Document {
  eventId: string;
  eventType: string;
  processedAt: Date;
  createdAt: Date;
}

const paddleEventSchema = new Schema<IPaddleEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

export const PaddleEventModel = mongoose.model<IPaddleEvent>("PaddleEvent", paddleEventSchema);
