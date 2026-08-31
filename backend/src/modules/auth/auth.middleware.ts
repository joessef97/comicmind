import { type Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Same check as authenticateToken, but also accepts `?token=`.
 *
 * Reserved for Server-Sent Events: the browser's EventSource API cannot set
 * request headers, so a bearer token has nowhere else to travel. Do not reuse
 * this on ordinary routes — tokens in query strings end up in access logs and
 * browser history, which is a cost worth paying only where there is no
 * alternative.
 */
export function authenticateStreamToken(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.headers.authorization && typeof req.query.token === "string") {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticateToken(req, res, next);
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}
