import { beforeAll, afterEach, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "vitest-secret";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/comicmind-test";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "vitest-openai-key";
process.env.PORT = process.env.PORT || "5001";
process.env.SMTP_HOST = process.env.SMTP_HOST || "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT || "2525";
process.env.SMTP_USER = process.env.SMTP_USER || "test@comicmind.app";
process.env.SMTP_PASS = process.env.SMTP_PASS || "test-password";
process.env.SMTP_FROM = process.env.SMTP_FROM || "ComicMind <test@comicmind.app>";
process.env.APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5001";

afterEach(() => {
  vi.clearAllMocks();
});