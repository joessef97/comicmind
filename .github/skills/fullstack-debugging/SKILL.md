---
name: fullstack-debugging
description: "Systematic debugging workflow for ComicMind full-stack issues. Use when: diagnosing errors across frontend, API, services, or database layers. USE FOR: bug fix, error diagnosis, 500 error, API failure, blank page, data not showing, generation failure, auth problems, debugging."
argument-hint: "Describe the symptom (e.g., 'comics not loading on browse page', '500 on story generation', 'login fails silently')"
---

# Full-Stack Debugging

Systematic approach for diagnosing and fixing issues across the ComicMind stack: Frontend (React) → API (Express) → Services (AI/Storage) → Database (MongoDB).

## When to Use

- API returns unexpected status codes (500, 403, 404)
- Frontend shows blank/loading state indefinitely
- AI generation fails or produces unexpected results
- Auth/login issues
- Data not persisting or not displaying
- Middleware blocking requests unexpectedly

## Architecture Quick Reference

```
Frontend (React + Vite)        → fetch("/api/...")      → Backend (Express)
                                                             │
                                            ┌────────────────┼────────────────┐
                                            │                │                │
                                      Middleware       Controllers       Services
                                      (auth, rate,    (modules/)        (ai, storage,
                                       translate,                        email, cloud)
                                       safety)              │
                                                            │
                                                       MongoDB (Mongoose)
```

**Key log locations:**
- Backend logs: terminal running `npm run dev` (port 5000)
- Frontend dev: browser console + Vite terminal (port 5173)
- Request logging: all `/api/*` requests logged with duration + response in backend

## Procedure

### Phase 1: Reproduce & Isolate the Layer

**Goal:** Determine which layer is failing.

1. **Check the browser Network tab** — look at the failing request:
   - What URL is being called?
   - What status code is returned?
   - What's in the response body?
   - What's in the request body/headers?

2. **Isolate the layer:**

| Symptom | Layer to investigate first |
|---------|--------------------------|
| No network request fired | Frontend (component/fetch logic) |
| Request sent, 401/403 returned | Auth middleware or token handling |
| Request sent, 400 returned | Input validation (shared schema or middleware) |
| Request sent, 429 returned | Rate limiter (`middleware/rate-limit.ts`) |
| Request sent, 500 returned | Controller or service error |
| Request sent, 200 but wrong data | Controller query logic or model |
| Request hangs / timeout | External service (OpenAI, Azure, Cloudinary) |
| CORS error | Vite proxy config or Express CORS setup |

### Phase 2: Investigate by Layer

#### Frontend Issues

**Files to check:**
- Page component: `frontend/src/pages/<page>.tsx`
- App router: `frontend/src/App.tsx` (is the route registered?)
- API client: look for `fetch("/api/...")` calls in the component
- Auth hook: `frontend/src/hooks/use-auth.tsx`

**Common problems:**
- Missing `credentials: "include"` on fetch (cookies not sent)
- Not handling non-ok responses (only checking `res.ok`)
- State not updating (missing dependency in `useEffect`)
- Route not registered in `App.tsx` Switch
- Import alias wrong (`@/` should map to `frontend/src/`)

#### Auth / Middleware Issues

**Files to check:**
- `backend/src/modules/auth/auth.middleware.ts` — JWT verification
- `backend/src/middleware/rate-limit.ts` — rate limit config
- `backend/src/middleware/content-safety.ts` — content moderation
- `backend/src/middleware/translation.ts` — Arabic translation

**Common problems:**
- Token expired (JWT has 7-day expiry)
- `authenticateToken` not applied to route (check routes file)
- Rate limiter too aggressive for development (reset by restarting server)
- Content safety blocking legitimate content (check moderation categories)
- Translation middleware failing silently (continues with original text)

**Debugging middleware chain:**
```
Route file → check middleware order: auth → rate → translate → safety → handler
```
Each middleware logs with a `[tag]` prefix. Search backend logs for:
- `[auth]` — authentication issues
- `[rate-limit]` — rate limiting
- `[translator-middleware]` — translation failures
- `[content-safety]` — moderation blocks

#### Controller / Service Issues

**Files to check:**
- Controller: `backend/src/modules/<module>/<module>.controller.ts`
- AI service: `backend/src/services/ai.service.ts`
- Image service: `backend/src/services/openai-image-service.ts`
- Storage: `backend/src/services/storage.service.ts`

**Common problems:**
- Validation rejecting valid input (check `shared/schema.ts` validator)
- `req.userId` undefined (missing `authenticateToken` middleware)
- Mongoose query returning wrong results (check filter, sort, populate)
- AI service timeout (OpenAI can take 30-60s for image generation)
- Storage service not configured (check env vars in `backend/src/config/env.ts`)

**Debugging approach:**
1. Read the error in backend terminal logs
2. Find the controller function being called
3. Add/check `console.error` in the catch block — does it show the real error?
4. If the error is in an external service, check env vars and API keys

#### Database Issues

**Files to check:**
- Model: `backend/src/modules/<module>/<module>.model.ts`
- DB config: `backend/src/config/db.ts`
- Schema validators: `shared/schema.ts`

**Common problems:**
- Mongoose validation error (schema constraints not matching input)
- Duplicate key error (unique index violation)
- Connection failed (check `MONGODB_URI` env var)
- ObjectId cast error (invalid ID format in `req.params.id`)
- Missing index causing slow queries

### Phase 3: Fix & Verify

1. **Make the minimal fix** — change only what's needed
2. **Test the fix:**
   - Backend: restart dev server if needed (`npm run dev`)
   - Frontend: Vite HMR should auto-reload
   - Run relevant tests: `npm test -- --grep "pattern"`
3. **Check for related issues** — if a validator was wrong, check all endpoints using it
4. **Verify the full flow** — test from the UI, not just the API

### Phase 4: AI Generation Specific Debugging

Comic generation has a complex multi-step flow. If generation fails:

1. **Story generation fails:**
   - Check OpenAI API key (`OPENAI_API_KEY` in env)
   - Check the prompt being sent (log it in `ai.service.ts`)
   - Check rate limits on OpenAI account
   - Verify response parsing (AI may return unexpected JSON structure)

2. **Image generation fails:**
   - Check DALL-E specific limits (content policy, image size)
   - Individual panel retry should work — check if the panel description triggers content policy
   - Check that CharacterSheet is being passed correctly

3. **Post-processing fails:**
   - Translation: Azure Translator key/endpoint configured?
   - Storage: Cloudinary or local disk — check provider config
   - Content safety post-check: may flag generated content

**Generation flow to trace:**
```
POST /api/comics/generate-story
  → auth → rate limit → translate → content safety
  → generateStory(title, idea, style)  [ai.service.ts]
  → returns panels with descriptions

POST /api/comics/generate-images
  → auth → rate limit
  → generatePanelImages(panels, style)  [image-provider.ts → openai-image-service.ts]
  → stores images  [storage.service.ts]
  → returns panels with imageUrls
```

## Environment Variables Checklist

When debugging service failures, verify these are set in the environment:

| Variable | Service | Required For |
|----------|---------|-------------|
| `MONGODB_URI` | MongoDB | Database connection |
| `JWT_SECRET` | Auth | Token signing/verification |
| `OPENAI_API_KEY` | OpenAI | Story + image generation |
| `AZURE_TRANSLATOR_KEY` | Azure | Arabic translation |
| `AZURE_TRANSLATOR_ENDPOINT` | Azure | Arabic translation |
| `AZURE_CONTENT_SAFETY_KEY` | Azure | Content moderation |
| `AZURE_CONTENT_SAFETY_ENDPOINT` | Azure | Content moderation |
| `CLOUDINARY_URL` | Cloudinary | Cloud image storage |
| `SMTP_*` | Email | Password reset emails |

Check config in `backend/src/config/env.ts` for exact variable names and defaults.

## Quick Diagnosis Commands

```bash
# Run tests for a specific module
npm test -- --grep "ratings"

# Check if backend starts
npm run dev

# Seed demo data for testing
npm run seed:demo

# Check environment
node -e "console.log(process.env.OPENAI_API_KEY ? 'Set' : 'Missing')"
```
