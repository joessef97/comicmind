import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
    // Cold TS import of backend/src/app exceeds the 10s default on a cold machine.
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "frontend/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
