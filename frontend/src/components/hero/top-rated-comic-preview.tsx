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
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/70 shadow-2xl bg-card flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No top-rated comics yet</p>
      </div>
    );
  }

  // Loading state
  if (loading || !comic) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/70 shadow-2xl bg-card flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const panels = comic.panels.filter((p) => p.imageUrl);
  if (!panels.length) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/70 shadow-2xl bg-card flex items-center justify-center">
        <p className="text-muted-foreground text-lg">No top-rated comics yet</p>
      </div>
    );
  }

  return (
    <Link href={`/comic/${comic._id}`}>
    <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/70 shadow-2xl bg-card group cursor-pointer">
      {/* Glowing purple border */}
      <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-purple-500 via-primary to-purple-500 opacity-50 blur-sm group-hover:opacity-70 transition-opacity duration-700 -z-10" />

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

      {/* Top gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      {/* Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
        Top Rated Comic
      </div>

      {/* Info bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 space-y-2">
        <h3 className="text-white font-bold text-lg leading-tight truncate">
          {comic.title}
        </h3>
        <div className="flex items-center gap-3 text-sm text-white/80">
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {comic.averageRating.toFixed(1)}
          </span>
          <span className="text-white/50">·</span>
          <span>{comic.ratingsCount} rating{comic.ratingsCount !== 1 ? "s" : ""}</span>
          <span className="text-white/50">·</span>
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentPanel
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-white/40 hover:bg-white/60"
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
