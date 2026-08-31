import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/services/ai.service", () => testMocks.aiService);
vi.mock("../../backend/src/services/image-storage", () => testMocks.imageStorage);
vi.mock("../../backend/src/modules/auth/auth.model", () => ({ UserModel: testMocks.userModel }));

describe("generation job endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    app = await loadTestApp();
  });

  beforeEach(() => {
    delete process.env.GENERATION_MODE;
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
  });

  it("rejects unauthenticated callers", async () => {
    const response = await request(app).post("/api/jobs/generate").send({});
    expect(response.status).toBe(401);
  });

  it("reports sync mode when queued generation is not enabled", async () => {
    // No REDIS_URL and no DATABASE_URL: the deployment cannot queue, and says
    // so rather than accepting work it will never run.
    const response = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        panels: [{ description: "a rooftop chase" }],
        style: "noir",
      });

    expect(response.status).toBe(503);
    expect(response.body.mode).toBe("sync");
  });

  it("does not queue when only half the infrastructure is present", async () => {
    // Redis without the ledger would leave rendered panels with nowhere to
    // record their outcome, so this must not be treated as queue-capable.
    process.env.GENERATION_MODE = "queue";
    process.env.REDIS_URL = "redis://localhost:6379";

    const response = await request(app)
      .post("/api/jobs/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ panels: [{ description: "x" }], style: "noir" });

    expect(response.status).toBe(503);
  });

  it("returns null for an active job when the ledger is disabled", async () => {
    const response = await request(app)
      .get("/api/jobs/active")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ job: null });
  });

  it("404s an unknown job rather than revealing whether it exists", async () => {
    const response = await request(app)
      .get("/api/jobs/6f1c9f0e-6a1a-4a3e-9f0e-2b7c1d8e5a44")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("requires panels and a style", async () => {
    process.env.GENERATION_MODE = "queue";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.DATABASE_URL = "postgres://localhost:5432/none";

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
});
