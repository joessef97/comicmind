/**
 * Tab-close durability, end to end.
 *
 * The claim: a client that disappears mid-generation does not cancel the work,
 * and a client that comes back sees the finished comic. Everything here is
 * real — the Express app over real HTTP, a real SSE connection, a real
 * worker claiming and running the real `renderPanel`, real Mongo. Only the
 * OpenAI call is stubbed, because rendering an actual image proves nothing
 * about durability and costs money.
 *
 * "Closing the tab" is a socket destroy on the live SSE request, which is what
 * a browser does when its tab goes away.
 *
 * Needs a reachable Mongo; skips without one, runs in CI.
 */

import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.GENERATION_MODE = "queue";

const { connectTestMongo, disconnectTestMongo, dropTestMongo } = await import("../helpers/mongo");
const hasInfra = await connectTestMongo("comicmind-test-tabclose");

/** Each panel takes a beat, so there is a real window in which to vanish. */
const RENDER_MS = 300;

vi.mock("../../backend/src/services/ai.service", () => ({
  getImageProvider: () => ({
    generateImage: async ({ panelNumber }: { panelNumber: number }) => {
      await new Promise((r) => setTimeout(r, RENDER_MS));
      return {
        imageUrl: `https://cdn.test/panel-${panelNumber}.png`,
        meta: { model: "stub" },
      };
    },
  }),
}));

vi.mock("../../backend/src/services/image-storage", () => ({
  persistImage: async (url: string) => ({ url, publicId: "stub" }),
  persistImageBuffer: async () => ({ url: "https://cdn.test/buffer.png", publicId: "stub" }),
  isPersistedUrl: () => true,
  getUploadsRoot: () => "/tmp/uploads",
  getStorageProviderName: () => "stub",
  deleteComicImages: async () => {},
}));

const { app } = await import("../../backend/src/app");
const { startPanelWorker } = await import("../../backend/src/jobs/panel.worker");
const { GenerationJobModel } = await import("../../backend/src/jobs/job.model");
const { makeTestToken } = await import("../helpers/auth");

const userId = `tabclose-${Date.now()}`;
const token = makeTestToken(userId);

let server: http.Server;
let baseUrl: string;
let worker: ReturnType<typeof startPanelWorker>;

/** Opens the SSE stream and resolves once `after` events have arrived. */
function openStream(jobId: string, after: number) {
  return new Promise<{ close: () => void; events: string[] }>((resolve, reject) => {
    const events: string[] = [];
    const req = http.get(
      `${baseUrl}/api/jobs/${jobId}/events?token=${encodeURIComponent(token)}`,
      (res) => {
        if (res.statusCode !== 200) return reject(new Error(`SSE status ${res.statusCode}`));
        res.on("data", (chunk) => {
          events.push(chunk.toString());
          if (events.length >= after) {
            // destroy() severs the socket without a graceful close — a tab
            // being closed, not an EventSource shutting itself down.
            resolve({ close: () => req.destroy(), events });
          }
        });
      },
    );
    req.on("error", () => {});
  });
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function getJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: await response.json() };
}

describe.skipIf(!hasInfra)("tab close during generation", () => {
  beforeAll(async () => {
    await GenerationJobModel.deleteMany({});

    // A short poll keeps the suite quick; production defaults to 500ms.
    worker = startPanelWorker({ pollIntervalMs: 25 });
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await worker?.close();
    await dropTestMongo();
    await disconnectTestMongo();
    await new Promise((r) => server.close(r));
  });

  it("finishes the comic after the client disappears, and shows it on return", async () => {
    const panels = Array.from({ length: 5 }, (_, i) => ({
      description: `panel ${i}: a quiet street at dawn`,
    }));

    const start = await fetch(`${baseUrl}/api/jobs/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `tabclose-${Date.now()}`,
      },
      body: JSON.stringify({ panels, style: "noir" }),
    });

    expect(start.status).toBe(202);
    const { jobId } = await start.json();
    expect(jobId).toBeTruthy();

    // Watch until the job is genuinely mid-flight, then vanish.
    const stream = await openStream(jobId, 1);
    await waitFor(async () => {
      const { body } = await getJson(`/api/jobs/${jobId}`);
      return body.completedPanels >= 1 && body.completedPanels < panels.length;
    });

    stream.close();

    const midway = await getJson(`/api/jobs/${jobId}`);
    expect(midway.body.completedPanels).toBeLessThan(panels.length);

    // Nobody is listening now. The work must carry on regardless.
    const finished = await waitFor(async () => {
      const { body } = await getJson(`/api/jobs/${jobId}`);
      return body.status === "succeeded";
    });
    expect(finished).toBe(true);

    // A returning client sees every panel, rendered exactly once.
    const final = await getJson(`/api/jobs/${jobId}`);
    expect(final.body.completedPanels).toBe(panels.length);
    expect(final.body.panels).toHaveLength(panels.length);
    expect(final.body.panels.every((p: any) => p.status === "succeeded")).toBe(true);
    expect(final.body.panels.every((p: any) => p.imageUrl)).toBe(true);
    expect(final.body.panels.every((p: any) => p.attempts === 1)).toBe(true);
  }, 60_000);

  it("replays state to a client that reconnects mid-job", async () => {
    const panels = Array.from({ length: 4 }, (_, i) => ({
      description: `panel ${i}: a lighthouse in fog`,
    }));

    const start = await fetch(`${baseUrl}/api/jobs/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `reconnect-${Date.now()}`,
      },
      body: JSON.stringify({ panels, style: "noir" }),
    });
    const { jobId } = await start.json();

    const first = await openStream(jobId, 1);
    first.close();

    // A fresh connection must be told the current state immediately, not left
    // waiting for the next change it happens to be present for.
    const second = await openStream(jobId, 1);
    expect(second.events.join("")).toContain("event: progress");
    second.close();

    expect(
      await waitFor(async () => {
        const { body } = await getJson(`/api/jobs/${jobId}`);
        return body.status === "succeeded";
      }),
    ).toBe(true);
  }, 60_000);

  it("reports no active job once everything has settled", async () => {
    expect(
      await waitFor(async () => {
        const { body } = await getJson("/api/jobs/active");
        return body.job === null;
      }),
    ).toBe(true);
  }, 30_000);
});
