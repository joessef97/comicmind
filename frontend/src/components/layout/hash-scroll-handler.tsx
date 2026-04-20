import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";

interface HashScrollHandlerProps {
  delayMs?: number;
  maxRetries?: number;
}

export function HashScrollHandler({ delayMs = 100, maxRetries = 10 }: HashScrollHandlerProps) {
  const [location] = useLocation();

  const scrollToHash = useCallback(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = decodeURIComponent(hash.replace("#", ""));
    if (!id) return;

    const attemptScroll = (attempt: number) => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempt < maxRetries) {
        window.setTimeout(() => attemptScroll(attempt + 1), delayMs);
      }
    };

    window.setTimeout(() => attemptScroll(0), delayMs);
  }, [delayMs, maxRetries]);

  useEffect(() => {
    scrollToHash();
  }, [location, scrollToHash]);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHash);
    window.addEventListener("popstate", scrollToHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHash);
      window.removeEventListener("popstate", scrollToHash);
    };
  }, [scrollToHash]);

  return null;
}