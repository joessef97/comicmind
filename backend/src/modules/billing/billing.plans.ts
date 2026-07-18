export type BillingPlanKey = "free" | "starter" | "pro" | "creator";

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  price: string;
  monthlyComicLimit: number;
  features: string[];
  priceIdEnv?: string;
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlan> = {
  free: {
    key: "free",
    name: "Free",
    price: "$0",
    monthlyComicLimit: 0,
    features: ["No subscription", "Upgrade through Paddle"],
  },
  starter: {
    key: "starter",
    name: "ComicMind Starter",
    price: "$4.99/month",
    monthlyComicLimit: 3,
    priceIdEnv: "PADDLE_STARTER_PRICE_ID",
    features: [
      "3 AI comic generations every month",
      "Standard image quality",
      "Comic editor",
      "Unused comics do not roll over",
    ],
  },
  pro: {
    key: "pro",
    name: "ComicMind Pro",
    price: "$7.99/month",
    monthlyComicLimit: 5,
    priceIdEnv: "PADDLE_PRO_PRICE_ID",
    features: [
      "5 AI comic generations every month",
      "Higher image quality",
      "Faster generation queue",
      "PDF export",
      "Unused comics do not roll over",
    ],
  },
  creator: {
    key: "creator",
    name: "ComicMind Creator",
    price: "$19.99/month",
    monthlyComicLimit: 15,
    priceIdEnv: "PADDLE_CREATOR_PRICE_ID",
    features: [
      "15 AI comic generations every month",
      "Highest image quality",
      "Fastest queue",
      "PDF export",
      "Priority access to new AI features",
      "Unused comics do not roll over",
    ],
  },
};

export function getPriceIdForPlan(plan: BillingPlanKey): string {
  const priceIdEnv = BILLING_PLANS[plan]?.priceIdEnv;
  return priceIdEnv ? process.env[priceIdEnv] || "" : "";
}

export function getPlanByPriceId(priceId?: string | null): BillingPlan | null {
  if (!priceId) return null;

  return (
    (Object.values(BILLING_PLANS).find((plan) => {
      if (!plan.priceIdEnv) return false;
      return process.env[plan.priceIdEnv] === priceId;
    }) as BillingPlan | undefined) ?? null
  );
}

export function getPublicBillingPlans() {
  return (["starter", "pro", "creator"] as BillingPlanKey[]).map((key) => ({
    ...BILLING_PLANS[key],
    priceId: getPriceIdForPlan(key),
  }));
}
