import { useState, useEffect, useMemo, useCallback, type SyntheticEvent } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Heart, MessageCircle, Share2, Download } from "lucide-react";
import { Link } from "wouter";
import { getDisplayImageUrl } from "@/lib/utils";

interface PublicComic {
  id: string;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: any[];
  createdAt: string;
  authorUsername: string;
  ratingsCount: number;
  commentsCount: number;
  shares: number;
  downloads: number;
}

/** Covers sit on hatched paper until the panel art loads. */
const COVER_GROUND = "art-placeholder";

export default function BrowsePage() {
  const PAGE_SIZE = 18;
  const [comics, setComics] = useState<PublicComic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [previewAspectRatios, setPreviewAspectRatios] = useState<Record<string, string>>({});

  const fetchComics = useCallback(async (nextOffset: number, reset = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/comics/public?limit=${PAGE_SIZE}&offset=${nextOffset}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.comics) ? data.comics : [];
      setComics((prev) => (reset ? list : [...prev, ...list]));
      setOffset(nextOffset + list.length);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      // no-op
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchComics(0, true);
  }, [fetchComics]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const visibleComics = useMemo(() => {
    if (!debouncedSearch) return comics;
    return comics.filter((comic) =>
      comic.title.toLowerCase().includes(debouncedSearch) ||
      comic.idea.toLowerCase().includes(debouncedSearch) ||
      comic.style.toLowerCase().includes(debouncedSearch)
    );
  }, [comics, debouncedSearch]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handlePreviewLoad = (key: string) => (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    setPreviewAspectRatios((prev) => (prev[key] === ratio ? prev : { ...prev, [key]: ratio }));
  };

  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-14">
        <div className="mb-10 flex flex-col gap-6 border-b-4 border-[#12100c] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <h1 className="font-display text-[44px] uppercase leading-[0.95] text-[#12100c] sm:text-[62px]">
              Browse Comics
            </h1>
            <p className="label-mono text-[#6d675a]">Explore comics created by the community.</p>
          </div>

          <form
            className="flex w-full max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedSearch(search.trim().toLowerCase());
            }}
          >
            <Input
              placeholder="Search title, idea, or style"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-r-0"
            />
            <button
              type="submit"
              className="border-[3px] border-[#12100c] bg-[#12100c] px-5 font-display text-sm uppercase tracking-wide text-[#f2ede1]"
            >
              Search
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#d8402f]" />
          </div>
        ) : visibleComics.length === 0 ? (
          <div className="border-[3px] border-dashed border-[#6d675a] py-20 text-center">
            <p className="label-mono text-[#6d675a]">No comics published yet.</p>
          </div>
        ) : (
          <>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {visibleComics.map((comic) => (
              <Link key={comic.id} href={`/comic/${comic.id}`}>
                <div className="group h-full cursor-pointer border-[3px] border-[#12100c] bg-[#f8f5ec] transition-shadow hover:shadow-[6px_6px_0_#12100c]">
                  <div
                    className={`relative w-full overflow-hidden border-b-[3px] border-[#12100c] ${COVER_GROUND}`}
                    style={{ aspectRatio: previewAspectRatios[comic.id] ?? "16 / 9" }}
                  >
                    <span className="absolute right-0 top-0 z-10 border-b-[3px] border-l-[3px] border-[#12100c] bg-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]">
                      {comic.style}
                    </span>
                    {comic.panels?.[0]?.imageUrl &&
                      comic.panels[0].imageUrl !== "/assets/placeholder-panel.png" && (
                        <img
                          src={getDisplayImageUrl(comic.panels[0].imageUrl, "card")}
                          alt={comic.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                          onLoad={handlePreviewLoad(comic.id)}
                        />
                      )}
                  </div>

                  <div className="space-y-3 p-5">
                    <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c] transition-colors group-hover:text-[#d8402f]">
                      {comic.title}
                    </h3>

                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                      By {comic.authorUsername} · {formatDate(comic.createdAt)} ·{" "}
                      {comic.panels?.length || 0} Panels
                    </p>

                    <p className="line-clamp-2 text-[14px] leading-relaxed text-[#4a4535]">
                      {comic.idea}
                    </p>

                    <div className="flex items-center gap-4 border-t-[2px] border-[#ddd6c4] pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4a4535]">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {comic.ratingsCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {comic.commentsCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" /> {comic.shares ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" /> {comic.downloads ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && !debouncedSearch && (
            <div className="mt-12 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fetchComics(offset, false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
          </>
        )}
      </main>
    </PageLayout>
  );
}
