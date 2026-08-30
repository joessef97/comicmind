import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/src/db/schema.ts",
  out: "./backend/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://comicmind:comicmind@localhost:5432/comicmind",
  },
  strict: true,
  verbose: true,
});
