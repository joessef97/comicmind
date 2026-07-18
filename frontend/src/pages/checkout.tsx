import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/page-layout";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PaddlePlan = {
  key: "starter" | "pro" | "creator";
  name: string;
  price: string;
  monthlyComicLimit: number;
  features: string[];
  priceId: string;
};

declare global {
  interface Window {
    Paddle?: {
      Environment?: { set: (environment: string) => void };
      Initialize: (options: { token: string; eventCallback?: (event: unknown) => void }) => void;
      Checkout: {
        open: (options: {
          items: Array<{ priceId: string; quantity: number }>;
          customer?: { email?: string };
          customData?: Record<string, string>;
          settings?: { displayMode?: "overlay"; successUrl?: string };
        }) => void;
      };
    };
  }
}

function loadPaddleScript() {
  if (window.Paddle) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Paddle.js")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PaddlePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isPaddleReady, setIsPaddleReady] = useState(false);
  const [isOpeningPlan, setIsOpeningPlan] = useState<string | null>(null);

  const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  const paddleEnvironment = import.meta.env.VITE_PADDLE_ENVIRONMENT as string | undefined;

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      try {
        const response = await fetch("/api/billing/plans");
        if (!response.ok) throw new Error("Unable to load Paddle plans");
        const payload = await response.json();
        if (isMounted) setPlans(payload.plans || []);
      } catch (error) {
        toast({
          title: "Pricing unavailable",
          description: error instanceof Error ? error.message : "Unable to load pricing.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoadingPlans(false);
      }
    }

    loadPlans();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function initializePaddle() {
      if (!clientToken) return;

      try {
        await loadPaddleScript();
        if (cancelled || !window.Paddle) return;
        if (paddleEnvironment === "sandbox") {
          window.Paddle.Environment?.set("sandbox");
        }
        window.Paddle.Initialize({ token: clientToken });
        setIsPaddleReady(true);
      } catch (error) {
        toast({
          title: "Checkout unavailable",
          description: error instanceof Error ? error.message : "Unable to initialize Paddle Checkout.",
          variant: "destructive",
        });
      }
    }

    initializePaddle();
    return () => {
      cancelled = true;
    };
  }, [clientToken, paddleEnvironment, toast]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.monthlyComicLimit - b.monthlyComicLimit),
    [plans],
  );

  const openCheckout = (plan: PaddlePlan) => {
    if (authLoading) return;

    if (!user) {
      setLocation(`/login?returnTo=${encodeURIComponent("/pricing")}`);
      return;
    }

    setIsOpeningPlan(plan.key);

    if (!clientToken || !isPaddleReady || !window.Paddle) {
      toast({
        title: "Checkout is not configured",
        description: "Add VITE_PADDLE_CLIENT_TOKEN and Paddle price IDs before opening checkout.",
        variant: "destructive",
      });
      setIsOpeningPlan(null);
      return;
    }

    if (!plan.priceId) {
      toast({
        title: "Missing Paddle price",
        description: `${plan.name} does not have a configured Paddle price ID.`,
        variant: "destructive",
      });
      setIsOpeningPlan(null);
      return;
    }

    void (async () => {
      try {
        const eligibilityResponse = await apiRequest("GET", "/api/billing/checkout-eligibility");
        const eligibility = await eligibilityResponse.json();

        if (!eligibility.canCheckout && eligibility.reason === "active_subscription") {
          const portalResponse = await apiRequest("POST", "/api/billing/portal-session");
          const portal = await portalResponse.json();
          if (portal.url) {
            window.location.href = portal.url;
            return;
          }
          throw new Error("Your active subscription is already managed in Paddle.");
        }

        if (!eligibility.canCheckout) {
          throw new Error("Checkout is not available for your account right now.");
        }

        window.Paddle.Checkout.open({
          items: [{ priceId: plan.priceId, quantity: 1 }],
          customData: {
            userId: user.id,
            plan: plan.key,
          },
          settings: {
            displayMode: "overlay",
            successUrl: `${window.location.origin}/dashboard`,
          },
        });
      } catch (error) {
        toast({
          title: "Checkout unavailable",
          description: error instanceof Error ? error.message : "Unable to verify checkout access.",
          variant: "destructive",
        });
      } finally {
        setIsOpeningPlan(null);
      }
    })();
  };

  return (
    <PageLayout className="bg-background text-foreground">
      <main className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight md:text-4xl">Pricing</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Monthly Paddle Billing subscriptions for AI comic generation.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await apiRequest("POST", "/api/billing/portal-session");
                const payload = await response.json();
                if (payload.url) window.location.href = payload.url;
              } catch (error) {
                toast({
                  title: "Portal unavailable",
                  description: error instanceof Error ? error.message : "No active billing portal session.",
                  variant: "destructive",
                });
              }
            }}
          >
            Manage Subscription
          </Button>
        </div>

        {isLoadingPlans ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {sortedPlans.map((plan) => (
              <Card key={plan.key} className="rounded-lg border-border/70 bg-card">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-display font-semibold">{plan.name}</h2>
                    <p className="mt-3 text-3xl font-display font-bold">{plan.price}</p>
                  </div>

                  <ul className="mb-6 flex-1 space-y-3 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    disabled={isOpeningPlan === plan.key}
                    onClick={() => openCheckout(plan)}
                  >
                    {isOpeningPlan === plan.key ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening
                      </>
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </PageLayout>
  );
}
