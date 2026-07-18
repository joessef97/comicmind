import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { UserModel } from "../auth/auth.model";
import { BILLING_PLANS, getPlanByPriceId, getPublicBillingPlans } from "./billing.plans";
import { createCustomerPortalSession } from "./paddle.service";
import { verifyPaddleWebhookSignature } from "./webhook-verification";
import { PaddleEventModel } from "./paddle-event.model";
import { logBillingEvent } from "./billing.logger";

type PaddleEvent = {
  event_id?: string;
  notification_id?: string;
  event_type: string;
  data: Record<string, any>;
};

function getEventPriceId(data: Record<string, any>): string {
  return (
    data.items?.[0]?.price?.id ||
    data.items?.[0]?.price_id ||
    data.details?.line_items?.[0]?.price_id ||
    data.price_id ||
    ""
  );
}

function getNextBillingDate(data: Record<string, any>): Date | null {
  const rawDate =
    data.next_billed_at ||
    data.current_billing_period?.ends_at ||
    data.billing_period?.ends_at ||
    null;

  return rawDate ? new Date(rawDate) : null;
}

async function activateUserSubscription(data: Record<string, any>, resetUsage: boolean) {
  const priceId = getEventPriceId(data);
  const plan = getPlanByPriceId(priceId);
  const userId = data.custom_data?.userId || data.custom_data?.user_id || data.custom_data?.comicmindUserId;
  const subscriptionId = data.subscription_id || data.id || "";

  if (!userId && subscriptionId) {
    const setUpdate: Record<string, unknown> = {
      "subscription.status": "active",
      "subscription.customerId": data.customer_id || "",
      "subscription.nextBillingDate": getNextBillingDate(data),
    };

    if (priceId) {
      setUpdate["subscription.priceId"] = priceId;
    }

    if (plan && plan.key !== "free") {
      setUpdate["subscription.plan"] = plan.key;
      setUpdate["usage.monthlyComicLimit"] = plan.monthlyComicLimit;
    }

    if (resetUsage) {
      setUpdate["usage.comicsGeneratedThisMonth"] = 0;
    }

    await UserModel.updateOne({ "subscription.subscriptionId": subscriptionId }, { $set: setUpdate });
    logBillingEvent("info", "subscription.renewed", {
      subscriptionId,
      priceId,
      plan: plan?.key,
      resetUsage,
    });
    return;
  }

  if (!userId) {
    logBillingEvent("warn", "webhook.missing_user_id", { subscriptionId, priceId });
    return;
  }

  if (!plan || plan.key === "free") {
    logBillingEvent("warn", "webhook.unknown_price", { userId, subscriptionId, priceId });
    return;
  }

  const setUpdate: Record<string, unknown> = {
    "subscription.plan": plan.key,
    "subscription.status": "active",
    "subscription.subscriptionId": subscriptionId,
    "subscription.customerId": data.customer_id || "",
    "subscription.priceId": priceId,
    "subscription.nextBillingDate": getNextBillingDate(data),
    "usage.monthlyComicLimit": plan.monthlyComicLimit,
  };

  if (resetUsage) {
    setUpdate["usage.comicsGeneratedThisMonth"] = 0;
  }

  await UserModel.updateOne({ _id: userId }, { $set: setUpdate });
  logBillingEvent("info", "subscription.activated", {
    userId,
    subscriptionId,
    priceId,
    plan: plan.key,
    resetUsage,
  });
}

async function updateExistingSubscription(data: Record<string, any>) {
  const priceId = getEventPriceId(data);
  const plan = getPlanByPriceId(priceId);
  const subscriptionId = data.id || data.subscription_id;
  const update: Record<string, unknown> = {
    "subscription.subscriptionId": subscriptionId,
    "subscription.customerId": data.customer_id || "",
    "subscription.priceId": priceId,
    "subscription.nextBillingDate": getNextBillingDate(data),
  };

  if (data.status === "active" && plan && plan.key !== "free") {
    update["subscription.plan"] = plan.key;
    update["subscription.status"] = "active";
    update["usage.monthlyComicLimit"] = plan.monthlyComicLimit;
  } else if (data.status === "paused") {
    update["subscription.status"] = "paused";
    update["usage.monthlyComicLimit"] = 0;
  } else if (data.status === "past_due") {
    update["subscription.status"] = "past_due";
    update["usage.monthlyComicLimit"] = 0;
  } else if (data.status === "canceled" || data.status === "expired") {
    await resetUserToFree(subscriptionId);
    return;
  }

  await UserModel.updateOne({ "subscription.subscriptionId": subscriptionId }, { $set: update });
  logBillingEvent("info", "subscription.updated", {
    subscriptionId,
    status: data.status,
    priceId,
    plan: plan?.key,
  });
}

async function resetUserToFree(subscriptionId: string) {
  if (!subscriptionId) {
    logBillingEvent("warn", "subscription.reset_missing_id");
    return;
  }

  await UserModel.updateOne(
    { "subscription.subscriptionId": subscriptionId },
    {
      $set: {
        "subscription.plan": "free",
        "subscription.status": "inactive",
        "subscription.subscriptionId": "",
        "subscription.priceId": "",
        "subscription.nextBillingDate": null,
        "usage.monthlyComicLimit": 0,
        "usage.comicsGeneratedThisMonth": 0,
      },
    },
  );
  logBillingEvent("info", "subscription.free", { subscriptionId });
}

async function markSubscriptionPastDue(data: Record<string, any>, reason: string) {
  const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
  if (!subscriptionId) {
    logBillingEvent("warn", "payment_failure.missing_subscription", { reason });
    return;
  }

  await UserModel.updateOne(
    { "subscription.subscriptionId": subscriptionId },
    {
      $set: {
        "subscription.status": "past_due",
        "subscription.nextBillingDate": getNextBillingDate(data),
        "usage.monthlyComicLimit": 0,
      },
    },
  );

  logBillingEvent("warn", "subscription.past_due", { subscriptionId, reason });
}

async function hasProcessedPaddleEvent(eventId: string) {
  return Boolean(await PaddleEventModel.findOne({ eventId }).lean());
}

async function recordProcessedPaddleEvent(eventId: string, eventType: string) {
  try {
    await PaddleEventModel.create({
      eventId,
      eventType,
      processedAt: new Date(),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return;
    }
    throw error;
  }
}

export async function getBillingPlans(_req: Request, res: Response) {
  return res.status(200).json({
    plans: getPublicBillingPlans(),
    environment: process.env.PADDLE_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
  });
}

export async function getSubscriptionStatus(req: AuthRequest, res: Response) {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const planKey = user.subscription?.plan || "free";
    const plan = BILLING_PLANS[planKey] || BILLING_PLANS.free;
    const monthlyComicLimit = Math.max(0, user.usage?.monthlyComicLimit ?? 0);
    const comicsGeneratedThisMonth = Math.max(0, user.usage?.comicsGeneratedThisMonth ?? 0);

    return res.status(200).json({
      plan: planKey,
      status: user.subscription?.status || "inactive",
      isActive: user.subscription?.status === "active",
      packageName: plan.name,
      currentPlan: plan.name.replace("ComicMind ", ""),
      subscriptionId: user.subscription?.subscriptionId || "",
      priceId: user.subscription?.priceId || "",
      nextBillingDate: user.subscription?.nextBillingDate || null,
      monthlyComicLimit,
      comicsGeneratedThisMonth,
      remainingComics: Math.max(0, monthlyComicLimit - comicsGeneratedThisMonth),
      comicsLimit: monthlyComicLimit,
      comicsUsed: comicsGeneratedThisMonth,
    });
  } catch (error) {
    console.error("[billing] getSubscriptionStatus error:", error);
    return res.status(500).json({ message: "Failed to get subscription status" });
  }
}

export async function getCheckoutEligibility(req: AuthRequest, res: Response) {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isActive = user.subscription?.status === "active";

    return res.status(200).json({
      canCheckout: !isActive,
      reason: isActive ? "active_subscription" : null,
      hasCustomerPortal: Boolean(user.subscription?.customerId),
      subscription: {
        plan: user.subscription?.plan || "free",
        status: user.subscription?.status || "inactive",
        subscriptionId: user.subscription?.subscriptionId || "",
      },
    });
  } catch (error) {
    logBillingEvent("error", "checkout_eligibility.failed", {
      userId: req.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Failed to check checkout eligibility" });
  }
}

export async function createPortalSession(req: AuthRequest, res: Response) {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const customerId = user.subscription?.customerId;
    if (!customerId) {
      return res.status(404).json({ message: "No Paddle customer portal is available yet." });
    }

    const urls = await createCustomerPortalSession(
      customerId,
      user.subscription?.subscriptionId || undefined,
    );

    logBillingEvent("info", "portal.created", {
      userId: req.userId,
      customerId,
      subscriptionId: user.subscription?.subscriptionId || "",
    });

    return res.status(201).json({
      url: urls.general.overview,
      subscriptions: urls.subscriptions || [],
    });
  } catch (error) {
    logBillingEvent("error", "portal.failed", {
      userId: req.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Failed to open customer portal" });
  }
}

export async function handlePaddleWebhook(req: Request, res: Response) {
  try {
    const rawBody = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body || {}));

    const isVerified = verifyPaddleWebhookSignature({
      rawBody,
      signatureHeader: req.headers["paddle-signature"],
      secret: process.env.PADDLE_WEBHOOK_SECRET || "",
    });

    if (!isVerified) {
      logBillingEvent("warn", "webhook.invalid_signature");
      return res.status(401).json({ message: "Invalid Paddle webhook signature" });
    }

    const event = req.body as PaddleEvent;
    const data = event.data || {};
    const eventId = event.event_id || event.notification_id;

    if (!eventId) {
      logBillingEvent("warn", "webhook.missing_event_id", { eventType: event.event_type });
      return res.status(400).json({ message: "Missing Paddle event id" });
    }

    const alreadyProcessed = await hasProcessedPaddleEvent(eventId);
    if (alreadyProcessed) {
      logBillingEvent("info", "webhook.duplicate", { eventId, eventType: event.event_type });
      return res.status(200).json({ received: true, duplicate: true });
    }

    logBillingEvent("info", "webhook.processing", {
      eventId,
      eventType: event.event_type,
      subscriptionId: data.id || data.subscription_id || data.subscription?.id || "",
    });

    switch (event.event_type) {
      case "transaction.completed":
        await activateUserSubscription(data, true);
        break;
      case "subscription.created":
        await activateUserSubscription(data, true);
        break;
      case "subscription.updated":
        await updateExistingSubscription(data);
        break;
      case "transaction.payment_failed":
        await markSubscriptionPastDue(data, "transaction.payment_failed");
        break;
      case "transaction.past_due":
        await markSubscriptionPastDue(data, "transaction.past_due");
        break;
      case "subscription.past_due":
        await markSubscriptionPastDue(data, "subscription.past_due");
        break;
      case "subscription.canceled":
      case "subscription.expired":
        await resetUserToFree(data.id || data.subscription_id);
        break;
      case "subscription.paused":
        await UserModel.updateOne(
          { "subscription.subscriptionId": data.id || data.subscription_id },
          { $set: { "subscription.status": "paused", "usage.monthlyComicLimit": 0 } },
        );
        logBillingEvent("info", "subscription.paused", {
          subscriptionId: data.id || data.subscription_id,
        });
        break;
      case "subscription.resumed":
        await updateExistingSubscription({ ...data, status: "active" });
        break;
      default:
        logBillingEvent("info", "webhook.ignored", { eventId, eventType: event.event_type });
    }

    await recordProcessedPaddleEvent(eventId, event.event_type);
    logBillingEvent("info", "webhook.processed", { eventId, eventType: event.event_type });
    return res.status(200).json({ received: true });
  } catch (error) {
    logBillingEvent("error", "webhook.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Failed to process Paddle webhook" });
  }
}
