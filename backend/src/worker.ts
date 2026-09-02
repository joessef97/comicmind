/**
 * Standalone worker process. Run with `npm run worker`.
 *
 * This is the topology docker-compose uses: the API stays responsive while a
 * separate process does the slow image work. On Render's free tier, where
 * only one process is available, server.ts starts the same worker in-process
 * via WORKER_INLINE instead.
 */

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { startPanelWorker } from "./jobs/panel.worker";

async function main() {
  // The queue lives in Mongo alongside the comic content, so the connection
  // has to be up before the worker can claim anything.
  await connectDB();

  const worker = startPanelWorker();
  if (!worker) {
    console.error("Could not start the panel worker.");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, finishing in-flight panels...`);
    // close() waits for active jobs; anything still queued is picked up by the
    // next worker to start, which is what makes a restart mid-run safe.
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
