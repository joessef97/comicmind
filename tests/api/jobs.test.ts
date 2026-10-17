import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";

const mocks = vi.hoisted(() => ({
  jobModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  worker: { wake: vi.fn() },
}));

vi.mock("../../backend/src/modules/jobs/job.model", () => ({ GenerationJobModel: mocks.jobModel }));
vi.mock("../../backend/src/modules/jobs/job.worker", () => ({ generationJobWorker: mocks.worker }));
vi.mock("../../backend/src/services/image-storage", async () => {
  const path = await import("path");
  return {
    getUploadsRoot: () => path.resolve(process.cwd(), "uploads"),
    getStorageProviderName: () => "local-disk",
  };
});

describe("generation job endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    app = await loadTestApp();
  });

  it("keeps the job available to the worker after the client receives and closes its 202 response", async () => {
    mocks.jobModel.create.mockResolvedValue({
      _id: "job-1", userId: "user-1", title: "Signal", style: "noir", idea: "Lost satellite",
      status: "pending", panels: [{ number: 1, description: "Roof", status: "pending", attempts: 0 }],
      progress: { completed: 0, total: 1 },
    });

    const response = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Signal", style: "noir", idea: "Lost satellite",
        panels: [{ number: 1, description: "A detective on a roof", dialogue: "", narration: "" }],
      });

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBe("job-1");
    expect(mocks.jobModel.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1", status: "pending", progress: { completed: 0, total: 1 },
    }));
    expect(mocks.worker.wake).toHaveBeenCalledOnce();
  });

  it("only returns a job owned by the signed-in user", async () => {
    mocks.jobModel.findOne.mockResolvedValue(null);
    const response = await request(app).get("/api/jobs/other-users-job").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(mocks.jobModel.findOne).toHaveBeenCalledWith({ _id: "other-users-job", userId: "user-1" });
  });

  it("cancels only an active owned job", async () => {
    mocks.jobModel.findOneAndUpdate.mockResolvedValue({
      _id: "job-1", userId: "user-1", title: "Signal", status: "cancelled", panels: [], progress: { completed: 0, total: 1 },
    });
    const response = await request(app).delete("/api/jobs/job-1").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.job.status).toBe("cancelled");
  });
});
