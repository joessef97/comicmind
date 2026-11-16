import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

const jobMocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  findActiveJob: vi.fn(),
  getJob: vi.fn(),
  getJobPanels: vi.fn(),
  isTerminal: (status: string) => ["succeeded", "partial", "failed", "cancelled"].includes(status),
}));

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/services/ai.service", () => testMocks.aiService);
vi.mock("../../backend/src/services/image-storage", () => testMocks.imageStorage);
vi.mock("../../backend/src/modules/auth/auth.model", () => ({ UserModel: testMocks.userModel }));
vi.mock("../../backend/src/jobs/job.service", () => jobMocks);

describe("generation job endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");
  const job = {
    id: "6f1c9f0e6a1a4a3e9f0e2b7c",
    userId: "user-1",
    status: "queued",
    totalPanels: 1,
    completedPanels: 0,
    comicId: null,
    draftId: null,
  };

  beforeAll(async () => {
    app = await loadTestApp();
  });

  beforeEach(() => {
    jobMocks.createJob.mockResolvedValue({ job, reused: false });
    jobMocks.findActiveJob.mockResolvedValue(null);
    jobMocks.getJob.mockResolvedValue(null);
    jobMocks.getJobPanels.mockResolvedValue([]);
  });

  it("rejects unauthenticated callers", async () => {
    const response = await request(app).post("/api/jobs/generate").send({});
    expect(response.status).toBe(401);
  });

  it("persists generation work in MongoDB and returns a job id", async () => {
    const response = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "request-1")
      .send({
        panels: [{ description: "a rooftop chase" }],
        style: "noir",
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ jobId: job.id, status: "queued", totalPanels: 1 });
    expect(jobMocks.createJob).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      totalPanels: 1,
      idempotencyKey: "request-1",
      panelInputs: [{
        prompt: "a rooftop chase",
        style: "noir",
        characterSheet: undefined,
        characterRefUrl: undefined,
      }],
    }));
  });

  it("returns the existing job when an idempotency key is reused", async () => {
    jobMocks.createJob.mockResolvedValue({ job, reused: true });
    const response = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "request-1")
      .send({ panels: [{ description: "a rooftop chase" }], style: "noir" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ jobId: job.id, reused: true });
  });

  it("requires panels and a style", async () => {
    const missingPanels = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ style: "noir" });
    expect(missingPanels.status).toBe(400);

    const missingStyle = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ panels: [{ description: "x" }] });
    expect(missingStyle.status).toBe(400);
  });

  it("returns null for a user without an active job", async () => {
    const response = await request(app)
      .get("/api/jobs/active")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ job: null });
  });

  it("404s an unknown job rather than revealing whether it exists", async () => {
    const response = await request(app)
      .get(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
