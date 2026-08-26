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
    <PageLayout>
      <main className="bg-[#f2ede1]">
        <div className="container mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-20">
          <div className="w-full border-[3px] border-[#12100c] bg-[#f8f5ec] p-8 text-center hard-shadow md:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center border-[3px] border-[#12100c] bg-[#f2b32e] hard-shadow-sm">
              <CheckCircle2 className="h-10 w-10 text-[#12100c]" />
            </div>

            <p className="mt-8 inline-flex items-center gap-2 border-2 border-[#12100c] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#12100c]">
              <Sparkles className="h-3 w-3" />
              Payment complete
            </p>

            <h1 className="mt-5 font-display text-[40px] uppercase leading-[0.95] text-[#12100c] md:text-[52px]">
              Payment Successful
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4a4535]">
              Your plan is now active.
            </p>

            <div className="mx-auto mt-8 max-w-md border-t-[3px] border-[#12100c] text-left">
              <div className="flex items-center justify-between border-b-[2px] border-[#ddd6c4] py-3 font-mono text-[11px] uppercase tracking-[0.12em]">
                <span className="text-[#6d675a]">Plan</span>
                <span className="text-[#12100c]">{plan} Stories</span>
              </div>
              <div className="flex items-center justify-between border-b-[3px] border-[#12100c] py-3 font-mono text-[11px] uppercase tracking-[0.12em]">
                <span className="text-[#6d675a]">Paid</span>
                <span className="text-[#12100c]">${price}</span>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Link href="/editor/new">
                <Button size="lg">Start Creating</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}