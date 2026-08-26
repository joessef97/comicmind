import { useEffect, useState } from "react";
import { getDisplayImageUrl } from "@/lib/utils";

interface PublicComicLike {
  coverUrl?: string;
  panels?: { imageUrl?: string }[];
}

const PLACEHOLDER_PANEL = "/assets/placeholder-panel.png";

/**
 * Real panel art from published comics, used to fill the decorative art slots
 * on the marketing pages instead of leaving them as empty hatching.
 *
 * Returns fewer than `count` (possibly zero) when the API is unavailable or
 * there is not enough published work yet; callers fall back to the hatch.
 */
export function usePanelImages(count: number): string[] {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/comics/public?limit=12");
        if (!res.ok) return;
        const data = await res.json();
        const comics: PublicComicLike[] = Array.isArray(data.comics) ? data.comics : [];

        const urls: string[] = [];
        for (const comic of comics) {
          for (const candidate of [comic.coverUrl, ...(comic.panels ?? []).map((p) => p?.imageUrl)]) {
            if (candidate && candidate !== PLACEHOLDER_PANEL && !urls.includes(candidate)) {
              urls.push(candidate);
            }
          }
        }

        if (!cancelled) {
          setImages(urls.slice(0, count).map((url) => getDisplayImageUrl(url, "card")));
        }
      } catch {
        // Callers fall back to the hatch.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [count]);

  return images;
}
