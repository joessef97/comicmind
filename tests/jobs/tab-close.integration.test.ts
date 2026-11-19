import express from "express";
import { createServer, type Server } from "http";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthRequest } from "../../backend/src/modules/auth/auth.middleware";

const generateImage = vi.hoisted(() => vi.fn());

vi.mock("../../backend/src/services/ai.service", () => ({
  getImageProvider: () => ({ generateImage }),
}));

vi.mock("../../backend/src/services/image-storage", () => ({
  isPersistedUrl: () => true,
  persistImage: vi.fn(),
  persistImageBuffer: vi.fn(),
}));

import { GenerationJobModel } from "../../backend/src/jobs/job.model";
import * as jobService from "../../backend/src/jobs/job.service";
import { startPanelWorker } from "../../backend/src/jobs/panel.worker";
import { streamGenerationJob } from "../../backend/src/modules/jobs/job.events";

const userId = `tab-close-${crypto.randomUUID()}`;
let mongoConnected = false;
let server: Server | undefined;

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must point to a real MongoDB instance for integration tests");
  await mongoose.connect(uri);
  mongoConnected = true;
}, 30_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  if (!mongoConnected) return;
  await GenerationJobModel.deleteMany({ userId });
  await mongoose.disconnect();
});

describe("MongoDB tab disconnect integration", () => {
  it("keeps generation running after an SSE client disconnects", async () => {
    let releaseGeneration!: () => void;
    let reportGenerationStarted!: () => void;
    const generationStarted = new Promise<void>((resolve) => { reportGenerationStarted = resolve; });
    const generationGate = new Promise<void>((resolve) => { releaseGeneration = resolve; });
    generateImage.mockImplementation(async () => {
      reportGenerationStarted();
      await generationGate;
      return { imageUrl: "https://images.example/panel-after-disconnect.png", meta: {} };
    });

    const { job } = await jobService.createJob({
      userId,
      totalPanels: 1,
      panelInputs: [{ prompt: "a hero opens the map", style: "anime" }],
    });

    const app = express();
    app.get("/jobs/:id/events", (req, _res, next) => {
      (req as AuthRequest).userId = userId;
      next();
    }, streamGenerationJob);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not bind test SSE server");

    const worker = startPanelWorker();
    const controller = new AbortController();
    try {
      const startedResponse = await fetch(`http://127.0.0.1:${address.port}/jobs/${job.id}/events`, {
        signal: controller.signal,
      });
      expect(startedResponse.headers.get("content-type")).toContain("text/event-stream");
      await generationStarted;

      const reader = startedResponse.body?.getReader();
      if (!reader) throw new Error("SSE response has no body");
      const firstEvent = await reader.read();
      expect(new TextDecoder().decode(firstEvent.value)).toContain('event: progress');

      controller.abort();
      releaseGeneration();

      const deadline = Date.now() + 10_000;
      let current = await jobService.getJob(job.id);
      while (current?.status !== "succeeded" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        current = await jobService.getJob(job.id);
      }

      const [panel] = await jobService.getJobPanels(job.id);
      expect(current?.status).toBe("succeeded");
      expect(panel).toMatchObject({
        status: "succeeded",
        imageUrl: "https://images.example/panel-after-disconnect.png",
      });
    } finally {
      controller.abort();
      releaseGeneration();
      await worker.close();
    }
  }, 20_000);
});
