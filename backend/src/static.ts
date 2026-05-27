import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  // Use process.cwd() because esbuild bundles to CJS where import.meta is empty.
  // In production the cwd is the project root, so dist/public resolves correctly.
  const publicDir = path.resolve(process.cwd(), "dist", "public");

  app.use(express.static(publicDir));

  // SPA fallback for client-side routing.
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(publicDir, "index.html"));
  });
}
