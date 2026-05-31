import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { storage } from "../../services/storage.service";
import { validateDraftInput } from "@shared/schema";

export async function createDraft(req: AuthRequest, res: Response) {
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
}

export async function getDrafts(req: AuthRequest, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10), 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10), 0);

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
}

export async function getDraft(req: AuthRequest, res: Response) {
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
}

export async function updateDraft(req: AuthRequest, res: Response) {
  try {
    const { title, style, idea, panels, characterSheet, characterRefUrl, status } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (style !== undefined) updates.style = style;
    if (idea !== undefined) updates.idea = idea;
    if (panels !== undefined) updates.panels = panels;
    if (characterSheet !== undefined) updates.characterSheet = characterSheet;
    if (characterRefUrl !== undefined) updates.characterRefUrl = characterRefUrl;
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
}

export async function deleteDraft(req: AuthRequest, res: Response) {
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
}

/**
 * DELETE /api/drafts/stale  — remove drafts stuck in GENERATING status
 * for longer than `maxAgeMinutes` (default 30).
 */
export async function cleanupStaleDrafts(req: AuthRequest, res: Response) {
  try {
    const maxAge = Math.max(parseInt(String(req.query.maxAge) || "30"), 5);
    const deleted = await storage.cleanupStaleDrafts(req.userId!, maxAge);
    return res.status(200).json({ message: `Cleaned up ${deleted} stale draft(s)`, deleted });
  } catch (error) {
    console.error("Cleanup stale drafts error:", error);
    return res.status(500).json({ message: "Failed to cleanup stale drafts" });
  }
}
