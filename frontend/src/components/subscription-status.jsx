import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

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
      <section className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 h-5 w-44 animate-pulse rounded bg-muted" />
        <div className="mb-3 h-4 w-56 animate-pulse rounded bg-muted" />
        <div className="mb-6 h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-4 rounded-xl border border-red-300/60 bg-red-50 p-5 shadow-sm dark:border-red-500/30 dark:bg-red-950/20">
        <h3 className="text-base font-semibold text-red-700 dark:text-red-300">Subscription Unavailable</h3>
        <p className="mt-1 text-sm text-red-700/90 dark:text-red-300/90">{error}</p>
      </section>
    );
  }

  if (data?.isActive) {
    return (
      <section className="mt-4 rounded-xl border border-green-300/60 bg-green-50 p-5 shadow-sm transition-all hover:shadow-md dark:border-green-500/30 dark:bg-green-950/20">
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">Your Subscription</h3>
        <div className="mt-3 grid gap-2 text-sm text-green-900 dark:text-green-200 md:grid-cols-2">
          <p><span className="font-medium">Plan:</span> {data.packageName || "-"}</p>
          <p><span className="font-medium">Remaining comics:</span> {Math.max(0, data.remainingComics ?? 0)}</p>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-green-800 dark:text-green-300">
            <span>Usage</span>
            <span>{data.comicsUsed} / {data.comicsLimit}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-green-200/70 dark:bg-green-900/50">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-muted/40 p-5 shadow-sm transition-all hover:shadow-md">
      <h3 className="text-lg font-semibold text-foreground">No Active Subscription</h3>
      <p className="mt-1 text-sm text-muted-foreground">You are not subscribed.</p>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem("scrollToPackages", "1");
          setLocation("/user-guide#packages");
        }}
        className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Subscribe Now
      </button>
    </section>
  );
}
