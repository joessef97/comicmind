import { useState, useEffect, useCallback, useRef } from "react";
import { Star } from "lucide-react";
import { Link } from "wouter";
import { getDisplayImageUrl } from "@/lib/utils";

interface TopRatedComic {
  _id: string;
  title: string;
  averageRating: number;
  ratingsCount: number;
  authorName: string;
  panels: { imageUrl: string }[];
}

const PANEL_INTERVAL = 2500;
const REFETCH_INTERVAL = 30000;

export function TopRatedComicPreview() {
  const [comic, setComic] = useState<TopRatedComic | null>(null);
  const [currentPanel, setCurrentPanel] = useState(0);
  const [fade, setFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const prevComicId = useRef<string | null>(null);

  const fetchTopComic = useCallback(async () => {
    try {
      const res = await fetch("/api/comics/top-rated-preview");
      if (!res.ok) return;
      const data = await res.json();
      if (!data) {
        setComic(null);
        return;
      }
      // If a different comic became top-rated, reset panel index
      if (prevComicId.current !== data._id) {
        setCurrentPanel(0);
        setFade(true);
        prevComicId.current = data._id;
      }
      setComic(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + refetch every 15s
  useEffect(() => {
    fetchTopComic();
    const id = setInterval(fetchTopComic, REFETCH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchTopComic]);

  // Panel cycling
  useEffect(() => {
    if (!comic || comic.panels.length <= 1) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const panelCount = comic.panels.filter((p) => p.imageUrl).length;
    if (panelCount <= 1) return;
    const intervalId = setInterval(() => {
      setFade(false);
      timeoutId = setTimeout(() => {
        setCurrentPanel((prev) => (prev + 1) % panelCount);
        setFade(true);
      }, 300);
    }, PANEL_INTERVAL);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [comic?._id, comic?.panels.length]);

  // Fallback: no comic
  if (!loading && !comic) {
    return (
      <div className="art-placeholder-ink relative flex aspect-video items-center justify-center overflow-hidden">
        <p className="label-mono text-[#a39b8b]">No top-rated comics yet</p>
      </div>
    );
  }

  // Loading state
  if (loading || !comic) {
    return (
      <div className="art-placeholder-ink relative flex aspect-video items-center justify-center overflow-hidden">
        <div className="h-8 w-8 animate-spin border-[3px] border-[#f2b32e] border-t-transparent" />
      </div>
    );
  }

  const panels = comic.panels.filter((p) => p.imageUrl);
  if (!panels.length) {
    return (
      <div className="art-placeholder-ink relative flex aspect-video items-center justify-center overflow-hidden">
        <p className="label-mono text-[#a39b8b]">No top-rated comics yet</p>
      </div>
    );
  }

  return (
    <Link href={`/comic/${comic._id}`}>
    <div className="group relative aspect-video cursor-pointer overflow-hidden bg-[#1b1811]">
      {/* Panel image with fade + zoom */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-in-out"
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? "scale(1.02)" : "scale(1)",
        }}
      >
        <img
          src={getDisplayImageUrl(panels[currentPanel]?.imageUrl, "card")}
          alt={`${comic.title} – panel ${currentPanel + 1}`}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </div>

      {/* Badge */}
      <div className="absolute left-0 top-0 flex items-center gap-1.5 border-b-[3px] border-r-[3px] border-[#12100c] bg-[#f2b32e] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#12100c]">
        <Star className="h-3 w-3 fill-[#12100c]" />
        Top Rated Comic
      </div>

      {/* Info bar */}
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 border-t-[3px] border-[#f2ede1] bg-[#12100c] p-3">
        <h3 className="truncate font-display text-lg uppercase leading-none text-[#f2ede1]">
          {comic.title}
        </h3>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#a39b8b]">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-[#f2b32e] text-[#f2b32e]" />
            {comic.averageRating.toFixed(1)}
          </span>
          <span>·</span>
          <span>{comic.ratingsCount} rating{comic.ratingsCount !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>by {comic.authorName}</span>
        </div>

        {/* Panel indicators */}
        {panels.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {panels.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setFade(false);
                  setTimeout(() => {
                    setCurrentPanel(i);
                    setFade(true);
                  }, 200);
                }}
                className={`h-1.5 transition-all duration-300 ${
                  i === currentPanel
                    ? "w-6 bg-[#d8402f]"
                    : "w-1.5 bg-[#a39b8b] hover:bg-[#f2ede1]"
                }`}
                aria-label={`Go to panel ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </Link>
  );
}
