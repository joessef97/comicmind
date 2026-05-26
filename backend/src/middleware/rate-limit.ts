import { rateLimit } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

function benchmarkBypass(_req: Request, _res: Response, next: NextFunction) {
  next();
}

function createLimiter(options: Parameters<typeof rateLimit>[0]) {
  if (
    process.env.NODE_ENV !== "production" &&
    (process.env.BENCHMARK_MODE === "true" || process.env.DISABLE_RATE_LIMIT === "true")
  ) {
    return benchmarkBypass;
  }

  return rateLimit(options);
}

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { message: "AI generation limit reached. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
