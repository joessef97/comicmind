/**
 * Standalone worker process. Run with `npm run worker`.
 *
 * This is the topology docker-compose uses: the API stays responsive while a
 * separate process does the slow image work. On Render's free tier, where
 * only one process is available, server.ts starts the same worker in-process
 * via WORKER_INLINE instead.
 */

import { connectDB } from "./config/db";
import { startPanelWorker } from "./jobs/panel.worker";
import { closeQueue, isQueueEnabled } from "./jobs/queue";
import { closeDb } from "./db";

async function main() {
  if (!isQueueEnabled()) {
    console.error("REDIS_URL is not set — a worker has nothing to consume.");
    process.exit(1);
  }

  // The worker writes panel results back to comic documents.
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
    await closeQueue();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
