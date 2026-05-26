# ComicMind K6 Performance Tests

These scripts exercise the real ComicMind backend routes under controlled load.

## Real routes covered

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/user/subscription/activate`
- `POST /api/comics/generate-story`
- `POST /api/comics`
- `GET /api/comics`
- `DELETE /api/comics/:id`

The auth benchmark first tries the repository's seeded demo users from `script/seedUsers.ts` so the login load test uses a valid real account before falling back to a generated benchmark user.

## Installation

K6 is a separate CLI, not an npm package. The project includes a local installer that downloads the official Windows binary into `.tools/k6`:

```bash
npm run perf:install
```

You can also install it with one of the supported Windows options:

- `winget install k6 --source winget`
- `choco install k6`
- Download the latest official MSI from Grafana and install it

If you are running benchmark-style load tests against this backend locally, start the API with benchmark mode enabled so the built-in rate limiters do not block the test traffic:

```bash
npm run dev:benchmark
```

## Commands

```bash
npm run perf:auth
npm run perf:comic-generation
npm run perf:fetch-comics
npm run perf:delete-comic
```

Run all performance scripts in sequence:

```bash
npm run perf:all
```

## Environment variables

Set these when needed:

- `K6_BASE_URL` - API base URL, for example `http://127.0.0.1:5000`
- `K6_AUTH_USERNAME` - stable benchmark username
- `K6_AUTH_EMAIL` - stable benchmark email
- `K6_AUTH_PASSWORD` - stable benchmark password
- `K6_SUBSCRIPTION_PLAN` - comics limit to activate for the benchmark user
- `K6_SEED_COUNT` - number of comics to seed for fetch/delete tests
- `K6_BINARY` - optional override for a custom K6 executable path

## Metrics to read

- `http_req_duration` - average request time and tail latency
- `http_req_failed` - failed request percentage
- `http_reqs` - throughput, in requests per second
- `vus` - concurrent virtual users at runtime
- `iterations` - how many test loop executions ran

## Dissertation screenshots

- K6 terminal output for each script, showing the summary table
- Backend terminal output showing `BENCHMARK_MODE=true` and route logs
- A screenshot of the performance folder structure in VS Code
- A screenshot of a long-run summary with `http_req_duration`, `http_req_failed`, and `http_reqs`
