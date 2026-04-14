/**
 * Translation Middleware
 * ─────────────────────
 * Express middleware that detects Arabic user input and translates it to
 * English before it reaches the AI generation routes.
 *
 * After generation, the `translatePanelsToArabic` helper can be called on the
 * response panels to convert dialogue & narration back to Arabic.
 *
 * Usage in routes:
 *   app.post("/api/comics/generate-story", autoTranslateInput, handler);
 */

import type { Request, Response, NextFunction } from "express";
import {
  isArabicText,
  normalizeText,
  translateGeneratedText,
} from "../services/translation.service";
import type { Panel } from "../services/ai.service";

// We augment the Request with translation metadata so downstream handlers
// know whether the user's input was translated and in which language.
declare global {
  namespace Express {
    interface Request {
      /** Set by `autoTranslateInput` middleware when the original prompt was Arabic. */
      translationMeta?: {
        originalTitle: string;
        originalIdea: string;
        originalLang: string;
        wasTranslated: boolean;
      };
    }
  }
}

/**
 * Middleware — auto-translate Arabic title & idea to English.
 *
 * Checks `req.body.title` and `req.body.idea`. If either contains Arabic
 * text, both are translated to English and the originals are stashed in
 * `req.translationMeta` so the response handler can translate back.
 *
 * If translation fails the request continues with the original text — no crash.
 */
export async function autoTranslateInput(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, idea } = req.body ?? {};

    if (!title && !idea) {
      return next();
    }

    const hasArabicTitle = typeof title === "string" && isArabicText(title);
    const hasArabicIdea = typeof idea === "string" && isArabicText(idea);

    if (!hasArabicTitle && !hasArabicIdea) {
      return next();
    }

    console.log("[translator-middleware] Arabic input detected — translating to English…");

    // Translate both fields in parallel
    const [titleResult, ideaResult] = await Promise.all([
      typeof title === "string"
        ? normalizeText(title)
        : Promise.resolve({
            originalText: "",
            normalizedText: "",
            sourceLanguage: "en",
            wasTranslated: false,
          }),
      typeof idea === "string"
        ? normalizeText(idea)
        : Promise.resolve({
            originalText: "",
            normalizedText: "",
            sourceLanguage: "en",
            wasTranslated: false,
          }),
    ]);

    // Store originals + metadata
    req.translationMeta = {
      originalTitle: title ?? "",
      originalIdea: idea ?? "",
      originalLang: "ar",
      wasTranslated: true,
    };

    // Overwrite body with English text for the AI pipeline
    req.body.title = titleResult.normalizedText;
    req.body.idea = ideaResult.normalizedText;

    console.log("[translator-middleware] Translation complete → forwarding English text");
  } catch (error) {
    // Never crash the request — just log and continue with original text
    console.error("[translator-middleware] Translation failed, using original:", error);
  }

  next();
}

/**
 * Post-generation helper — translate generated panel dialogue + narration
 * back to Arabic when the original user input was Arabic.
 *
 * Call this from the route handler AFTER `generateStory` returns:
 *
 *   if (req.translationMeta?.wasTranslated) {
 *     panels = await translatePanelsToArabic(panels);
 *   }
 */
export async function translatePanelsToArabic(panels: Panel[]): Promise<Panel[]> {
  if (!panels || panels.length === 0) return panels;

  const translatedPanels = await Promise.all(
    panels.map(async (panel) => {
      const rawDialogue = panel.dialogue ?? "";
      const colonIdx = rawDialogue.indexOf(":");

      // Keep character names in English while translating spoken text to Arabic.
      let translatedDialogue = rawDialogue;
      if (colonIdx >= 0) {
        const speaker = rawDialogue.slice(0, colonIdx).trim();
        const spokenText = rawDialogue.slice(colonIdx + 1).trim();
        const translatedSpokenText = await translateGeneratedText(spokenText, "ar");
        translatedDialogue = `${speaker}: ${translatedSpokenText}`;
      } else {
        translatedDialogue = await translateGeneratedText(rawDialogue, "ar");
      }

      const translatedNarration = await translateGeneratedText(panel.narration ?? "", "ar");

      return {
        ...panel,
        dialogue: translatedDialogue,
        narration: translatedNarration,
      };
    }),
  );

  return translatedPanels;
}
