/**
 * Server-Sent Events for generation progress.
 *
 * Progress is read from the ledger rather than pushed from the worker. That
 * costs one indexed read per connection per tick, and buys two things worth
 * more than the saving: a client that reconnects gets the true current state
 * instead of only the events it was present for, and the API needs no
 * pub/sub coupling to the worker process. The ledger is the single source of
 * truth for what happened; this endpoint just reads it out loud.
 */

import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import * as jobService from "../../jobs/job.service";

const POLL_INTERVAL_MS = 1_000;
/** Stops an abandoned connection from polling forever if a job never settles. */
const MAX_STREAM_MS = 15 * 60 * 1_000;

interface JobSnapshot {
  status: string;
  completedPanels: number;
  totalPanels: number;
  panels: { panelNumber: number; status: string; imageUrl: string | null; error: string | null }[];
}

export async function streamGenerationJob(req: AuthRequest, res: Response) {
  const jobId = String(req.params.id);
  const job = await jobService.getJob(jobId);

  // Same 404 for missing and not-yours: a job id should not be probeable.
  if (!job || job.userId !== req.userId) {
    return res.status(404).json({ message: "Job not found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Render sits behind a proxy that will otherwise buffer the stream.
    "X-Accel-Buffering": "no",
  });

  let lastSerialized = "";
  let closed = false;

  const send = (event: string, data: unknown) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const readSnapshot = async (): Promise<JobSnapshot | null> => {
    const current = await jobService.getJob(jobId);
    if (!current) return null;

    const panels = await jobService.getJobPanels(jobId);
    return {
      status: current.status,
      completedPanels: current.completedPanels,
      totalPanels: current.totalPanels,
      panels: panels.map((p) => ({
        panelNumber: p.panelNumber,
        status: p.status,
        imageUrl: p.imageUrl,
        error: p.error,
      })),
    };
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    clearTimeout(deadline);
    res.end();
  };

  const tick = async () => {
    try {
      const snapshot = await readSnapshot();
      if (!snapshot) return cleanup();

      // Only emit on change: a six-panel job produces a handful of events, not
      // one per second.
      const serialized = JSON.stringify(snapshot);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        send("progress", snapshot);
      }

      if (jobService.isTerminal(snapshot.status as jobService.JobStatus)) {
        send("done", snapshot);
        cleanup();
      }
    } catch (err) {
      console.error(`[jobs] SSE tick failed for ${jobId}:`, err);
      cleanup();
    }
  };

  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  const deadline = setTimeout(cleanup, MAX_STREAM_MS);

  req.on("close", cleanup);

  // Replay current state immediately so a reconnecting client is never blind
  // for a full interval, and never misses what happened while it was away.
  await tick();
}
