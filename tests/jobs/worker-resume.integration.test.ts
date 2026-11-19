import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

const userId = `worker-resume-${crypto.randomUUID()}`;
let mongoConnected = false;

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must point to a real MongoDB instance for integration tests");
  await mongoose.connect(uri);
  mongoConnected = true;
}, 30_000);

afterAll(async () => {
  if (!mongoConnected) return;
  await GenerationJobModel.deleteMany({ userId });
  await mongoose.disconnect();
});

describe("MongoDB worker resume integration", () => {
  it("reclaims an expired panel lease after a worker restart and persists the result", async () => {
    generateImage.mockResolvedValue({ imageUrl: "https://images.example/panel.png", meta: {} });

    const { job } = await jobService.createJob({
      userId,
      totalPanels: 1,
      panelInputs: [{ prompt: "a hero finds a map", style: "noir" }],
    });

    // The first process claimed the panel and then exited before writing a result.
    const firstClaim = await jobService.claimNextPanel();
    expect(firstClaim).toMatchObject({ jobId: job.id, panelNumber: 0, attempts: 1 });
    await GenerationJobModel.updateOne(
      { _id: job.id, "panels.panelNumber": 0 },
      { $set: { "panels.$.leaseUntil": new Date(Date.now() - 1_000) } },
    );

    const restartedWorker = startPanelWorker();
    try {
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
        attempts: 2,
        imageUrl: "https://images.example/panel.png",
      });
      expect(generateImage).toHaveBeenCalledTimes(1);
    } finally {
      await restartedWorker.close();
    }
  }, 20_000);
});
