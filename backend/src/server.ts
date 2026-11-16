import { app } from "./app";
import { createServer } from "http";
import { connectDB } from "./config/db";
import { log } from "./utils/logger";
import { errorHandler } from "./middleware/error.middleware";
import { serveStatic } from "./static";
import { ogMetaMiddleware } from "./middleware/og-meta";

const httpServer = createServer(app);

(async () => {
  // Connect to MongoDB
  await connectDB();

  // Run the worker in this process by default. Set WORKER_INLINE=false only
  // when a separate `npm run worker` process is running against the same DB.
  if (process.env.WORKER_INLINE !== "false") {
    const { startPanelWorker } = await import("./jobs/panel.worker");
    startPanelWorker();
    log("MongoDB panel worker running in-process");
  }

  // Error handler (must come after routes, before vite/static catch-all)
  app.use(errorHandler);

  // OG meta tags for social media bots (before static/vite catch-all)
  app.use(ogMetaMiddleware);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
