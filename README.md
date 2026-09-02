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

## The generation pipeline

Rendering six panels takes minutes, so it does not belong on an HTTP request. Generation runs as a
**durable job**: the API enqueues work and returns immediately, a worker renders panels, and the browser
watches progress. Closing the tab does not cancel anything.

```
POST /api/jobs/generate         →  generation_jobs document (Mongo, atomic)
  + Idempotency-Key                 one unit of work per panel, on the panel itself
                                              ↓
                                    worker: claim → render → Cloudinary → Mongo (content)
                                                          → ledger update (Mongo)
                                              ↓
GET /api/jobs/:id/events (SSE)  ←   progress replayed on connect, then streamed
```

**MongoDB owns both comic content and job state**, in separate collections. The ledger lives in
`generation_jobs`, one document per generation with its panels embedded (`backend/src/jobs/job.model.ts`).
Embedding is what makes the guarantees below cheap: every ledger mutation touches exactly one document,
and single-document writes are atomic on any MongoDB deployment — no transactions, no replica set.

What the design buys, and how each property is enforced:

| Property | Mechanism |
|---|---|
| A double submit never renders twice | Partial unique index on `(userId, idempotencyKey)` — the loser of the insert race is served the winner's job |
| Redelivery never double-counts | The panel is claimed and `completedPanels` incremented by one update, guarded on the panel not already being `succeeded` |
| One bad panel doesn't lose the comic | One queue job per panel; 3 attempts with exponential backoff, then the job settles as `partial` rather than `failed` |
| Closing the tab doesn't cancel work | The worker is a separate process; `GET /api/jobs/active` re-attaches a returning client |
| A restarted worker resumes | Unclaimed panels are still on the job document; a claim left by a dead worker expires after `PANEL_VISIBILITY_TIMEOUT_MS` and is retried |
| One user can't exhaust everyone's quota | `aiLimiter` keys on the authenticated user, not the IP |

**There is no broker.** The queue is the ledger: a panel carries its own payload and claim state, and a
worker takes the next one with the same atomic update that marks it taken. That means one database and
one connection string for the whole pipeline. Set `GENERATION_MODE=queue` to use it; leave it unset and
the synchronous path runs instead, which is how the free-tier deployment runs today. Either way,
bookkeeping can never be the reason a comic fails to generate.

The trade against a broker is honest: workers poll rather than being pushed, so a panel starts within a
poll interval (`PANEL_WORKER_POLL_MS`, 500ms by default) instead of instantly, and a panel abandoned by a
crashed worker waits out the visibility timeout before anyone retries it.

### Running the real topology

```bash
docker compose up          # mongo, api, worker
```

To see the durability claim rather than take it on trust, start a comic and then:

```bash
docker compose stop worker     # mid-generation
docker compose start worker    # queued panels resume where they left off
```

Both durability claims are pinned by tests rather than left to a demo, and both run against a real
MongoDB in CI:

- `tests/jobs/worker-resume.integration.test.ts` — the first worker renders part of a job and shuts down,
  a second takes over the leftovers, and a third case runs two workers at once. Every panel is rendered
  exactly once in all of them.
- `tests/jobs/tab-close.integration.test.ts` — the real Express app over real HTTP with a real worker.
  A live SSE connection is destroyed mid-generation, the way a closing browser tab severs its socket.
  The remaining panels still render, and a returning client is served the finished comic.

On Render's free tier only one process is available, so `WORKER_INLINE=true` hosts the same worker inside
the API rather than deploying it separately.

## Architecture

Single TypeScript monorepo, one `package.json`, shared types across the wire:

```
frontend/     React 19 + Vite + Tailwind + Radix UI, TanStack Query for server state
backend/      Express API
  ├─ modules/     auth, comics, comments, drafts, ratings, users, jobs
  ├─ services/    AI generation, image provider, Cloudinary storage, email, PDF export
  ├─ jobs/        job ledger model + service, Mongo-backed queue, panel worker
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
| Database | MongoDB (Mongoose) — comic content and the generation job ledger |
| Queue | MongoDB — atomic claims on the job document, with a standalone worker process |
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

18 Vitest suites. `npm test` needs no external services — the API layer is tested with Supertest against
mocked storage and AI services, so the suite runs offline and without API keys.

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
| `tests/api/jobs.test.ts` | job endpoints: auth, validation, sync-mode fallback |
| `tests/content-filter.test.ts` | server-side filter rules |
| `tests/client-content-filter.test.ts` | client-side filter parity |
| `tests/draft-publish.test.ts` | draft → publish state transitions |
| `tests/panel-hooks.test.ts` | panel generation and retry hooks |
| `tests/ratings-comments.test.ts` | rating aggregation and comment threads |
| `tests/jobs/state-machine.test.ts` | legal and illegal job transitions |
| `tests/jobs/worker.test.ts` | retry semantics: a failure is recorded only once retries are exhausted |
| `tests/jobs/client-fallback.test.ts` | the client degrades quietly when queueing is unavailable |
| `tests/jobs/ledger-optional.test.ts` | every ledger call is a no-op with no database connection |
| `tests/jobs/worker-resume.integration.test.ts` | a stopped worker's queued panels are picked up by the next one |
| `tests/jobs/tab-close.integration.test.ts` | generation survives the client vanishing, end to end through the real app |
| `tests/jobs/*.integration.test.ts` | real MongoDB semantics: the partial unique index and the atomic claim (see below) |

The integration suites skip themselves when no `mongod` answers, which keeps `npm test` runnable on a
laptop with nothing installed. CI provides a `mongo:7` service container, so they always run there —
against a real partial unique index and real concurrent claims. Each suite connects to its own database,
because claiming is deliberately not scoped to one job: without that, test files running in parallel
would consume each other's panels.

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
| `MONGODB_URI` | MongoDB connection string (comic content and the job ledger) |
| `JWT_SECRET` | Token signing secret |
| `OPENAI_API_KEY` | Story and image generation |
| `CLOUDINARY_*` | Panel image hosting (cloud name, API key, secret) |
| `SMTP_*` | Password-reset email delivery |
| `GENERATION_MODE` | `queue` to use the durable pipeline; anything else keeps the synchronous path |
| `WORKER_INLINE` | `true` to host the worker inside the API (single-process deployments) |

The ledger needs no migration step — its collection and indexes are created on first use.

```bash
npm run worker          # only when running the worker as its own process
```

Build and run in production mode:

```bash
npm run build
npm start
```

## Further reading

[`BACKEND_README.md`](BACKEND_README.md) documents every API endpoint with request and response shapes.
