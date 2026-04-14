import type { Request, Response, NextFunction } from "express";

export function ogMetaMiddleware(_req: Request, _res: Response, next: NextFunction) {
  // No-op placeholder to keep middleware chain intact when OG customization is absent.
  next();
}
