import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { aiLimiter } from "../../middleware/rate-limit";
import { autoTranslateInput } from "../../middleware/translation";
import { moderateUserInput, moderatePanelDescriptions, moderatePrompt, moderateEditedPanels } from "../../middleware/content-safety";
import { requireAvailableComicGeneration } from "../billing/usage.middleware";
import * as comicController from "./comic.controller";
import { downloadComic } from "../../services/comic-download";

// ── Main comic router (mounted at /api/comics) ─────────────────────────
export const comicRouter = Router();

// Generation routes
comicRouter.post("/generate-story", authenticateToken, aiLimiter, autoTranslateInput, moderateUserInput, comicController.generateStoryHandler);
comicRouter.post("/generate-character-ref", authenticateToken, aiLimiter, comicController.generateCharacterRefHandler);
comicRouter.post("/generate-images", authenticateToken, aiLimiter, moderatePanelDescriptions, comicController.generateImagesHandler);
comicRouter.post("/validate-panels", authenticateToken, aiLimiter, moderatePanelDescriptions, comicController.validatePanelsHandler);
comicRouter.post("/retry-panel", authenticateToken, aiLimiter, comicController.retryPanelHandler);

// Public comic routes (MUST come before /:id)
comicRouter.get("/top-rated-preview", comicController.getTopRatedPreview as any);
comicRouter.get("/public", comicController.getPublicComics as any);
comicRouter.get("/public/:id", comicController.getPublicComicDetail as any);

// Share tracking (public — no auth required)
comicRouter.post("/:id/share", comicController.shareComic as any);

// Download tracking (public — no auth required)
comicRouter.post("/:id/download-track", comicController.trackDownload as any);

// Download full comic as PDF or PNG (public)
comicRouter.get("/:id/download", downloadComic as any);

// CRUD
comicRouter.post("/", authenticateToken, requireAvailableComicGeneration, moderateEditedPanels, comicController.createComic);
comicRouter.get("/", authenticateToken, comicController.getComics);
comicRouter.get("/:id", authenticateToken, comicController.getComic);
comicRouter.put("/:id", authenticateToken, moderateEditedPanels, comicController.updateComic);
comicRouter.delete("/:id", authenticateToken, comicController.deleteComic);
comicRouter.patch("/:id/publish", authenticateToken, comicController.publishComic);

// ── Image generation router (mounted at /api/images) ────────────────────
export const imageRouter = Router();
imageRouter.post("/generate", authenticateToken, aiLimiter, moderatePrompt, comicController.generateSingleImage);
