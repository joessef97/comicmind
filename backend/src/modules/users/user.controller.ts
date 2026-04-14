import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { UserModel } from "./user.model";

type SubscriptionPlanBody = {
	plan?: string | number;
};

function parsePlanToLimit(rawPlan: unknown): number | null {
	if (typeof rawPlan === "number" && Number.isInteger(rawPlan) && rawPlan > 0) {
		return rawPlan;
	}

	if (typeof rawPlan === "string") {
		const parsed = Number.parseInt(rawPlan, 10);
		if (Number.isInteger(parsed) && parsed > 0) {
			return parsed;
		}
	}

	return null;
}

export async function getSubscriptionStatus(req: AuthRequest, res: Response) {
	try {
		if (!req.userId) {
			return res.status(401).json({ message: "Authentication required" });
		}

		const user = await UserModel.findById(req.userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const comicsLimit = Math.max(0, user.subscription?.comicsLimit ?? 0);
		const comicsUsed = Math.max(0, user.subscription?.comicsUsed ?? 0);
		const remainingComics = Math.max(0, comicsLimit - comicsUsed);

		return res.status(200).json({
			isActive: Boolean(user.subscription?.isActive),
			packageName: user.subscription?.packageName ?? "Free",
			remainingComics,
			comicsLimit,
			comicsUsed,
			expiresAt: null,
		});
	} catch (error) {
		console.error("[users] getSubscriptionStatus error:", error);
		return res.status(500).json({ message: "Failed to get subscription status" });
	}
}

export async function activateSubscription(req: AuthRequest, res: Response) {
	try {
		if (!req.userId) {
			return res.status(401).json({ message: "Authentication required" });
		}

		const { plan } = (req.body || {}) as SubscriptionPlanBody;
		const comicsLimit = parsePlanToLimit(plan);
		if (!comicsLimit) {
			return res.status(400).json({ message: "Invalid subscription plan" });
		}

		const user = await UserModel.findById(req.userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		user.subscription = {
			isActive: true,
			packageName: `${comicsLimit} Stories`,
			comicsLimit,
			comicsUsed: 0,
			expiresAt: null,
		};

		await user.save();

		return res.status(200).json({
			message: "Subscription activated",
			subscription: {
				isActive: user.subscription.isActive,
				packageName: user.subscription.packageName,
				comicsLimit: user.subscription.comicsLimit,
				comicsUsed: user.subscription.comicsUsed,
				expiresAt: user.subscription.expiresAt,
			},
		});
	} catch (error) {
		console.error("[users] activateSubscription error:", error);
		return res.status(500).json({ message: "Failed to activate subscription" });
	}
}
