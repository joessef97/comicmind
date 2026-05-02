import type { Express } from "express";
import { type Server } from "http";
import crypto from "crypto";
import { rateLimit } from "express-rate-limit";
import { storage } from "./storage";
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  authenticateToken,
  type AuthRequest 
} from "./auth";
import { validateContent, validatePanelDescriptions, containsBannedWords } from "./content-filter";
import { 
  generateStory, 
  generateAllPanelImages, 
  retryPanelGeneration,
  generateCharacterReference,
  getImageProvider,
  type Panel 
} from "./ai-service";
import { validateUserInput, validateLoginInput, validateComicInput, validateEmail, validateDraftInput, validateRatingInput, validateCommentInput } from "@shared/schema";
import { sendResetEmail } from "./email-service";
import {
  persistImage,
  persistImageBuffer,
  isPersistedUrl,
  deleteComicImages,
  getUploadsRoot,
  getStorageProviderName,
} from "./services/image-storage";
import { autoTranslateInput, translatePanelsToArabic } from "./services/translation-middleware";
import {
  moderateUserInput,
  moderatePanelDescriptions,
  moderatePrompt,
  moderateGeneratedDialogues,
} from "./services/content-safety-middleware";
import express from "express";

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { message: "AI generation limit reached. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Serve persisted images from local disk (no-op if using Cloudinary CDN)
  app.use("/uploads", express.static(getUploadsRoot()));
  console.log(`[routes] Image storage provider: ${getStorageProviderName()}`);
  
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const validation = validateUserInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      const { username, email, password } = validation.value!;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
      });

      const token = generateToken(user.id);

      return res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const validation = validateLoginInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }
      const { username, password } = validation.value!;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user.id);

      return res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Forgot password - send reset email
  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !validateEmail(email)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[forgot-password] Request for email: ${normalizedEmail}`);

      // Always return the same message to prevent email enumeration
      const genericMessage = "If an account with that email exists, a reset link has been sent.";

      const user = await storage.getUserByEmail(normalizedEmail);

      if (!user) {
        console.log(`[forgot-password] No user found for ${normalizedEmail}`);
        return res.status(200).json({ message: genericMessage });
      }

      // Generate a secure random token (32 bytes = 64 hex chars)
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes

      // Delete any existing active reset tokens for this user
      await storage.deleteActiveResetsForUser(user.id);

      // Store hashed token in DB
      await storage.createPasswordReset(user.id, resetToken, expiresAt);

      // Send the raw token in the email (only the hash is in DB)
      await sendResetEmail(normalizedEmail, resetToken);
      console.log(`[forgot-password] Reset token created for user ${user.id}`);

      return res.status(200).json({ message: genericMessage });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Reset token is required" });
      }

      if (!email || typeof email !== "string" || !validateEmail(email)) {
        return res.status(400).json({ message: "Email is required" });
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      if (newPassword.length > 128) {
        return res.status(400).json({ message: "Password must be at most 128 characters" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[reset-password] Attempt for email: ${normalizedEmail}`);

      // Find valid reset record by SHA-256 hashed token + email match
      const reset = await storage.findValidPasswordReset(token, normalizedEmail);
      if (!reset) {
        console.log(`[reset-password] Invalid or expired token for ${normalizedEmail}`);
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      // Hash new password with bcrypt (cost 12)
      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(reset.userId, hashedPassword);

      // Mark this reset token as used (single-use)
      await storage.markResetUsed(token);

      // Delete any other active reset tokens for this user
      await storage.deleteActiveResetsForUser(reset.userId);

      console.log(`[reset-password] Password reset successful for user ${reset.userId}`);
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/comics/generate-story", authenticateToken, aiLimiter, autoTranslateInput, moderateUserInput, async (req: AuthRequest, res) => {
    try {
      // title & idea may have been translated from Arabic by `autoTranslateInput`
      const { title, idea, style } = req.body;

      if (!title || !idea || !style) {
        return res.status(400).json({ message: "Title, idea, and style are required" });
      }

      // Layer 2: regex-based filter (fast, offline fallback)
      const validation = validateContent(title, idea);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const storyResult = await generateStory(title, idea, style);

      // If the user's input was Arabic, translate dialogue & narration back
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
  });

  // ── Character reference sheet generation ───────────────────────────
  //   POST /api/comics/generate-character-ref
  //   Body: { characterSheet, storyIdea, style, comicId? }
  //   Response: { imageUrl }
  app.post("/api/comics/generate-character-ref", authenticateToken, aiLimiter, async (req: AuthRequest, res) => {
    try {
      const { characterSheet, storyIdea, style, comicId } = req.body;

      if (!characterSheet || !style || !storyIdea) {
        return res.status(400).json({ message: "characterSheet, storyIdea, and style are required" });
      }

      const result = await generateCharacterReference(characterSheet, storyIdea, style);

      // Persist the character reference image to cloud/disk storage
      let finalUrl = result.imageUrl;
      if (result.imageBuffer) {
        const uploaded = await persistImageBuffer(result.imageBuffer, comicId, "character-ref");
        if (uploaded) {
          finalUrl = uploaded.url;
        }
      } else if (finalUrl && !isPersistedUrl(finalUrl)) {
        const uploaded = await persistImage(finalUrl, comicId, "character-ref");
        if (uploaded) {
          finalUrl = uploaded.url;
        }
      }

      return res.status(200).json({
        message: "Character reference generated",
        imageUrl: finalUrl,
      });
    } catch (error: any) {
      console.error("Character reference generation error:", error);
      return res.status(500).json({
        message: error.message || "Failed to generate character reference",
      });
    }
  });

  app.post("/api/comics/generate-images", authenticateToken, aiLimiter, moderatePanelDescriptions, async (req: AuthRequest, res) => {
    try {
      const { panels, style } = req.body;

      if (!panels || !Array.isArray(panels) || !style) {
        return res.status(400).json({ message: "Panels and style are required" });
      }

      // Layer 2: regex-based filter (fast, offline fallback)
      const descValidation = validatePanelDescriptions(panels);
      if (!descValidation.valid) {
        return res.status(400).json({ message: descValidation.message });
      }

      const panelsWithImages = await generateAllPanelImages(panels, style);

      // Persist images to cloud/disk storage so they survive provider URL expiry.
      // gpt-image-1 returns a Buffer (base64) — persist via buffer upload.
      // Legacy DALL-E 3 returns a URL — persist via URL download.
      const persistedPanels = await Promise.all(
        panelsWithImages.map(async (p: any, idx: number) => {
          try {
            // If we have a raw image buffer (gpt-image-1), upload it directly
            if (p.imageBuffer) {
              const result = await persistImageBuffer(p.imageBuffer, undefined, `panel-${idx}`);
              if (result) {
                const { imageBuffer: _buf, ...rest } = p;
                return {
                  ...rest,
                  imageUrl: result.url,
                  storagePublicId: result.publicId,
                };
              }
            }
            // Otherwise fall back to URL-based persistence (DALL-E 3 compat)
            if (p.imageUrl && !isPersistedUrl(p.imageUrl)) {
              const result = await persistImage(p.imageUrl);
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
          // Strip imageBuffer before sending to client
          const { imageBuffer: _buf, ...rest } = p;
          return rest;
        }),
      );

      return res.status(200).json({
        message: "Images generated",
        panels: persistedPanels,
      });
    } catch (error) {
      console.error("Image generation error:", error);
      return res.status(500).json({ message: "Failed to generate images" });
    }
  });

  app.post("/api/comics/retry-panel", authenticateToken, aiLimiter, async (req: AuthRequest, res) => {
    try {
      const { panel, style } = req.body;
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

      // Persist the retried image to cloud/disk storage
      // gpt-image-1 returns a Buffer; DALL-E 3 returns a URL
      if ((updatedPanel as any).imageBuffer) {
        const result = await persistImageBuffer((updatedPanel as any).imageBuffer);
        if (result) {
          updatedPanel.imageUrl = result.url;
          (updatedPanel as any).storagePublicId = result.publicId;
        }
        delete (updatedPanel as any).imageBuffer;
      } else if (updatedPanel.imageUrl && !isPersistedUrl(updatedPanel.imageUrl)) {
        const result = await persistImage(updatedPanel.imageUrl);
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
  });

  // ── Per-panel image generation (new endpoint) ──────────────────────
  //   POST /api/images/generate
  //   Body: { comicId, panelIndex, prompt, style, characterSheet?, characterRefUrl? }
  //   Response: { imageUrl, meta }
  app.post("/api/images/generate", authenticateToken, aiLimiter, moderatePrompt, async (req: AuthRequest, res) => {
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

      // ── Layer 2: regex content safety check (offline fallback) ──
      if (containsBannedWords(prompt)) {
        return res.status(400).json({
          message: "The prompt contains inappropriate content. Please revise your description.",
        });
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

      // Persist the image to cloud/disk storage so it survives provider URL expiry.
      // gpt-image-1 returns a Buffer (base64), DALL-E 3 returns a temporary URL.
      let finalUrl = result.imageUrl;
      let storagePublicId: string | undefined;

      if (result.imageBuffer) {
        // Base64 model (gpt-image-1) — upload buffer directly
        const uploaded = await persistImageBuffer(result.imageBuffer, comicId, `panel-${panelIndex}`);
        if (uploaded) {
          finalUrl = uploaded.url;
          storagePublicId = uploaded.publicId;
        }
      } else if (finalUrl && !isPersistedUrl(finalUrl)) {
        // URL model (DALL-E 3 compat) — download and re-upload
        const uploaded = await persistImage(finalUrl, comicId, `panel-${panelIndex}`);
        if (uploaded) {
          finalUrl = uploaded.url;
          storagePublicId = uploaded.publicId;
        }
      }

      // ── Persist imageUrl + metadata into the comic document ──────
      if (comicId && typeof comicId === "string") {
        try {
          const comic = await storage.getComic(comicId);
          if (comic && comic.userId === req.userId) {
            const updatedPanels = [...(comic.panels || [])];
            if (updatedPanels[panelIndex]) {
              updatedPanels[panelIndex] = {
                ...updatedPanels[panelIndex],
                imageUrl: finalUrl,
                storagePublicId,
                generationMeta: result.meta,
                error: undefined,
              };
              await storage.updateComic(comicId, req.userId!, { panels: updatedPanels } as any);
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
  });

  app.post("/api/comics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, style, idea, panels } = req.body;

      if (!title || !style || !idea || !panels) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const comic = await storage.createComic(req.userId!, {
        title,
        style,
        idea,
        panels,
      });

      return res.status(201).json({
        message: "Comic saved successfully",
        comic,
      });
    } catch (error) {
      console.error("Save comic error:", error);
      return res.status(500).json({ message: "Failed to save comic" });
    }
  });

  app.get("/api/comics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "10"), 1), 100);
      const offset = Math.max(parseInt(String(req.query.offset) || "0"), 0);

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
  });

  // ── Public comic routes (MUST come before /api/comics/:id) ───────────

  // GET /api/comics/public – List all published comics (no auth required)
  app.get("/api/comics/public", async (_req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(_req.query.limit) || "20"), 1), 100);
      const offset = Math.max(parseInt(String(_req.query.offset) || "0"), 0);
      const comics = await storage.getAllComicsPublic(limit, offset);

      // Batch-fetch author usernames for all comics
      const uniqueUserIds = Array.from(new Set(comics.map((c) => c.userId)));
      const authorUsers = await Promise.all(uniqueUserIds.map((uid) => storage.getUser(uid)));
      const authorMap = new Map(
        authorUsers
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map((u) => [u.id, u.username])
      );

      // Batch-fetch rating + comment counts for each comic
      const enriched = await Promise.all(
        comics.map(async (c) => {
          const [ratingInfo, commentInfo] = await Promise.all([
            storage.getAverageRating(c.id),
            storage.getCommentsByComic(c.id, 0, 1),   // only need total
          ]);
          return {
            ...c,
            authorUsername: authorMap.get(c.userId) || "Unknown",
            ratingsCount: ratingInfo.count,
            commentsCount: commentInfo.total,
          };
        })
      );

      return res.status(200).json({ comics: enriched });
    } catch (error) {
      console.error("Public comics error:", error);
      return res.status(500).json({ message: "Failed to get comics" });
    }
  });

  // GET /api/comics/public/:id – Full comic detail with ratings + comments
  app.get("/api/comics/public/:id", async (req, res) => {
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
      });
    } catch (error) {
      console.error("Public comic detail error:", error);
      return res.status(500).json({ message: "Failed to get comic detail" });
    }
  });

  app.get("/api/comics/:id", authenticateToken, async (req: AuthRequest, res) => {
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
  });

  app.delete("/api/comics/:id", authenticateToken, async (req: AuthRequest, res) => {
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

      return res.status(200).json({ message: "Comic deleted successfully" });
    } catch (error) {
      console.error("Delete comic error:", error);
      return res.status(500).json({ message: "Failed to delete comic" });
    }
  });

  app.put("/api/comics/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, style, idea, panels } = req.body;

      const updates: any = {};
      if (title) updates.title = title;
      if (style) updates.style = style;
      if (idea) updates.idea = idea;
      if (panels) updates.panels = panels;

      const comic = await storage.updateComic(String(req.params.id), req.userId!, updates);

      if (!comic) {
        return res.status(404).json({ message: "Comic not found or access denied" });
      }

      return res.status(200).json({
        message: "Comic updated successfully",
        comic,
      });
    } catch (error) {
      console.error("Update comic error:", error);
      return res.status(500).json({ message: "Failed to update comic" });
    }
  });

  // PATCH /api/comics/:id/publish – Publish or unpublish a comic
  app.patch("/api/comics/:id/publish", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const publish = req.body.published !== false; // default true
      const comic = await storage.publishComic(String(req.params.id), req.userId!, publish);
      if (!comic) {
        return res.status(404).json({ message: "Comic not found or access denied" });
      }
      return res.status(200).json({
        message: publish ? "Comic published!" : "Comic unpublished",
        comic,
      });
    } catch (error) {
      console.error("Publish comic error:", error);
      return res.status(500).json({ message: "Failed to publish comic" });
    }
  });

  // ── Draft Endpoints ──────────────────────────────────────────────────────

  // POST /api/drafts – Create a new draft
  app.post("/api/drafts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const validation = validateDraftInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const draft = await storage.createDraft(req.userId!, validation.value!);

      return res.status(201).json({
        message: "Draft saved",
        draft,
      });
    } catch (error) {
      console.error("Create draft error:", error);
      return res.status(500).json({ message: "Failed to create draft" });
    }
  });

  // GET /api/drafts – List all drafts for current user
  app.get("/api/drafts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "50"), 1), 100);
      const offset = Math.max(parseInt(String(req.query.offset) || "0"), 0);

      const drafts = await storage.getDraftsByUser(req.userId!, limit, offset);

      return res.status(200).json({
        drafts,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Get drafts error:", error);
      return res.status(500).json({ message: "Failed to get drafts" });
    }
  });

  // GET /api/drafts/:id – Get a single draft
  app.get("/api/drafts/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const draft = await storage.getDraft(String(req.params.id));

      if (!draft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      if (draft.userId !== req.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(200).json({ draft });
    } catch (error) {
      console.error("Get draft error:", error);
      return res.status(500).json({ message: "Failed to get draft" });
    }
  });

  // PUT /api/drafts/:id – Update a draft
  app.put("/api/drafts/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, style, idea, panels, status } = req.body;

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (style !== undefined) updates.style = style;
      if (idea !== undefined) updates.idea = idea;
      if (panels !== undefined) updates.panels = panels;
      if (status !== undefined) updates.status = status;

      const draft = await storage.updateDraft(String(req.params.id), req.userId!, updates);

      if (!draft) {
        return res.status(404).json({ message: "Draft not found or access denied" });
      }

      return res.status(200).json({
        message: "Draft updated",
        draft,
      });
    } catch (error) {
      console.error("Update draft error:", error);
      return res.status(500).json({ message: "Failed to update draft" });
    }
  });

  // DELETE /api/drafts/:id – Delete a draft
  app.delete("/api/drafts/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteDraft(String(req.params.id), req.userId!);

      if (!deleted) {
        return res.status(404).json({ message: "Draft not found or access denied" });
      }

      return res.status(200).json({ message: "Draft deleted" });
    } catch (error) {
      console.error("Delete draft error:", error);
      return res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  // ── Ratings ───────────────────────────────────────────────────────────

  // POST /api/comics/:id/rating – Create or update a rating (auth required)
  app.post("/api/comics/:id/rating", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const comicId = String(req.params.id);

      // Verify comic exists
      const comic = await storage.getComicPublic(comicId);
      if (!comic) {
        return res.status(404).json({ message: "Comic not found" });
      }

      const validation = validateRatingInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const rating = await storage.upsertRating(req.userId!, comicId, validation.value!.value);
      return res.status(200).json({ message: "Rating saved", rating });
    } catch (error) {
      console.error("Rate comic error:", error);
      return res.status(500).json({ message: "Failed to save rating" });
    }
  });

  // GET /api/comics/:id/ratings/summary – Average + count (public)
  app.get("/api/comics/:id/ratings/summary", async (req, res) => {
    try {
      const comicId = String(req.params.id);
      const comic = await storage.getComicPublic(comicId);
      if (!comic) {
        return res.status(404).json({ message: "Comic not found" });
      }

      const info = await storage.getAverageRating(comicId);
      return res.status(200).json(info);
    } catch (error) {
      console.error("Get ratings summary error:", error);
      return res.status(500).json({ message: "Failed to get ratings" });
    }
  });

  // GET /api/comics/:id/ratings – Public paginated ratings list with user info
  app.get("/api/comics/:id/ratings", async (req, res) => {
    try {
      const comicId = String(req.params.id);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "20"), 1), 100);
      const page = Math.max(parseInt(String(req.query.page) || "1"), 1);
      const result = await storage.getRatingsWithUserByComic(comicId, limit, page);
      return res.status(200).json({ ...result, limit, page });
    } catch (error) {
      console.error("Get ratings list error:", error);
      return res.status(500).json({ message: "Failed to get ratings" });
    }
  });

  // GET /api/comics/:id/rating/mine – Get logged-in user's rating (auth required)
  app.get("/api/comics/:id/rating/mine", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const comicId = String(req.params.id);
      const rating = await storage.getUserRatingForComic(req.userId!, comicId);
      return res.status(200).json({ rating: rating || null });
    } catch (error) {
      console.error("Get my rating error:", error);
      return res.status(500).json({ message: "Failed to get rating" });
    }
  });

  // ── Comments ──────────────────────────────────────────────────────────

  // POST /api/comics/:id/comments – Add a comment (auth required)
  app.post("/api/comics/:id/comments", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const comicId = String(req.params.id);

      // Verify comic exists (must be a published comic)
      const comic = await storage.getComicPublic(comicId);
      if (!comic) {
        return res.status(404).json({ message: "Comic not found — can only comment on published comics" });
      }

      const validation = validateCommentInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const comment = await storage.createComment(req.userId!, comicId, validation.value!.text);
      return res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
      console.error("Add comment error:", error);
      return res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // GET /api/comics/:id/comments – Paginated comments (public)
  app.get("/api/comics/:id/comments", async (req, res) => {
    try {
      const comicId = String(req.params.id);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit) || "20"), 1), 100);
      const page = Math.max(parseInt(String(req.query.page) || "1"), 1);

      const result = await storage.getCommentsByComic(comicId, limit, page);
      return res.status(200).json({ ...result, limit, page });
    } catch (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({ message: "Failed to get comments" });
    }
  });

  // DELETE /api/comments/:id – Delete own comment (auth required)
  app.delete("/api/comments/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteComment(String(req.params.id), req.userId!);
      if (!deleted) {
        return res.status(404).json({ message: "Comment not found or access denied" });
      }
      return res.status(200).json({ message: "Comment deleted" });
    } catch (error) {
      console.error("Delete comment error:", error);
      return res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  return httpServer;
}
