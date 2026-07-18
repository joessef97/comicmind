import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/services/ai.service", () => testMocks.aiService);
vi.mock("../../backend/src/services/image-storage", () => testMocks.imageStorage);
vi.mock("../../backend/src/modules/auth/auth.model", () => ({ UserModel: testMocks.userModel }));

describe("comic endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    app = await loadTestApp();
  });

  it("generates a comic story through the real route", async () => {
    testMocks.aiService.generateStory.mockResolvedValue({
      panels: [
        { number: 1, description: "Scene 1", dialogue: "A: Hello", narration: "First beat" },
        { number: 2, description: "Scene 2", dialogue: "B: Go", narration: "Second beat" },
      ],
      characterSheet: {
        description: "Shared cast",
        characters: [{ name: "A", appearance: "Detective" }],
        setting: "City",
      },
    });

    const response = await request(app)
      .post("/api/comics/generate-story")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A lost signal",
        idea: "Two friends chase a missing satellite.",
        style: "noir",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Story generated successfully",
      characterSheet: {
        description: "Shared cast",
      },
    });
    expect(response.body.panels).toHaveLength(2);
  });

  it("saves a comic through the real route", async () => {
    testMocks.userModel.findById.mockResolvedValue({
      subscription: { status: "active" },
      usage: { monthlyComicLimit: 5, comicsGeneratedThisMonth: 1 },
    });
    testMocks.userModel.updateOne.mockResolvedValue({ acknowledged: true });
    testMocks.storage.createComic.mockResolvedValue({
      id: "comic-1",
      userId: "user-1",
      title: "A lost signal",
      style: "noir",
      idea: "Two friends chase a missing satellite.",
      panels: [{ number: 1, description: "Scene 1" }],
      published: false,
      shares: 0,
      downloads: 0,
    });

    const response = await request(app)
      .post("/api/comics")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "A lost signal",
        style: "noir",
        idea: "Two friends chase a missing satellite.",
        panels: [{ number: 1, description: "Scene 1", dialogue: "", narration: "" }],
        characterSheet: "A: Detective coat, silver glasses | Setting: Rainy city",
        characterRefUrl: "https://example.com/ref.png",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Comic saved successfully");
    expect(response.body.comic).toMatchObject({ id: "comic-1", userId: "user-1" });
    expect(testMocks.storage.createComic).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        characterSheet: "A: Detective coat, silver glasses | Setting: Rainy city",
        characterRefUrl: "https://example.com/ref.png",
      }),
    );
  });

  it("fetches the signed-in user's comics", async () => {
    testMocks.storage.getComicsByUser.mockResolvedValue([
      {
        id: "comic-1",
        userId: "user-1",
        title: "A lost signal",
        style: "noir",
        idea: "Two friends chase a missing satellite.",
        panels: [],
        published: false,
        shares: 0,
        downloads: 0,
      },
    ]);

    const response = await request(app)
      .get("/api/comics")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      limit: 10,
      offset: 0,
    });
    expect(response.body.comics).toHaveLength(1);
  });

  it("deletes a comic through the real route", async () => {
    testMocks.imageStorage.deleteComicImages.mockResolvedValue(1);
    testMocks.storage.deleteComic.mockResolvedValue(true);

    const response = await request(app)
      .delete("/api/comics/comic-1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Comic deleted successfully");
  });

  it("rejects unauthorized comic access", async () => {
    const response = await request(app).get("/api/comics");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("rejects invalid comic save requests", async () => {
    const response = await request(app)
      .post("/api/comics")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Missing panels", style: "noir", idea: "No panels provided" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("All fields are required");
  });

  it("rejects comic saves when the monthly usage limit is reached", async () => {
    testMocks.userModel.findById.mockResolvedValue({
      subscription: { status: "active" },
      usage: { monthlyComicLimit: 3, comicsGeneratedThisMonth: 3 },
    });

    const response = await request(app)
      .post("/api/comics")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Limit reached",
        style: "noir",
        idea: "No quota left",
        panels: [{ number: 1, description: "Scene 1", dialogue: "", narration: "" }],
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "Monthly limit reached. Upgrade your subscription or wait until your subscription renews.",
    );
    expect(testMocks.storage.createComic).not.toHaveBeenCalled();
  });
});
