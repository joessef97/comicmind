/**
 * Centralized Environment Configuration
 * ──────────────────────────────────────
 * Single source of truth for all environment variables.
 */

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),

  // Database
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/comicmind",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  // Email / SMTP
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587"),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "",
  APP_BASE_URL: process.env.APP_BASE_URL || "",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  get isProduction() {
    return this.NODE_ENV === "production";
  },
} as const;
