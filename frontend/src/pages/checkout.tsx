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
    <PageLayout>
      <main className="bg-[#f2ede1]">
        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mb-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#4a4535]">
            <Lock className="h-4 w-4 text-[#d8402f]" />
            Demo payment flow
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="border-[3px] border-[#12100c] bg-[#f8f5ec] p-6 md:p-8">
              <div className="mb-8">
                <p className="inline-flex items-center gap-2 border-[3px] border-[#12100c] bg-[#f2b32e] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#12100c] hard-shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Secure Checkout
                </p>
                <h1 className="mt-6 font-display text-[40px] uppercase leading-[0.95] text-[#12100c] md:text-[52px]">
                  Secure Checkout
                </h1>
                <p className="mt-4 text-[15px] leading-relaxed text-[#4a4535]">
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
                    className="h-12 w-full border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 font-mono text-[13px] text-[#12100c] outline-none placeholder:text-[#6d675a] focus:ring-2 focus:ring-[#12100c]"
                  />
                </Field>
                <Field label="Name on Card" fullWidth>
                  <input
                    value={form.name}
                    onChange={handleChange("name")}
                    placeholder="Jane Doe"
                    className="h-12 w-full border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 font-mono text-[13px] text-[#12100c] outline-none placeholder:text-[#6d675a] focus:ring-2 focus:ring-[#12100c]"
                  />
                </Field>
                <Field label="Expiry Date">
                  <input
                    value={form.expiry}
                    onChange={handleChange("expiry")}
                    placeholder="MM / YY"
                    className="h-12 w-full border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 font-mono text-[13px] text-[#12100c] outline-none placeholder:text-[#6d675a] focus:ring-2 focus:ring-[#12100c]"
                  />
                </Field>
                <Field label="CVC">
                  <input
                    value={form.cvc}
                    onChange={handleChange("cvc")}
                    placeholder="123"
                    className="h-12 w-full border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 font-mono text-[13px] text-[#12100c] outline-none placeholder:text-[#6d675a] focus:ring-2 focus:ring-[#12100c]"
                  />
                </Field>
              </div>

              <div className="mt-6 border-[3px] border-dashed border-[#6d675a] p-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-[#4a4535]">
                This is a demo payment. No real transaction will occur.
              </div>

              <div className="mt-8">
                <Button
                  onClick={handlePayNow}
                  disabled={isProcessing}
                  size="lg"
                  className="w-full disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isProcessing ? (
                    <>
                      <span className="h-4 w-4 animate-spin border-2 border-[#f2ede1] border-t-transparent" />
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
                  <p className="mt-4 border-[3px] border-[#12100c] bg-[#d8402f] p-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f2ede1]">
                    {errorMessage}
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="dark h-fit border-[3px] border-[#12100c] bg-[#12100c] p-6 md:p-8">
              <div className="mb-6 border-b-[3px] border-[#f2ede1] pb-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a39b8b]">
                  Order Summary
                </p>
                <h2 className="mt-3 font-display text-[28px] uppercase leading-none text-[#f2ede1]">
                  {formatPlanName(plan)}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-[#a39b8b]">
                  Perfect for exploring ComicMind’s AI comic creation workflow.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">
                  <span>{formatPlanName(plan)}</span>
                  <span>{formattedPrice}</span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-[#a39b8b]">
                  Includes a flexible demo plan for generating comic stories with AI-powered tools.
                </p>

                <div className="my-6 h-[3px] bg-[#f2ede1]" />

                <div className="flex items-center justify-between border-[3px] border-[#12100c] bg-[#f2b32e] px-4 py-3 font-display text-[22px] uppercase leading-none text-[#12100c]">
                  <span>Total</span>
                  <span>{formattedPrice}</span>
                </div>
              </div>

              <div className="mt-6 border-2 border-[#4a4535] p-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-[#a39b8b]">
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
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.14em] text-[#4a4535]">{label}</span>
      {children}
    </label>
  );
}
