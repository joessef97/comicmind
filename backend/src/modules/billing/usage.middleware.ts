import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { UserModel } from "../auth/auth.model";

export async function requireAvailableComicGeneration(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const monthlyComicLimit = Math.max(0, user.usage?.monthlyComicLimit ?? 0);
    const comicsGeneratedThisMonth = Math.max(0, user.usage?.comicsGeneratedThisMonth ?? 0);

    if (user.subscription?.status !== "active" || monthlyComicLimit <= 0) {
      return res.status(403).json({ message: "Active subscription required to create comics" });
    }

    if (comicsGeneratedThisMonth >= monthlyComicLimit) {
      return res.status(403).json({
        message:
          "Monthly limit reached. Upgrade your subscription or wait until your subscription renews.",
      });
    }

    next();
  } catch (error) {
    console.error("[billing] usage middleware error:", error);
    return res.status(500).json({ message: "Failed to verify comic usage" });
  }
}
