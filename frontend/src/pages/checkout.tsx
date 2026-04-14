import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import { useAuth } from "@/hooks/use-auth";

type CheckoutPlan = {
  plan: string;
  price: string;
};

function formatPlanName(plan: string) {
  return `${plan} Stories`;
}

function parseQuery(search: string): CheckoutPlan {
  const params = new URLSearchParams(search);
  const rawPlan = params.get("plan") || "3";
  const rawPrice = params.get("price") || "4.99";
  return { plan: rawPlan, price: rawPrice };
}

export default function Checkout() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    cardNumber: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  const { plan, price } = useMemo(() => parseQuery(location.split("?")[1] ? `?${location.split("?")[1]}` : ""), [location]);

  const displayPrice = Number.parseFloat(price || "0");
  const formattedPrice = Number.isFinite(displayPrice)
    ? displayPrice.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : `$${price}`;

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handlePayNow = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/user/subscription/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      if (response.status === 401 || response.status === 403) {
        const returnTo = encodeURIComponent(location);
        setLocation(`/login?returnTo=${returnTo}`);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to activate subscription.");
      }

      setLocation(`/success?plan=${encodeURIComponent(plan)}&price=${encodeURIComponent(price)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to activate subscription.";
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isLoading || user) return;

    const returnTo = encodeURIComponent(location);
    setLocation(`/login?returnTo=${returnTo}`);
  }, [isLoading, location, setLocation, user]);

  useEffect(() => {
    return () => {
      setIsProcessing(false);
    };
  }, []);

  if (isLoading || !user) {
    return null;
  }

  return (
    <PageLayout className="bg-background text-foreground">
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-120px] top-[-120px] h-[360px] w-[360px] rounded-full bg-violet-600/20 blur-3xl" />
          <div className="absolute right-[-140px] top-[120px] h-[420px] w-[420px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" />
            Demo payment flow
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-border/70 bg-card p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:p-8">
              <div className="mb-8">
                <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Secure Checkout
                </p>
                <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground md:text-4xl">
                  Secure Checkout
                </h1>
                <p className="mt-3 text-sm text-muted-foreground md:text-base">
                  Demo payment only. No real charges will be made.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Card Number" fullWidth>
                  <input
                    value={form.cardNumber}
                    onChange={handleChange("cardNumber")}
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
                <Field label="Name on Card" fullWidth>
                  <input
                    value={form.name}
                    onChange={handleChange("name")}
                    placeholder="Jane Doe"
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
                <Field label="Expiry Date">
                  <input
                    value={form.expiry}
                    onChange={handleChange("expiry")}
                    placeholder="MM / YY"
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
                <Field label="CVC">
                  <input
                    value={form.cvc}
                    onChange={handleChange("cvc")}
                    placeholder="123"
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                This is a demo payment. No real transaction will occur.
              </div>

              <div className="mt-6">
                <Button
                  onClick={handlePayNow}
                  disabled={isProcessing}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary via-fuchsia-600 to-pink-600 text-primary-foreground shadow-[0_12px_34px_rgba(168,85,247,0.34)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_16px_42px_rgba(217,70,239,0.42)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                >
                  {isProcessing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay Now
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {errorMessage ? (
                  <p className="mt-3 text-sm text-red-500">{errorMessage}</p>
                ) : null}
              </div>
            </section>

            <aside className="rounded-2xl border border-border/70 bg-card p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:p-8">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Order Summary
                </p>
                <h2 className="mt-3 text-2xl font-display font-bold text-foreground">
                  {formatPlanName(plan)}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Perfect for exploring ComicMind’s AI comic creation workflow.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-5">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatPlanName(plan)}</span>
                  <span>{formattedPrice}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Includes a flexible demo plan for generating comic stories with AI-powered tools.
                </p>

                <div className="my-5 h-px bg-border/80" />

                <div className="flex items-center justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formattedPrice}</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                {plan} Stories selected. You can change plans anytime before confirming the demo checkout.
              </div>
            </aside>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}

function Field({ label, children, fullWidth = false }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <label className={fullWidth ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
