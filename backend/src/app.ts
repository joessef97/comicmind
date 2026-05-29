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

// ── Health / keep-alive endpoint ────────────────────────────────────────
// Render free-tier spins down after 15 min of inactivity.  A lightweight
// health endpoint lets a self-ping keep the process alive.
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ── Self-ping to prevent Render cold starts ─────────────────────────────
// Only runs in production so local dev isn't affected.
if (
  process.env.NODE_ENV === "production" &&
  (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL)
) {
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL!;
  const keepAliveIntervalMinutes =
    Number.parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES || "", 10) || 14;
  const KEEP_ALIVE_INTERVAL_MS = keepAliveIntervalMinutes * 60 * 1000;
  const healthUrl = `${keepAliveUrl.replace(/\/$/, "")}/api/health`;

  const ping = async () => {
    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        console.warn(`[keep-alive] Ping returned HTTP ${response.status}: ${healthUrl}`);
        return;
      }
      console.log("[keep-alive] Pinged", healthUrl);
    } catch (err) {
      console.warn("[keep-alive] Ping failed:", err);
    }
  };

  const interval = setInterval(ping, KEEP_ALIVE_INTERVAL_MS);
  interval.unref?.();
  const initialPing = setTimeout(ping, 10_000);
  initialPing.unref?.();

  console.log(
    `[keep-alive] Self-ping enabled every ${keepAliveIntervalMinutes} min -> ${healthUrl}`,
  );
}

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
