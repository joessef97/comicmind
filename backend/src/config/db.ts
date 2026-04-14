import mongoose from "mongoose";
import { log } from "../utils/logger";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/comicmind";

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    log("Connected to MongoDB", "database");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    log("MongoDB disconnected", "database");
  });
}
