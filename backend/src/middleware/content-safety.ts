/**
 * Content Safety Middleware
 * ────────────────────────
 * Express middleware that runs in-backend content checks on
 * user-supplied text BEFORE the request reaches the AI generation handler.
 * This is the content moderation layer in the generation pipeline.
 *
 * Three middleware functions are exported:
 *
 *  1. `moderateUserInput`  — checks `req.body.title` + `req.body.idea`
 *     (for the `/generate-story` route)
 *
 *  2. `moderatePanelDescriptions` — checks every `panel.description` in
 *     `req.body.panels` (for the `/generate-images` route)
 *
 *  3. `moderatePrompt` — checks a single `req.body.prompt` string
 *     (for the `/images/generate` single-panel retry route)
 *
 * All three augment `req` with a `contentSafetyResult` object so the
 * downstream handler can inspect category scores if needed.
 *
 * Safety checks are based on the project's banned list and local NLP normalization.
 */

import type { Request, Response, NextFunction } from "express";
import { checkContent } from "../utils/content-filter";

interface FlaggedCategory {
  category: "LocalFilter";
  severity: number;
}

interface ModerationResult {
  safe: boolean;
  flagged: FlaggedCategory[];
  reason?: string;
}

function toSafeResult(): ModerationResult {
  return { safe: true, flagged: [] };
}

function toUnsafeResult(reason?: string): ModerationResult {
  return {
    safe: false,
    flagged: [{ category: "LocalFilter", severity: 6 }],
    reason,
  };
}

// ── Augment Express.Request ────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Populated by content-safety middleware. */
      contentSafetyResult?: ModerationResult;
    }
  }
}

// ── Helper: build a 400 JSON response for blocked content ──────────────

function blocked(res: Response, result: ModerationResult): void {
  res.status(400).json({
    message: result.reason ?? "Content violates safety policy.",
    contentSafety: {
      flagged: result.flagged,
    },
  });
}

// ── Middleware 1: title + idea ──────────────────────────────────────────

/**
 * Middleware for `/api/comics/generate-story`.
 * Checks `req.body.title` and `req.body.idea` with the local content filter.
 *
 * If either field is flagged, returns 400 and aborts the chain.
 */
export async function moderateUserInput(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, idea } = req.body ?? {};

    // Nothing to check → continue
    if (!title && !idea) {
      return next();
    }

    // Combine title + idea into one check (saves an API call when both are short)
    const combined = [title, idea].filter(Boolean).join("\n\n");

    const check = checkContent(combined);
    const result = check.safe ? toSafeResult() : toUnsafeResult(check.reason);
    req.contentSafetyResult = result;

    if (!result.safe) {
      console.warn("[content-safety-mw] Blocked generate-story input");
      return blocked(res, result);
    }
  } catch (error) {
    console.error("[content-safety-mw] moderateUserInput error:", error);
    res.status(500).json({ message: "Content safety check unavailable. Please try again." });
    return;
  }

  next();
}

// ── Middleware 2: panel descriptions ───────────────────────────────────

/**
 * Middleware for `/api/comics/generate-images`.
 * Checks every `panel.description` in `req.body.panels`.
 */
export async function moderatePanelDescriptions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panels: Array<{ description?: string }> = req.body?.panels;
    if (!Array.isArray(panels) || panels.length === 0) {
      return next();
    }

    const descriptions = panels
      .map((p) => p.description ?? "")
      .filter((d) => d.trim().length > 0);

    if (descriptions.length === 0) {
      return next();
    }

    for (let i = 0; i < descriptions.length; i++) {
      const check = checkContent(descriptions[i]);
      if (!check.safe) {
        const result = toUnsafeResult(check.reason);
        console.warn(`[content-safety-mw] Blocked panel description at index ${i}`);
        req.contentSafetyResult = result;
        return blocked(res, result);
      }
    }
  } catch (error) {
    console.error("[content-safety-mw] moderatePanelDescriptions error:", error);
    res.status(500).json({ message: "Content safety check unavailable. Please try again." });
    return;
  }

  next();
}

// ── Middleware 3: single prompt string ─────────────────────────────────

/**
 * Middleware for single-panel retry / custom generation routes.
 * Checks `req.body.prompt`.
 */
export async function moderatePrompt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const prompt: string | undefined = req.body?.prompt;
    if (!prompt || prompt.trim().length === 0) {
      return next();
    }

    const check = checkContent(prompt);
    const result = check.safe ? toSafeResult() : toUnsafeResult(check.reason);
    req.contentSafetyResult = result;

    if (!result.safe) {
      console.warn("[content-safety-mw] Blocked prompt");
      return blocked(res, result);
    }
  } catch (error) {
    console.error("[content-safety-mw] moderatePrompt error:", error);
    res.status(500).json({ message: "Content safety check unavailable. Please try again." });
    return;
  }

  next();
}

// ── Middleware 4: edited panel dialogue + narration ─────────────────────

/**
 * Middleware for comic/draft save routes (POST and PUT).
 * Checks every `panel.dialogue` and `panel.narration` in `req.body.panels`.
 * Blocks unsafe edits before persisting to the database.
 */
export async function moderateEditedPanels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const panels: Array<{ dialogue?: string; narration?: string }> = req.body?.panels;
    if (!Array.isArray(panels) || panels.length === 0) {
      return next();
    }

    // Check both dialogue and narration for all panels
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const textsToCheck = [
        { text: panel.dialogue ?? "", field: "dialogue" },
        { text: panel.narration ?? "", field: "narration" },
      ];

      for (const item of textsToCheck) {
        if (item.text.trim().length === 0) continue; // skip empty fields

        const check = checkContent(item.text);
        if (!check.safe) {
          const result = toUnsafeResult(check.reason);
          console.warn(
            `[content-safety-mw] Blocked panel ${i + 1} ${item.field}: ${check.reason}`,
          );
          req.contentSafetyResult = result;
          return blocked(res, result);
        }
      }
    }
  } catch (error) {
    console.error("[content-safety-mw] moderateEditedPanels error:", error);
    res.status(500).json({ message: "Content safety check unavailable. Please try again." });
    return;
  }

  next();
}

/**
 * Post-generation helper — moderate generated dialogue before saving.
 * Returns the first unsafe result if any dialogue is flagged.
 *
 * Usage in route handler:
 *   const check = await moderateGeneratedDialogues(panels);
 *   if (!check.safe) { ... }
 */
export async function moderateGeneratedDialogues(
  panels: Array<{ dialogue?: string; narration?: string }>,
): Promise<{ safe: boolean; firstUnsafe?: ModerationResult & { index: number } }> {
  const texts = panels.flatMap((p) =>
    [p.dialogue, p.narration].filter((t): t is string => !!t && t.trim().length > 0),
  );

  if (texts.length === 0) return { safe: true };

  for (let i = 0; i < texts.length; i++) {
    const check = checkContent(texts[i]);
    if (!check.safe) {
      return {
        safe: false,
        firstUnsafe: {
          ...toUnsafeResult(check.reason),
          index: i,
        },
      };
    }
  }

  return { safe: true };
}
