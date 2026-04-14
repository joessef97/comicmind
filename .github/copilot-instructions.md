# ComicMind - Copilot Instructions

## Project Overview
ComicMind is a full-stack TypeScript monorepo — an AI-powered comic creation & sharing platform.

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4, Radix UI, Wouter (routing), React Query
- **Backend:** Express 5 + TypeScript, MongoDB + Mongoose, JWT auth
- **AI:** OpenAI (GPT for stories, DALL-E for images)
- **Services:** Azure Translator, Azure Content Safety, Cloudinary/local storage, Nodemailer

## Project Structure
- `shared/schema.ts` — Shared interfaces and validators (used by both frontend and backend)
- `backend/src/modules/<name>/` — Feature modules: controller, model, routes
- `backend/src/services/` — External service integrations (AI, storage, email)
- `backend/src/middleware/` — Express middleware (auth, rate-limit, translation, content-safety)
- `frontend/src/pages/` — Page components (one per route)
- `frontend/src/components/` — Reusable UI components

## Conventions
- Controllers use named async function exports (not classes)
- Protected routes use `AuthRequest` type (has `req.userId`)
- Validators return `{ valid: boolean; message?: string; value?: T }`
- Mongoose models define interface extending `Document`, then schema, then indexes, then export
- Frontend pages are default exports, use `@/` import alias
- Middleware logs with `[tag]` prefixes and fails gracefully
- Error responses follow `{ message: "..." }` format
- All API routes are mounted under `/api/` prefix
