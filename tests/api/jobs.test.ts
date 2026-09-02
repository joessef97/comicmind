import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/services/ai.service", () => testMocks.aiService);
vi.mock("../../backend/src/services/image-storage", () => testMocks.imageStorage);
vi.mock("../../backend/src/modules/auth/auth.model", () => ({ UserModel: testMocks.userModel }));

/**
 * The ledger reports itself available whenever Mongo is connected, and these
 * tests deliberately run with no connection. Overriding just that one function
 * lets a test say "pretend the ledger is up" without standing up a database
 * the rest of the suite does not need.
 */
let ledgerEnabled = false;
vi.mock("../../backend/src/jobs/job.model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../backend/src/jobs/job.model")>();
  return { ...actual, isLedgerEnabled: () => ledgerEnabled };
});

describe("generation job endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    app = await loadTestApp();
  });

  beforeEach(() => {
    delete process.env.GENERATION_MODE;
    ledgerEnabled = false;
  });

  it("rejects unauthenticated callers", async () => {
    const response = await request(app).post("/api/jobs/generate").send({});
    expect(response.status).toBe(401);
  });

  it("reports sync mode when queued generation is not enabled", async () => {
    // GENERATION_MODE is unset: the deployment does not queue, and says so
    // rather than accepting work it will never run.
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

  it("does not queue without a database connection", async () => {
    // The queue lives in Mongo, so asking for queued generation with no
    // connection would leave rendered panels with nowhere to record their
    // outcome. It must not be treated as queue-capable.
    process.env.GENERATION_MODE = "queue";

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
      .get("/api/jobs/6f1c9f0e6a1a4a3e9f0e2b7c")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("404s a malformed job id rather than erroring", async () => {
    const response = await request(app)
      .get("/api/jobs/not-a-real-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("requires panels and a style", async () => {
    process.env.GENERATION_MODE = "queue";
    ledgerEnabled = true;

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
