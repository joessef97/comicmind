import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { storage } from "../../services/storage.service";
import { validateCommentInput } from "@shared/schema";

export async function addComment(req: AuthRequest, res: Response) {
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
}

export async function getComments(req: Request, res: Response) {
  try {
    const comicId = String(req.params.id);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1), 100);
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);

    const result = await storage.getCommentsByComic(comicId, limit, page);
    return res.status(200).json({ ...result, limit, page });
  } catch (error) {
    console.error("Get comments error:", error);
    return res.status(500).json({ message: "Failed to get comments" });
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
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
}
