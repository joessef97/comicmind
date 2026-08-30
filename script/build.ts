import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce cold start times
const allowlist = [
  "express",
  "express-rate-limit",
  "jsonwebtoken",
  "mongoose",
  "nanoid",
  "openai",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building frontend...");
  await viteBuild();

  console.log("building backend...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const shared = {
    platform: "node" as const,
    bundle: true,
    format: "cjs" as const,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info" as const,
  };

  await esbuild({
    ...shared,
    entryPoints: ["backend/src/server.ts"],
    outfile: "dist/index.cjs",
  });

  // Standalone worker entrypoint, used when the queue runs as its own process
  // rather than inline in the API (see backend/src/worker.ts).
  await esbuild({
    ...shared,
    entryPoints: ["backend/src/worker.ts"],
    outfile: "dist/worker.cjs",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
