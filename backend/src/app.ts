import express from "express";
import { log } from "./utils/logger";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/user.routes";
import { comicRouter, imageRouter } from "./modules/comics/comic.routes";
import draftRoutes from "./modules/drafts/draft.routes";
import ratingRoutes from "./modules/ratings/rating.routes";
import { comicCommentRouter, commentDeleteRouter } from "./modules/comments/comment.routes";
import { getUploadsRoot, getStorageProviderName } from "./services/image-storage";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Serve persisted images from local disk (no-op if using Cloudinary CDN)
app.use("/uploads", express.static(getUploadsRoot()));
console.log(`[routes] Image storage provider: ${getStorageProviderName()}`);

// ── API Routes ──────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user", userRoutes);
app.use("/api/comics", comicRouter);
app.use("/api/comics", ratingRoutes);
app.use("/api/comics", comicCommentRouter);
app.use("/api/comments", commentDeleteRouter);
app.use("/api/drafts", draftRoutes);
app.use("/api/images", imageRouter);

export { app };

// Re-export log for backward compatibility
export { log } from "./utils/logger";
