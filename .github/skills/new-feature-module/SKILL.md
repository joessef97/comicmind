---
name: new-feature-module
description: "Scaffold a new full-stack feature module for ComicMind. Use when: adding a new backend module (controller/model/routes), frontend page, shared schema — following existing conventions. USE FOR: new CRUD resource, new entity, new API feature."
argument-hint: "Name of the new feature module (e.g., 'notifications', 'collections', 'bookmarks')"
---

# New Feature Module

Scaffold a complete full-stack feature module in the ComicMind monorepo, following established patterns exactly.

## When to Use

- Adding a new backend CRUD resource (e.g., notifications, bookmarks, collections)
- Creating a new entity that needs model + controller + routes + frontend page
- Extending the platform with a new feature that touches all layers

## Pre-Flight Checklist

Before starting, confirm:
1. **Module name** — singular noun, lowercase (e.g., `bookmark`, `notification`)
2. **Fields** — what data does this entity store?
3. **Auth required?** — which endpoints need authentication?
4. **Nested under existing resource?** — e.g., bookmarks under `/api/comics/:id/bookmarks`
5. **Frontend page needed?** — or just API-only?

## Procedure

### Step 1: Shared Schema (`shared/schema.ts`)

Add to the shared schema file following the section-comment pattern:

```typescript
// ── ModuleName ────────────────────────────────────────

export interface InsertModuleName {
  // Only user-provided fields (no id, userId, timestamps)
  field: string;
}

export interface ModuleName {
  id: string;
  userId: string;
  field: string;
  createdAt: Date;
  updatedAt?: Date;
}

export function validateModuleNameInput(data: any): {
  valid: boolean;
  message?: string;
  value?: InsertModuleName;
} {
  const { field } = data || {};

  if (!field || typeof field !== "string") {
    return { valid: false, message: "Field is required" };
  }

  return { valid: true, value: { field } };
}
```

**Conventions:**
- `Insert*` interface = user-provided fields only
- Full interface includes `id`, `userId`, `createdAt`, `updatedAt`
- Validator returns `{ valid, message?, value? }` union
- Check existence AND type: `!field || typeof field !== "string"`

### Step 2: Mongoose Model (`backend/src/modules/<name>/<name>.model.ts`)

Create the model file:

```typescript
import mongoose, { Schema, Document } from "mongoose";

// ── ModuleName ────────────────────────────────────────

export interface IModuleName extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  field: string;
  createdAt: Date;
  updatedAt?: Date;
}

const moduleNameSchema = new Schema<IModuleName>(
  {
    userId: { type: String, required: true },
    field: { type: String, required: true, maxlength: 200 },
  },
  {
    timestamps: true,
  }
);

// Indexes after schema definition
moduleNameSchema.index({ userId: 1 });

export const ModuleNameModel = mongoose.model<IModuleName>("ModuleName", moduleNameSchema);
```

**Conventions:**
- Interface extends `Document` with explicit `_id: mongoose.Types.ObjectId`
- Schema constraints mirror shared validator (maxlength, min, max)
- `timestamps: true` for auto `createdAt`/`updatedAt`
- Indexes AFTER schema, never inline
- Unique compound indexes where needed (e.g., one per user per resource)

### Step 3: Controller (`backend/src/modules/<name>/<name>.controller.ts`)

```typescript
import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { ModuleNameModel } from "./<name>.model";
import { validateModuleNameInput } from "@shared/schema";

export async function createModuleName(req: AuthRequest, res: Response) {
  try {
    const validation = validateModuleNameInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const item = await ModuleNameModel.create({
      userId: req.userId!,
      ...validation.value,
    });

    return res.status(201).json({ message: "Created successfully", data: item });
  } catch (error) {
    console.error("Create module error:", error);
    return res.status(500).json({ message: "Failed to create" });
  }
}

export async function getModuleNames(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(parseInt(String(req.query.page) || "1"), 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "20"), 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ModuleNameModel.find({ userId: req.userId! }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ModuleNameModel.countDocuments({ userId: req.userId! }),
    ]);

    return res.json({ data: items, total, page, limit });
  } catch (error) {
    console.error("Get modules error:", error);
    return res.status(500).json({ message: "Failed to fetch" });
  }
}

export async function deleteModuleName(req: AuthRequest, res: Response) {
  try {
    const id = String(req.params.id);
    const item = await ModuleNameModel.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Not found" });
    }
    if (item.userId !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await ModuleNameModel.findByIdAndDelete(id);
    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete module error:", error);
    return res.status(500).json({ message: "Failed to delete" });
  }
}
```

**Conventions:**
- Named async function exports (not class)
- `AuthRequest` for protected, `Request` for public
- Always validate input first with shared validator
- `req.userId!` for authenticated user
- `String(req.params.id)` for ID coercion
- Ownership check before mutation (403)
- `Promise.all` for parallel DB queries
- try-catch with `console.error` + generic 500 message

### Step 4: Routes (`backend/src/modules/<name>/<name>.routes.ts`)

```typescript
import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import * as moduleNameController from "./<name>.controller";

// Mounted at /api/<names>
const router = Router();

router.post("/", authenticateToken, moduleNameController.createModuleName);
router.get("/", authenticateToken, moduleNameController.getModuleNames);
router.delete("/:id", authenticateToken, moduleNameController.deleteModuleName);

export default router;
```

**For nested routes** (e.g., `/api/comics/:id/bookmarks`):
```typescript
// Mounted at /api/comics (nested)
export const nestedRouter = Router();
nestedRouter.post("/:id/bookmarks", authenticateToken, controller.create);
nestedRouter.get("/:id/bookmarks", controller.list);
```

### Step 5: Register Routes in App (`backend/src/app.ts`)

Add import and mount:

```typescript
import moduleNameRoutes from "./modules/<name>/<name>.routes";
// ...
app.use("/api/<names>", moduleNameRoutes);
```

Group with related route registrations.

### Step 6: Frontend Page (if needed) (`frontend/src/pages/<name>.tsx`)

```typescript
import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ModuleName {
  id: string;
  field: string;
  createdAt: string;
}

export default function ModuleNamePage() {
  const [items, setItems] = useState<ModuleName[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/<names>", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setItems(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Module Names</h1>
        {isLoading ? (
          <div className="flex justify-center py-20">Loading...</div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.field}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

### Step 7: Add Route to Router (`frontend/src/App.tsx`)

Add the page route in the frontend router using `wouter`:

```tsx
import ModuleNamePage from "@/pages/<name>";
// In the Switch:
<Route path="/<names>" component={ModuleNamePage} />
```

## Post-Creation Checklist

- [ ] Shared schema has `Insert*`, full interface, and validator
- [ ] Mongoose model matches shared schema constraints
- [ ] Controller validates input, checks auth, handles errors
- [ ] Routes use correct middleware (`authenticateToken`, rate limiter if needed)
- [ ] Routes registered in `backend/src/app.ts`
- [ ] Frontend page handles loading/error states
- [ ] Frontend route registered in `App.tsx`
- [ ] No unused imports
