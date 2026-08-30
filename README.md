# ComicMind

[![CI](https://github.com/joessef97/comicmind/actions/workflows/ci.yml/badge.svg)](https://github.com/joessef97/comicmind/actions/workflows/ci.yml)

A full-stack platform that turns a one-line idea into a multi-panel comic story — generating the script,
then rendering every panel with a **consistent character design across panels**, which is the hard part of
the problem and the thing most AI comic tools get wrong.

**Live demo:** https://comicmind.onrender.com/

Built as a final-year graduation project at The British University in Egypt (2025–2026).

---

## What's interesting here

Panel-by-panel image generation is stateless — the image model has no memory of what your protagonist
looked like in panel 1 when it draws panel 4. ComicMind solves this by generating a **character reference
sheet** first, then passing it back into every subsequent panel request as a visual anchor via the images
`edit` endpoint (`backend/src/services/openai-image-service.ts`).

The generation pipeline is also **fault-tolerant by design**: panels are generated independently, so one
failed panel doesn't abort a six-panel comic. Failed panels come back carrying an `error` field and can be
regenerated individually through `POST /api/comics/retry-panel`.

## Architecture

Single TypeScript monorepo, one `package.json`, shared types across the wire:

```
frontend/     React 19 + Vite + Tailwind + Radix UI, TanStack Query for server state
backend/      Express API
  ├─ modules/     auth, comics, comments, drafts, ratings, users
  ├─ services/    AI generation, image provider, Cloudinary storage, email, PDF export
  ├─ middleware/  JWT auth, content safety, rate limiting, error handling
  └─ config/      centralized env + Mongoose connection
shared/       Types shared between client and server
tests/        Vitest suites (see below)
performance/  K6 load tests against the real routes
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query, Framer Motion |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcrypt, with email-based password reset |
| AI | OpenAI — `gpt-4` for story generation, `gpt-image-2` for panel rendering |
| Media | Cloudinary, `sharp` for processing, `pdfkit` for comic export |
| Testing | Vitest, Supertest |
| Performance | K6 |

## Features

- JWT authentication with bcrypt hashing and an SMTP password-reset flow
- Story generation from a title, idea, and one of five art styles (`anime`, `realistic`, `cartoon`, `noir`, `comic`)
- Character-consistent panel rendering via a generated reference sheet
- Independent panel generation with per-panel retry — a partial failure never loses the comic
- Content safety filtering on titles and story ideas, enforced as middleware
- Draft/publish workflow, public gallery, ratings and comments
- Comic export to PDF, share and download counters
- Per-route rate limiting

## Testing

Eight Vitest suites, 79 tests, no external services required — the API layer is tested with Supertest
against mocked storage and AI services, so the suite runs offline and without API keys.

```bash
npm test          # full suite
npm run test:api  # API/route tests only
npm run check     # tsc type check
```

| Suite | Covers |
|---|---|
| `tests/api/auth.test.ts` | registration, login, password reset |
| `tests/api/comics.test.ts` | comic CRUD and generation routes |
| `tests/api/safety.test.ts` | content filter enforcement at the route layer |
| `tests/content-filter.test.ts` | server-side filter rules |
| `tests/client-content-filter.test.ts` | client-side filter parity |
| `tests/draft-publish.test.ts` | draft → publish state transitions |
| `tests/panel-hooks.test.ts` | panel generation and retry hooks |
| `tests/ratings-comments.test.ts` | rating aggregation and comment threads |

Both the type check and the full suite run on every push via GitHub Actions.

## Performance

K6 scripts in `performance/k6/` exercise the real backend routes under controlled load —
registration, login, subscription activation, story generation, comic create/list/delete.

```bash
npm run perf:install   # downloads the K6 binary into .tools/k6
npm run perf:auth
npm run perf:all
```

See [`performance/README.md`](performance/README.md) for what each scenario drives and how the load
profiles are shaped.

## Running locally

Requires Node 20+ and a MongoDB instance (local or Atlas).

```bash
npm install
cp .env.example .env    # then fill in the values below
npm run dev             # API on :5000
npm run dev:frontend    # Vite dev server
```

Environment variables (see `backend/src/config/env.ts` for the full list and defaults):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret |
| `OPENAI_API_KEY` | Story and image generation |
| `CLOUDINARY_*` | Panel image hosting (cloud name, API key, secret) |
| `SMTP_*` | Password-reset email delivery |

Build and run in production mode:

```bash
npm run build
npm start
```

## Further reading

[`BACKEND_README.md`](BACKEND_README.md) documents every API endpoint with request and response shapes.
