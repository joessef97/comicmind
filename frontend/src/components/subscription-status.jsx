import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function SubscriptionStatus() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSubscription() {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/user/subscription", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });

        if (response.status === 401) {
          setLocation("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("We could not load your subscription right now.");
        }

        const payload = await response.json();
        if (isMounted) {
          setData(payload);
        }
      } catch {
        if (isMounted) {
          setError("Unable to fetch subscription details. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSubscription();
    return () => {
      isMounted = false;
    };
  }, [setLocation]);

  const progressPercent = useMemo(() => {
    if (!data || !data.comicsLimit || data.comicsLimit <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((data.comicsUsed / data.comicsLimit) * 100)));
  }, [data]);

  if (loading) {
    return (
      <section className="mt-4 border-[3px] border-[#12100c] bg-[#f8f5ec] p-5">
        <div className="mb-4 h-5 w-44 animate-pulse bg-[#ddd6c4]" />
        <div className="mb-3 h-4 w-56 animate-pulse bg-[#ddd6c4]" />
        <div className="mb-6 h-4 w-64 animate-pulse bg-[#ddd6c4]" />
        <div className="h-2 w-full animate-pulse bg-[#ddd6c4]" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-4 border-[3px] border-[#12100c] bg-[#d8402f] p-5">
        <h3 className="font-display text-[20px] uppercase leading-none text-[#f2ede1]">Subscription Unavailable</h3>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f2ede1]">{error}</p>
      </section>
    );
  }

  if (data?.isActive) {
    return (
      <section className="mt-4 border-[3px] border-[#12100c] bg-[#f2b32e] p-5 hard-shadow-sm">
        <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c]">Your Subscription</h3>
        <div className="mt-4 grid gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#12100c] md:grid-cols-2">
          <p><span className="font-medium">Plan:</span> {data.packageName || "-"}</p>
          <p><span className="font-medium">Remaining comics:</span> {Math.max(0, data.remainingComics ?? 0)}</p>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#12100c]">
            <span>Usage</span>
            <span>{data.comicsUsed} / {data.comicsLimit}</span>
          </div>
          <div className="h-3 w-full overflow-hidden border-2 border-[#12100c] bg-[#f8f5ec]">
            <div
              className="h-full bg-[#12100c] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 border-[3px] border-[#12100c] bg-[#f8f5ec] p-5">
      <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c]">No Active Subscription</h3>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#6d675a]">You are not subscribed.</p>
      <Button
        type="button"
        className="mt-4"
        onClick={() => {
          setLocation("/user-guide#packages");
        }}
      >
        Subscribe Now
      </Button>
    </section>
  );
}
