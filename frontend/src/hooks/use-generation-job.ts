/**
 * Client for the queued generation pipeline.
 *
 * The browser stops being responsible for rendering panels: it asks the server
 * to start a job, then watches the ledger over SSE. Closing the tab no longer
 * cancels anything, and reopening the editor re-attaches to work in flight.
 *
 * Falls back cleanly when the deployment cannot queue — `startGenerationJob`
 * returns null and the caller keeps using the synchronous path.
 */

/**
 * Deliberately not apiRequest: that helper throws on any non-2xx, and a 503
 * here is a routine "this deployment cannot queue" that we want to inspect
 * rather than catch. It also has no way to set an Idempotency-Key header.
 */
async function jobFetch(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { ...extraHeaders };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
}

export interface JobPanelState {
  panelNumber: number;
  status: "pending" | "running" | "succeeded" | "failed";
  imageUrl: string | null;
  error: string | null;
}

export interface JobSnapshot {
  status: "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
  completedPanels: number;
  totalPanels: number;
  panels: JobPanelState[];
}

export interface StartJobInput {
  panels: { description: string }[];
  style: string;
  comicId?: string | null;
  draftId?: string | null;
  characterSheet?: string;
  characterRefUrl?: string;
}

const TERMINAL = ["succeeded", "partial", "failed", "cancelled"];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.includes(status);
}

/**
 * Starts a queued job. Returns null when the server reports it cannot queue
 * (503), which is the signal to fall back rather than an error worth showing.
 *
 * The idempotency key means a retried submit — a flaky network, an impatient
 * double click — attaches to the original job instead of paying twice.
 */
export async function startGenerationJob(
  input: StartJobInput,
  idempotencyKey: string,
): Promise<string | null> {
  try {
    const response = await jobFetch("POST", "/api/jobs/generate", input, {
      "Idempotency-Key": idempotencyKey,
    });

    if (response.status === 503) return null;
    if (!response.ok) return null;

    const data = await response.json();
    return data.jobId ?? null;
  } catch (err) {
    console.warn("[jobs] Could not start queued generation, falling back:", err);
    return null;
  }
}

/** The caller's unfinished job for this draft/comic, if any. */
export async function findActiveJob(scope: {
  comicId?: string | null;
  draftId?: string | null;
}): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    if (scope.comicId) params.set("comicId", scope.comicId);
    if (scope.draftId) params.set("draftId", scope.draftId);

    const response = await jobFetch("GET", `/api/jobs/active?${params.toString()}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.job?.id ?? null;
  } catch {
    return null;
  }
}

export interface WatchHandlers {
  onProgress: (snapshot: JobSnapshot) => void;
  onDone: (snapshot: JobSnapshot) => void;
  onError: (message: string) => void;
}

/**
 * Subscribes to a job's progress. Returns an unsubscribe function.
 *
 * EventSource cannot carry an Authorization header, so the token travels as a
 * query parameter here; the route authenticates it the same way either path.
 */
export function watchGenerationJob(
  jobId: string,
  token: string,
  handlers: WatchHandlers,
): () => void {
  const source = new EventSource(
    `/api/jobs/${encodeURIComponent(jobId)}/events?token=${encodeURIComponent(token)}`,
  );

  let settled = false;

  source.addEventListener("progress", (event) => {
    try {
      handlers.onProgress(JSON.parse((event as MessageEvent).data));
    } catch (err) {
      console.error("[jobs] Malformed progress event:", err);
    }
  });

  source.addEventListener("done", (event) => {
    try {
      settled = true;
      handlers.onDone(JSON.parse((event as MessageEvent).data));
    } catch (err) {
      console.error("[jobs] Malformed done event:", err);
    } finally {
      source.close();
    }
  });

  source.onerror = () => {
    // EventSource reconnects on its own; only a drop before the job settled
    // is worth surfacing, and only once.
    if (settled) return;
    if (source.readyState === EventSource.CLOSED) {
      handlers.onError("Lost connection to the generation job.");
    }
  };

  return () => {
    settled = true;
    source.close();
  };
}
