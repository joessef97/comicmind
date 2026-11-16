/**
 * Standalone worker process. Run with `npm run worker`.
 *
 * Run this process when WORKER_INLINE=false and a separate worker is desired.
 */

import { connectDB, disconnectDB } from "./config/db";
import { startPanelWorker } from "./jobs/panel.worker";

async function main() {
  // The MongoDB connection stores both jobs and comic content.
  await connectDB();
  const worker = startPanelWorker();

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, finishing in-flight panels...`);
    await worker.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
