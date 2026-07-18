import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import crypto from "crypto";
import { storage } from "../../services/storage.service";
import {
  generateStory,
  generateAllPanelImages,
  retryPanelGeneration,
  generateCharacterReference,
  getImageProvider,
} from "../../services/ai.service";
import { validateComicInput } from "@shared/schema";
import {
  persistImage,
  persistImageBuffer,
  isPersistedUrl,
  deleteComicImages,
} from "../../services/image-storage";
import { translatePanelsToArabic } from "../../middleware/translation";
import { moderateGeneratedDialogues } from "../../middleware/content-safety";
import { RatingModel } from "../ratings/rating.model";
import { CommentModel } from "../comments/comment.model";
import { ComicModel } from "./comic.model";
import { UserModel } from "../auth/auth.model";

const PUBLIC_LIST_CACHE_TTL_MS = 30_000;
const TOP_RATED_CACHE_TTL_MS = 30_000;
const DEFAULT_IMAGE_UPLOAD_CONCURRENCY = 6;

const publicListCache = new Map<string, { expiresAt: number; payload: any }>();
let topRatedCache: { expiresAt: number; payload: any } | null = null;

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function clearPublicCache() {
  publicListCache.clear();
  topRatedCache = null;
}

async function resolveOwnedComicId(
  req: AuthRequest,
  res: Response,
  rawComicId: unknown,
): Promise<string | undefined | null> {
  if (rawComicId == null) {
    return undefined;
  }

  if (typeof rawComicId !== "string" || !rawComicId.trim()) {
    res.status(400).json({ message: "comicId must be a non-empty string" });
    return null;
  }

  const comicId = rawComicId.trim();
  const comic = await storage.getComic(comicId);
  if (!comic || comic.userId !== req.userId) {
    res.status(403).json({ message: "Comic not found or access denied" });
    return null;
  }

  return comicId;
}

// ── Panel Validation ────────────────────────────────────────────────────

export async function validatePanelsHandler(req: AuthRequest, res: Response) {
  try {
    const { panels } = req.body;

    if (!Array.isArray(panels) || panels.length === 0) {
      return res.status(400).json({ message: "Panels array is required" });
    }

    // If request reaches here, moderatePanelDescriptions middleware passed all checks
    return res.status(200).json({
      message: "All panels passed content safety validation",
      validPanelCount: panels.length,
    });
  } catch (error) {
    console.error("Panel validation error:", error);
    return res.status(500).json({ message: "Failed to validate panels" });
  }
}

// ── Story Generation ────────────────────────────────────────────────────

export async function generateStoryHandler(req: AuthRequest, res: Response) {
  try {
    // title & idea may have been translated from Arabic by `autoTranslateInput`
    const { title, idea, style } = req.body;

    if (!title || !idea || !style) {
      return res.status(400).json({ message: "Title, idea, and style are required" });
    }

    const storyResult = await generateStory(title, idea, style, req.userId);

    // If the user's input was Arabic, translate user-facing text back.
    // We intentionally keep `description` in English for better image generation quality.
    let panels = storyResult.panels;
    const wasArabic = (req as any).translationMeta?.wasTranslated === true;
    if (wasArabic) {
      try {
        panels = await translatePanelsToArabic(panels);
        console.log("[generate-story] Panels translated back to Arabic");
      } catch (translationErr) {
        console.error("[generate-story] Post-generation translation failed:", translationErr);
        // continue with English panels — never crash
      }
    }

    // Optional: moderate generated dialogue before returning
    try {
      const dialogueCheck = await moderateGeneratedDialogues(storyResult.panels);
      if (!dialogueCheck.safe) {
        console.warn("[generate-story] Generated dialogue flagged — returning anyway with warning");
      }
    } catch (_) { /* best-effort post-gen check */ }

    return res.status(200).json({
      message: "Story generated successfully",
      panels,
      characterSheet: storyResult.characterSheet,
      // Let the client know the text was translated
      ...(wasArabic ? { translatedFrom: "ar" } : {}),
    });
  } catch (error) {
    console.error("Story generation error:", error);
    return res.status(500).json({ message: "Failed to generate story" });
  }
}

// ── Character Reference Generation ──────────────────────────────────────

export async function generateCharacterRefHandler(req: AuthRequest, res: Response) {
  try {
    const { characterSheet, storyIdea, style, comicId } = req.body;
    const forceRegenerate = req.body.forceRegenerate === true;

    if (!characterSheet || !style || !storyIdea) {
      return res.status(400).json({ message: "characterSheet, storyIdea, and style are required" });
    }

    const ownedComicId = await resolveOwnedComicId(req, res, comicId);
    if (ownedComicId === null) {
      return;
    }

    if (ownedComicId && !forceRegenerate) {
      const existingComic = await storage.getComic(ownedComicId);
      if (existingComic?.characterRefUrl) {
        return res.status(200).json({
          message: "Character reference reused",
          imageUrl: existingComic.characterRefUrl,
          reused: true,
        });
      }
    }

    const result = await generateCharacterReference(characterSheet, storyIdea, style);

    // Persist the character reference image to cloud/disk storage
    let finalUrl = result.imageUrl;
    const storageFolder = ownedComicId || crypto.randomUUID();
    const referencePublicId = ownedComicId ? "character-ref" : `character-ref-${Date.now()}`;
    if (result.imageBuffer) {
      const uploaded = await persistImageBuffer(result.imageBuffer, storageFolder, referencePublicId);
      if (uploaded) {
        finalUrl = uploaded.url;
      }
    } else if (finalUrl && !isPersistedUrl(finalUrl)) {
      const uploaded = await persistImage(finalUrl, storageFolder, referencePublicId);
      if (uploaded) {
        finalUrl = uploaded.url;
      }
    }

    if (ownedComicId && finalUrl) {
      await storage.updateComic(ownedComicId, req.userId!, { characterRefUrl: finalUrl } as any);
    }

    return res.status(200).json({
      message: "Character reference generated",
      imageUrl: finalUrl,
      reused: false,
    });
  } catch (error: any) {
    console.error("Character reference generation error:", error);
    return res.status(500).json({
      message: error.message || "Failed to generate character reference",
    });
  }
}

// ── Generate All Panel Images ───────────────────────────────────────────

export async function generateImagesHandler(req: AuthRequest, res: Response) {
  try {
    const { panels, style, comicId } = req.body;

    if (!panels || !Array.isArray(panels) || !style) {
      return res.status(400).json({ message: "Panels and style are required" });
    }

    const panelsWithImages = await generateAllPanelImages(panels, style);

    const ownedComicId = await resolveOwnedComicId(req, res, comicId);
    if (ownedComicId === null) {
      return;
    }

    // Use comic namespace when available; fallback to unique temp namespace for unsaved comics.
    const storageNamespace = ownedComicId || crypto.randomUUID();

    // Persist images to cloud/disk storage so they survive provider URL expiry.
    const uploadConcurrency = getPositiveIntegerEnv(
      "IMAGE_UPLOAD_CONCURRENCY",
      DEFAULT_IMAGE_UPLOAD_CONCURRENCY,
    );
    const persistedPanels = await mapWithConcurrency(
      panelsWithImages,
      uploadConcurrency,
      async (p: any, idx: number) => {
        try {
          if (p.imageBuffer) {
            const result = await persistImageBuffer(p.imageBuffer, storageNamespace, `panel-${idx}`);
            if (result) {
              const { imageBuffer: _buf, ...rest } = p;
              return {
                ...rest,
                imageUrl: result.url,
                storagePublicId: result.publicId,
              };
            }
          }
          if (p.imageUrl && !isPersistedUrl(p.imageUrl)) {
            const result = await persistImage(p.imageUrl, storageNamespace, `panel-${idx}`);
            if (result) {
              return {
                ...p,
                imageUrl: result.url,
                storagePublicId: result.publicId,
              };
            }
          }
        } catch (err) {
          console.error(`[generate-images] Failed to persist panel ${idx}:`, err);
        }
        const { imageBuffer: _buf, ...rest } = p;
        return rest;
      },
    );

    return res.status(200).json({
      message: "Images generated",
      panels: persistedPanels,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return res.status(500).json({ message: "Failed to generate images" });
  }
}

// ── Retry Single Panel ──────────────────────────────────────────────────

export async function retryPanelHandler(req: AuthRequest, res: Response) {
  try {
    const { panel, style, comicId } = req.body;
    const characterRefUrl = req.body.characterRefUrl as string | undefined;

    if (!panel || !style) {
      return res.status(400).json({ message: "Panel and style are required" });
    }

    // Download character reference image if provided
    let referenceImage: Buffer | undefined;
    if (characterRefUrl) {
      try {
        const refResponse = await fetch(characterRefUrl);
        if (refResponse.ok) {
          referenceImage = Buffer.from(await refResponse.arrayBuffer());
        }
      } catch (dlErr) {
        console.warn("[retry-panel] Could not download character reference:", dlErr);
      }
    }

    const updatedPanel = await retryPanelGeneration(panel, style, referenceImage);

    const ownedComicId = await resolveOwnedComicId(req, res, comicId);
    if (ownedComicId === null) {
      return;
    }

    const panelNumber =
      typeof panel?.number === "number"
        ? panel.number
        : typeof panel?.panelNumber === "number"
          ? panel.panelNumber
          : undefined;
    const panelPublicId =
      typeof panelNumber === "number" && panelNumber > 0
        ? `panel-${panelNumber - 1}`
        : `panel-retry-${Date.now()}`;

    // Persist the retried image to cloud/disk storage
    if ((updatedPanel as any).imageBuffer) {
      const result = await persistImageBuffer((updatedPanel as any).imageBuffer, ownedComicId, panelPublicId);
      if (result) {
        updatedPanel.imageUrl = result.url;
        (updatedPanel as any).storagePublicId = result.publicId;
      }
      delete (updatedPanel as any).imageBuffer;
    } else if (updatedPanel.imageUrl && !isPersistedUrl(updatedPanel.imageUrl)) {
      const result = await persistImage(updatedPanel.imageUrl, ownedComicId, panelPublicId);
      if (result) {
        updatedPanel.imageUrl = result.url;
        (updatedPanel as any).storagePublicId = result.publicId;
      }
    }

    return res.status(200).json({
      message: "Panel regenerated",
      panel: updatedPanel,
    });
  } catch (error) {
    console.error("Panel retry error:", error);
    return res.status(500).json({ message: "Failed to retry panel generation" });
  }
}

// ── Per-Panel Image Generation (/api/images/generate) ───────────────────

export async function generateSingleImage(req: AuthRequest, res: Response) {
  try {
    const { comicId, panelIndex, prompt, style } = req.body;
    const characterSheet = req.body.characterSheet as string | undefined;
    const characterRefUrl = req.body.characterRefUrl as string | undefined;

    // ── Validate inputs ──────────────────────────────────────────
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ message: "Prompt is required" });
    }
    if (typeof style !== "string" || !style.trim()) {
      return res.status(400).json({ message: "Style is required" });
    }
    if (typeof panelIndex !== "number" || panelIndex < 0 || panelIndex > 5) {
      return res.status(400).json({ message: "panelIndex must be 0–5" });
    }

    const ownedComicId = await resolveOwnedComicId(req, res, comicId);
    if (ownedComicId === null) {
      return;
    }

    // ── Download character reference image if provided ───────────
    let referenceImage: Buffer | undefined;
    if (characterRefUrl) {
      try {
        console.log(`[images/generate] Downloading character reference from: ${characterRefUrl}`);
        const refResponse = await fetch(characterRefUrl);
        if (refResponse.ok) {
          referenceImage = Buffer.from(await refResponse.arrayBuffer());
          console.log(`[images/generate] Character reference loaded: ${(referenceImage.length / 1024).toFixed(0)} KB`);
        } else {
          console.warn(`[images/generate] Failed to download character ref: HTTP ${refResponse.status}`);
        }
      } catch (dlErr) {
        console.warn("[images/generate] Could not download character reference (continuing without):", dlErr);
      }
    }

    // ── Generate image via the swappable provider ────────────────
    const provider = getImageProvider();
    const result = await provider.generateImage({
      prompt,
      style,
      panelNumber: panelIndex + 1,
      size: "1024x1024",
      characterSheet: characterSheet || undefined,
      referenceImage,
    });

    // Persist the image to cloud/disk storage
    let finalUrl = result.imageUrl;
    let storagePublicId: string | undefined;

    // Use comic namespace when available; fallback to unique temp namespace for unsaved comics.
    const storageFolder = ownedComicId || crypto.randomUUID();

    if (result.imageBuffer) {
      const uploaded = await persistImageBuffer(result.imageBuffer, storageFolder, `panel-${panelIndex}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    } else if (finalUrl && !isPersistedUrl(finalUrl)) {
      const uploaded = await persistImage(finalUrl, storageFolder, `panel-${panelIndex}`);
      if (uploaded) {
        finalUrl = uploaded.url;
        storagePublicId = uploaded.publicId;
      }
    }

    // ── Persist imageUrl + metadata into the comic document ──────
    if (ownedComicId) {
      try {
        const comic = await storage.getComic(ownedComicId);
        if (comic) {
          const updatedPanels = [...(comic.panels || [])];
          if (updatedPanels[panelIndex]) {
            updatedPanels[panelIndex] = {
              ...updatedPanels[panelIndex],
              imageUrl: finalUrl,
              storagePublicId,
              generationMeta: result.meta,
              error: undefined,
            };
            await storage.updateComic(ownedComicId, req.userId!, { panels: updatedPanels } as any);
          }
        }
      } catch (persistErr) {
        console.error("Failed to persist panel image to comic:", persistErr);
      }
    }

    return res.status(200).json({
      imageUrl: finalUrl,
      meta: result.meta,
    });
  } catch (error: any) {
    console.error("Image generate error:", error);
    const message =
      error.message || "Failed to generate image. Please try again.";
    return res.status(500).json({ message });
  }
}

// ── Comic CRUD ──────────────────────────────────────────────────────────

export async function createComic(req: AuthRequest, res: Response) {
  try {
    const { title, style, idea, panels, characterSheet, characterRefUrl } = req.body;

    if (!title || !style || !idea || !panels) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const comic = await storage.createComic(req.userId!, {
      title,
      style,
      idea,
      panels,
      characterSheet,
      characterRefUrl,
    });

    await UserModel.updateOne(
      { _id: req.userId, "subscription.status": "active" },
      { $inc: { "usage.comicsGeneratedThisMonth": 1 } },
    );

    clearPublicCache();

    return res.status(201).json({
      message: "Comic saved successfully",
      comic,
    });
  } catch (error) {
    console.error("Save comic error:", error);
    return res.status(500).json({ message: "Failed to save comic" });
  }
}

export async function getComics(req: AuthRequest, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "10"), 10), 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10), 0);

    const comics = await storage.getComicsByUser(req.userId!, limit, offset);

    return res.status(200).json({
      comics,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get comics error:", error);
    return res.status(500).json({ message: "Failed to get comics" });
  }
}

export async function getPublicComics(req: AuthRequest, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10), 0);
    const cacheKey = `${limit}:${offset}`;
    const cached = publicListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.status(200).json(cached.payload);
    }

    const comics = await storage.getPublicComicPreviews(limit, offset);
    const comicIds = comics.map((c) => c.id);

    const [ratingStats, commentStats] = await Promise.all([
      comicIds.length
        ? RatingModel.aggregate([
          { $match: { comicId: { $in: comicIds } } },
          {
            $group: {
              _id: "$comicId",
              average: { $avg: "$value" },
              count: { $sum: 1 },
            },
          },
        ])
        : Promise.resolve([]),
      comicIds.length
        ? CommentModel.aggregate([
          { $match: { comicId: { $in: comicIds } } },
          { $group: { _id: "$comicId", count: { $sum: 1 } } },
        ])
        : Promise.resolve([]),
    ]);

    const ratingMap = new Map<string, { average: number; count: number }>(
      (ratingStats as any[]).map((row) => [String(row._id), {
        average: Math.round((row.average ?? 0) * 10) / 10,
        count: row.count ?? 0,
      }]),
    );
    const commentMap = new Map<string, number>(
      (commentStats as any[]).map((row) => [String(row._id), row.count ?? 0]),
    );

    // Batch-fetch author usernames
    const uniqueUserIds = Array.from(new Set(comics.map((c) => c.userId)));
    const authorUsers = uniqueUserIds.length
      ? await UserModel.find({ _id: { $in: uniqueUserIds } }).select("username").lean()
      : [];
    const authorMap = new Map(
      authorUsers.map((u: any) => [u._id.toString(), u.username as string]),
    );

    const enriched = comics.map((c) => ({
      ...c,
      authorUsername: authorMap.get(c.userId) || "Unknown",
      ratingsCount: ratingMap.get(c.id)?.count ?? 0,
      averageRating: ratingMap.get(c.id)?.average ?? 0,
      commentsCount: commentMap.get(c.id) ?? 0,
    }));

    const payload = { comics: enriched };
    publicListCache.set(cacheKey, {
      expiresAt: Date.now() + PUBLIC_LIST_CACHE_TTL_MS,
      payload,
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Public comics error:", error);
    return res.status(500).json({ message: "Failed to get comics" });
  }
}

export async function getTopRatedPreview(_req: Request, res: Response) {
  try {
    if (topRatedCache && topRatedCache.expiresAt > Date.now()) {
      return res.status(200).json(topRatedCache.payload);
    }

    const topRated = await RatingModel.aggregate([
      {
        $group: {
          _id: "$comicId",
          average: { $avg: "$value" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 0 } } },
      { $sort: { average: -1, count: -1 } },
      // Keep a shortlist so we can skip missing/unpublished comics safely.
      { $limit: 50 },
    ]);

    if (!topRated.length) {
      return res.status(200).json(null);
    }

    let winner: { _id: string; average: number; count: number } | null = null;
    let comic: any = null;

    for (const row of topRated as Array<{ _id: string; average: number; count: number }>) {
      const candidate = await ComicModel.findOne({ _id: row._id, published: true })
        .select("title userId panels.imageUrl")
        .lean();

      if (candidate) {
        winner = row;
        comic = candidate;
        break;
      }
    }

    if (!winner || !comic) {
      return res.status(200).json(null);
    }

    const author = await UserModel.findById(comic.userId).select("username").lean();

    const payload = {
      _id: String(comic._id),
      title: comic.title,
      averageRating: Math.round((winner.average ?? 0) * 10) / 10,
      ratingsCount: winner.count ?? 0,
      authorName: author?.username || "Unknown",
      panels: (comic.panels || []).map((p: any) => ({ imageUrl: p.imageUrl })),
    };

    topRatedCache = {
      expiresAt: Date.now() + TOP_RATED_CACHE_TTL_MS,
      payload,
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Top rated preview error:", error);
    return res.status(500).json({ message: "Failed to get top rated comic" });
  }
}

export async function getPublicComicDetail(req: AuthRequest, res: Response) {
  try {
    const comic = await storage.getComicPublic(String(req.params.id));
    if (!comic) {
      return res.status(404).json({ message: "Comic not found" });
    }

    const [ratingInfo, comments, author] = await Promise.all([
      storage.getAverageRating(comic.id),
      storage.getCommentsByComic(comic.id),
      storage.getUser(comic.userId),
    ]);

    return res.status(200).json({
      ...comic,
      averageRating: ratingInfo.average,
      ratingCount: ratingInfo.count,
      comments,
      authorUsername: author?.username || "Unknown",
      shares: comic.shares ?? 0,
      downloads: comic.downloads ?? 0,
    });
  } catch (error) {
    console.error("Public comic detail error:", error);
    return res.status(500).json({ message: "Failed to get comic detail" });
  }
}

export async function getComic(req: AuthRequest, res: Response) {
  try {
    const comicId = String(req.params.id);
    const comic = await storage.getComic(comicId);

    if (!comic) {
      return res.status(404).json({ message: "Comic not found" });
    }

    if (comic.userId !== req.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ comic });
  } catch (error) {
    console.error("Get comic error:", error);
    return res.status(500).json({ message: "Failed to get comic" });
  }
}

export async function deleteComic(req: AuthRequest, res: Response) {
  try {
    const comicId = String(req.params.id);

    // Clean up stored images (cloud or disk) before deleting the DB record
    try {
      await deleteComicImages(comicId);
    } catch (cleanupErr) {
      console.error(`[routes] Image cleanup failed for comic ${comicId}:`, cleanupErr);
      // Continue with deletion even if cleanup fails
    }

    const deleted = await storage.deleteComic(comicId, req.userId!);

    if (!deleted) {
      return res.status(404).json({ message: "Comic not found or access denied" });
    }
    clearPublicCache();

    return res.status(200).json({ message: "Comic deleted successfully" });
  } catch (error) {
    console.error("Delete comic error:", error);
    return res.status(500).json({ message: "Failed to delete comic" });
  }
}

export async function updateComic(req: AuthRequest, res: Response) {
  try {
    const { title, style, idea, panels, characterSheet, characterRefUrl } = req.body;

    const updates: any = {};
    if (title) updates.title = title;
    if (style) updates.style = style;
    if (idea) updates.idea = idea;
    if (panels) updates.panels = panels;
    if (characterSheet !== undefined) updates.characterSheet = characterSheet;
    if (characterRefUrl !== undefined) updates.characterRefUrl = characterRefUrl;

    const comic = await storage.updateComic(String(req.params.id), req.userId!, updates);

    if (!comic) {
      return res.status(404).json({ message: "Comic not found or access denied" });
    }
    clearPublicCache();

    return res.status(200).json({
      message: "Comic updated successfully",
      comic,
    });
  } catch (error) {
    console.error("Update comic error:", error);
    return res.status(500).json({ message: "Failed to update comic" });
  }
}

export async function publishComic(req: AuthRequest, res: Response) {
  try {
    const publish = req.body.published !== false; // default true
    const comic = await storage.publishComic(String(req.params.id), req.userId!, publish);
    if (!comic) {
      return res.status(404).json({ message: "Comic not found or access denied" });
    }
    clearPublicCache();
    return res.status(200).json({
      message: publish ? "Comic published!" : "Comic unpublished",
      comic,
    });
  } catch (error) {
    console.error("Publish comic error:", error);
    return res.status(500).json({ message: "Failed to publish comic" });
  }
}

// ── Share Tracking ───────────────────────────────────────────────────────

export async function shareComic(req: AuthRequest, res: Response) {
  try {
    const comicId = String(req.params.id);
    const shares = await storage.incrementShareCount(comicId);
    clearPublicCache();
    return res.status(200).json({ message: "Share recorded", shares });
  } catch (error) {
    console.error("Share comic error:", error);
    return res.status(500).json({ message: "Failed to record share" });
  }
}

// ── Download Tracking ────────────────────────────────────────────────────

export async function trackDownload(req: AuthRequest, res: Response) {
  try {
    const comicId = String(req.params.id);
    const downloads = await storage.incrementDownloadCount(comicId);
    clearPublicCache();
    return res.status(200).json({ message: "Download recorded", downloads });
  } catch (error) {
    console.error("Track download error:", error);
    return res.status(500).json({ message: "Failed to record download" });
  }
}
