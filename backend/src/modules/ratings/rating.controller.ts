import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { storage } from "../../services/storage.service";
import { validateRatingInput } from "@shared/schema";

export async function rateComic(req: AuthRequest, res: Response) {
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
}

export async function getRatingSummary(req: Request, res: Response) {
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
}

export async function getRatings(req: Request, res: Response) {
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
}

export async function getMyRating(req: AuthRequest, res: Response) {
  try {
    const comicId = String(req.params.id);
    const rating = await storage.getUserRatingForComic(req.userId!, comicId);
    return res.status(200).json({ rating: rating || null });
  } catch (error) {
    console.error("Get my rating error:", error);
    return res.status(500).json({ message: "Failed to get rating" });
  }
}
