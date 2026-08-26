import { useEffect, useState } from "react";
import { getDisplayImageUrl } from "@/lib/utils";

/**
 * Shape returned by GET /api/comics/public.
 * Mirrors getPublicComicPreviews() plus the enrichment in getPublicComics():
 * note the id is `id` (not `_id`), the author is `authorUsername`, and there
 * is no cover field — the first panel is the cover.
 */
export interface PublicComic {
  id: string;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: { imageUrl?: string }[];
  shares: number;
  downloads: number;
  createdAt: string;
  authorUsername: string;
  ratingsCount: number;
  averageRating: number;
  commentsCount: number;
}

const PLACEHOLDER_PANEL = "/assets/placeholder-panel.png";

function isRealPanel(url?: string): url is string {
  return Boolean(url) && url !== PLACEHOLDER_PANEL;
}

/** Published comics, newest first — exactly what the endpoint returns. */
export function usePublicComics(limit = 12): PublicComic[] {
  const [comics, setComics] = useState<PublicComic[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/comics/public?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.comics)) {
          setComics(data.comics as PublicComic[]);
        }
      } catch {
        // Callers fall back to their placeholder treatment.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return comics;
}

/**
 * Consecutive panels from a single published comic — the same cast in order.
 * Picks the comic with the most usable panels so the run is as long as
 * possible. Returns [] until the fetch lands or if nothing qualifies.
 */
export function useComicRun(count: number): { title: string; panels: string[] } {
  const comics = usePublicComics(12);

  const best = comics
    .map((comic) => ({
      title: comic.title,
      panels: comic.panels.map((p) => p?.imageUrl).filter(isRealPanel),
    }))
    .sort((a, b) => b.panels.length - a.panels.length)[0];

  if (!best || best.panels.length === 0) return { title: "", panels: [] };

  return {
    title: best.title,
    panels: best.panels.slice(0, count).map((url) => getDisplayImageUrl(url, "card")),
  };
}

/**
 * A spread of panel art across many different comics, for decorative slots
 * that just need real work on screen rather than one continuous story.
 */
export function usePanelImages(count: number): string[] {
  const comics = usePublicComics(12);

  const urls: string[] = [];
  // Take one panel per comic first so the spread shows variety.
  for (let round = 0; urls.length < count && round < 6; round += 1) {
    for (const comic of comics) {
      const url = comic.panels[round]?.imageUrl;
      if (isRealPanel(url) && !urls.includes(url)) {
        urls.push(url);
        if (urls.length === count) break;
      }
    }
  }

  return urls.map((url) => getDisplayImageUrl(url, "card"));
}
