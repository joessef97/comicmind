import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/services/storage.service", () => ({ storage: testMocks.storage }));
vi.mock("../../backend/src/modules/auth/auth.service", () => testMocks.authService);
vi.mock("../../backend/src/services/email.service", () => testMocks.emailService);

describe("auth endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;

  beforeAll(async () => {
    app = await loadTestApp();
  });

  it("registers a user through the real route", async () => {
    testMocks.storage.getUserByUsername.mockResolvedValue(undefined);
    testMocks.storage.getUserByEmail.mockResolvedValue(undefined);
    testMocks.authService.hashPassword.mockResolvedValue("hashed-password");
    testMocks.storage.createUser.mockResolvedValue({ id: "user-1", username: "alice" });
    testMocks.authService.generateToken.mockReturnValue("token-123");

    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "alice", email: "alice@example.com", password: "password123" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      message: "User created successfully",
      token: "token-123",
      user: { id: "user-1", username: "alice" },
    });
  });

  it("logs in a user through the real route", async () => {
    testMocks.storage.getUserByUsername.mockResolvedValue({
      id: "user-1",
      username: "alice",
      password: "hashed-password",
    });
    testMocks.authService.verifyPassword.mockResolvedValue(true);
    testMocks.authService.generateToken.mockReturnValue("token-abc");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Login successful",
      token: "token-abc",
      user: { id: "user-1", username: "alice" },
    });
  });

  it("rejects invalid registration payloads", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "ab", email: "alice@example.com", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Username must be at least 3 characters");
  });

  it("rejects invalid login credentials", async () => {
    testMocks.storage.getUserByUsername.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "missing", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });
});