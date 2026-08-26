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
 * Consecutive panels from a single published comic — the same cast, in order.
 *
 * Needs a second request: the list endpoint deliberately trims each comic to
 * its first panel for light list cards (see getPublicComicPreviews), so a run
 * has to come from the detail endpoint, which returns the full set.
 *
 * Returns empty until both requests land, or if no published comic has enough
 * real panels to make the point.
 */
export function useComicRun(count: number): { title: string; panels: string[] } {
  const comics = usePublicComics(12);
  const [run, setRun] = useState<{ title: string; panels: string[] }>({
    title: "",
    panels: [],
  });

  // Candidates are ordered newest first; the first one with a usable run wins.
  const candidateIds = comics
    .filter((comic) => isRealPanel(comic.panels[0]?.imageUrl))
    .map((comic) => comic.id)
    .join(",");

  useEffect(() => {
    if (!candidateIds) return;
    let cancelled = false;

    async function load() {
      for (const id of candidateIds.split(",")) {
        try {
          const res = await fetch(`/api/comics/public/${id}`);
          if (!res.ok) continue;
          const comic = await res.json();

          const panels: string[] = (comic?.panels ?? [])
            .map((p: { imageUrl?: string }) => p?.imageUrl)
            .filter(isRealPanel);

          if (panels.length >= count) {
            if (!cancelled) {
              setRun({
                title: comic.title ?? "",
                panels: panels.slice(0, count).map((url) => getDisplayImageUrl(url, "card")),
              });
            }
            return;
          }
        } catch {
          // Try the next candidate.
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [candidateIds, count]);

  return run;
}

/**
 * A spread of cover art across different comics, for decorative slots that
 * just need real work on screen rather than one continuous story. Cycles the
 * available covers to fill `count` so slots never render empty on a site with
 * only a handful of published comics.
 */
export function usePanelImages(count: number): string[] {
  const comics = usePublicComics(12);

  const covers = comics
    .map((comic) => comic.panels[0]?.imageUrl)
    .filter(isRealPanel);

  if (!covers.length) return [];

  return Array.from({ length: count }, (_, i) =>
    getDisplayImageUrl(covers[i % covers.length], "card"),
  );
}

/**
 * One real cover per art style, keyed by style id.
 *
 * The style showcase must not illustrate "noir" with a watercolour panel, so
 * a card only gets art when a published comic actually used that style —
 * otherwise it keeps the hatch rather than showing something misleading.
 */
export function useStyleSamples(): Record<string, string> {
  const comics = usePublicComics(12);

  const samples: Record<string, string> = {};
  for (const comic of comics) {
    const url = comic.panels[0]?.imageUrl;
    if (comic.style && isRealPanel(url) && !samples[comic.style]) {
      samples[comic.style] = getDisplayImageUrl(url, "card");
    }
  }

  return samples;
}
