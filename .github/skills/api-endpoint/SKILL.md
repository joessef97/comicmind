---
name: api-endpoint
description: "Scaffold a new API endpoint with proper middleware for ComicMind. Use when: adding a new route, endpoint, or API handler with auth, rate limiting, translation, or content safety middleware. USE FOR: new endpoint, new route, middleware wiring, REST API addition."
argument-hint: "Describe the endpoint (e.g., 'GET /api/comics/:id/stats', 'POST /api/reports with content safety')"
---

# API Endpoint + Middleware

Quickly scaffold a new API endpoint with the correct middleware chain for ComicMind.

## When to Use

- Adding a single new endpoint to an existing module
- Wiring up middleware (auth, rate limit, translation, content safety) for a route
- Creating a standalone endpoint that doesn't need a full feature module

## Middleware Reference

| Middleware | Import | Purpose | Use When |
|-----------|--------|---------|----------|
| `authenticateToken` | `../auth/auth.middleware` | JWT verification, sets `req.userId` | Any endpoint needing logged-in user |
| `authLimiter` | `../../middleware/rate-limit` | 20 req / 15 min | Auth endpoints (login, register) |
| `aiLimiter` | `../../middleware/rate-limit` | 20 req / 1 hour | AI generation endpoints |
| `autoTranslateInput` | `../../middleware/translation` | Arabic → English translation | Endpoints receiving user text for AI processing |
| `contentSafetyCheck` | `../../middleware/content-safety` | Azure content moderation | Endpoints receiving user-generated content for AI |

### Middleware Order

Always apply middleware in this order:

```
authenticateToken → rateLimiter → autoTranslateInput → contentSafetyCheck → handler
```

Skip any that don't apply, but never reorder.

## Procedure

### Step 1: Determine Middleware Stack

Answer these questions:
1. **Does the user need to be logged in?** → Add `authenticateToken`
2. **Is this a rate-sensitive operation?** → Add appropriate limiter
3. **Does it accept user text that goes to AI?** → Add `autoTranslateInput`
4. **Does user content need moderation?** → Add `contentSafetyCheck`

### Step 2: Write the Handler

Add to the relevant controller file (`backend/src/modules/<module>/<module>.controller.ts`):

```typescript
export async function handlerName(req: AuthRequest, res: Response) {
  try {
    // 1. Parse & validate input
    const id = String(req.params.id);
    const validation = validateInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    // 2. Check resource exists
    const resource = await Model.findById(id);
    if (!resource) {
      return res.status(404).json({ message: "Not found" });
    }

    // 3. Check authorization (if mutating)
    if (resource.userId !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 4. Perform operation
    const result = await Model.doSomething();

    // 5. Return response
    return res.status(200).json({ message: "Success", data: result });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ message: "Failed to process request" });
  }
}
```

**Handler checklist:**
- Use `AuthRequest` (protected) or `Request` (public)
- Validate all input from `req.body`, `req.params`, `req.query`
- Use `String(req.params.id)` for ID coercion
- Check existence before operations (404)
- Check ownership before mutations (403)
- Wrap in try-catch, log error, return generic 500

### Step 3: Register the Route

Add to the module's routes file:

```typescript
// For a new endpoint in existing module
router.post("/:id/action", authenticateToken, controller.handlerName);

// For AI-facing endpoint with full middleware chain
router.post(
  "/:id/generate",
  authenticateToken,
  aiLimiter,
  autoTranslateInput,
  contentSafetyCheck,
  controller.generateHandler,
);
```

### Step 4: Mount (if new routes file)

If this is a new routes file, register in `backend/src/app.ts`:

```typescript
import newRoutes from "./modules/<module>/<module>.routes";
app.use("/api/<resource>", newRoutes);
```

## Common Endpoint Patterns

### Public Read (no auth)
```typescript
router.get("/:id", controller.getById);
```

### Authenticated CRUD
```typescript
router.post("/", authenticateToken, controller.create);
router.get("/", authenticateToken, controller.list);
router.put("/:id", authenticateToken, controller.update);
router.delete("/:id", authenticateToken, controller.remove);
```

### Paginated List
```typescript
export async function listItems(req: AuthRequest, res: Response) {
  const page = Math.max(parseInt(String(req.query.page) || "1"), 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "20"), 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Model.countDocuments(filter),
  ]);

  return res.json({ data: items, total, page, limit });
}
```

### AI Generation Endpoint
```typescript
router.post(
  "/generate",
  authenticateToken,
  aiLimiter,
  autoTranslateInput,
  contentSafetyCheck,
  controller.generate,
);
```

### Nested Resource (e.g., comments on comics)
```typescript
// Mounted at /api/comics (parent resource path)
export const nestedRouter = Router();
nestedRouter.post("/:id/comments", authenticateToken, controller.addComment);
nestedRouter.get("/:id/comments", controller.getComments);
```

## Creating Custom Middleware

If you need a new middleware:

```typescript
import type { Request, Response, NextFunction } from "express";

export async function customMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Early exit if not applicable
    const { field } = req.body ?? {};
    if (!field) return next();

    // Process
    const result = await someService(field);

    // Augment request (declare type globally)
    req.customField = result;

    // Block if invalid
    if (!result.valid) {
      return res.status(400).json({ message: "Validation failed" });
    }
  } catch (error) {
    console.error("[middleware-name] Error:", error);
    // Decide: fail open (next()) or fail closed (return 500)
    return res.status(500).json({ message: "Service unavailable" });
  }

  next();
}
```

**Key rules:**
- Augment `Express.Request` via `declare global` for custom fields
- Early `return next()` when middleware doesn't apply
- Always try-catch — middleware must never throw
- Log with `[tag]` prefix for traceability
- Decide fail-open vs fail-closed based on security impact

### Creating a Rate Limiter

```typescript
import { rateLimit } from "express-rate-limit";

export const customLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // window in milliseconds
  max: 50,                      // max requests per window
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
```

## Verification

- [ ] Handler validates all user input
- [ ] Auth middleware on protected endpoints
- [ ] Rate limiter on expensive operations
- [ ] Content safety on user-generated content going to AI
- [ ] Correct HTTP status codes (200, 201, 400, 403, 404, 500)
- [ ] Response format: `{ message, data? }` or `{ data, total, page, limit }`
- [ ] Error logged with context, generic message to client
