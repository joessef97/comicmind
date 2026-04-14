import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";

function parseQuery(search: string) {
  const params = new URLSearchParams(search);
  return {
    plan: params.get("plan") || "3",
    price: params.get("price") || "4.99",
  };
}

export default function Success() {
  const [location] = useLocation();
  const { plan, price } = useMemo(() => parseQuery(location.split("?")[1] ? `?${location.split("?")[1]}` : ""), [location]);

  return (
    <PageLayout className="bg-gradient-to-b from-black via-[#0a0a0f] to-black text-foreground">
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-140px] h-[340px] w-[620px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-pink-500/20 blur-3xl" />
          <div className="absolute right-[8%] top-[40%] h-[240px] w-[240px] rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <div className="container mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>

            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Payment complete
            </p>

            <h1 className="mt-5 text-4xl font-display font-bold tracking-tight text-white md:text-5xl">
              Payment Successful
            </h1>
            <p className="mt-4 text-base text-white/70 md:text-lg">
              Your plan is now active.
            </p>

            <div className="mx-auto mt-8 max-w-md rounded-xl border border-white/10 bg-black/20 p-5 text-left text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Plan</span>
                <span className="font-semibold text-white">{plan} Stories</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-white/60">Paid</span>
                <span className="font-semibold text-white">${price}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Link href="/editor/new">
                <Button className="min-h-11 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-7 text-white shadow-[0_12px_36px_rgba(168,85,247,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_44px_rgba(217,70,239,0.45)]">
                  Start Creating
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}