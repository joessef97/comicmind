import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  const publicDir = path.resolve(import.meta.dirname, "..", "..", "dist", "public");

  app.use(express.static(publicDir));

  // SPA fallback for client-side routing.
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(publicDir, "index.html"));
  });
}
