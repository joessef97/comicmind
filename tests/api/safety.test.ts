import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/services/ai.service", () => testMocks.aiService);

describe("content safety filtering", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    app = await loadTestApp();
  });

  it("blocks banned words before story generation runs", async () => {
    const response = await request(app)
      .post("/api/comics/generate-story")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A peaceful scene",
        idea: "The hero plans a murder in the alley.",
        style: "noir",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Blocked by banned-content rule");
    expect(testMocks.aiService.generateStory).not.toHaveBeenCalled();
  });
});