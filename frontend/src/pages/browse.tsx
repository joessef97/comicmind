import { useState, useEffect, useMemo, useCallback, type SyntheticEvent } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Layout, Clock, User, Heart, MessageCircle, Share2, Download } from "lucide-react";
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
  ratingsCount: number;
  commentsCount: number;
  shares: number;
  downloads: number;
}

const STYLE_GRADIENTS: Record<string, string> = {
  anime: "bg-gradient-to-br from-purple-900 to-indigo-900",
  realistic: "bg-gradient-to-br from-slate-800 to-gray-900",
  cartoon: "bg-gradient-to-br from-blue-900 to-cyan-900",
  noir: "bg-gradient-to-br from-gray-900 to-black",
  watercolor: "bg-gradient-to-br from-sky-900 to-teal-900",
  retro: "bg-gradient-to-br from-amber-900 to-orange-900",
};

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
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Browse Comics</h1>
          <p className="text-muted-foreground">Explore comics created by the community.</p>
          <div className="mt-4 max-w-sm">
            <Input
              placeholder="Search title, idea, or style"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : visibleComics.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No comics published yet.</p>
          </div>
        ) : (
          <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleComics.map((comic) => (
              <Link key={comic.id} href={`/comic/${comic.id}`}>
                <div className="group relative bg-card rounded-xl border border-border/70 overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/10">
                  
                  
                  <div
                    className={`w-full ${STYLE_GRADIENTS[comic.style] || STYLE_GRADIENTS.anime} relative`}
                    style={{ aspectRatio: previewAspectRatios[comic.id] ?? "16 / 9" }}
                  >
                    <div className="absolute inset-0 bg-foreground/15 group-hover:bg-transparent transition-colors" />
                    <div className="absolute top-4 right-4 bg-background/85 backdrop-blur-md px-2 py-1 rounded-md text-xs font-medium border border-border/70 capitalize">
                      {comic.style}
                    </div>
                    {comic.panels?.[0]?.imageUrl &&
                      comic.panels[0].imageUrl !== "/assets/placeholder-panel.png" && (
                        <img
                          src={getDisplayImageUrl(comic.panels[0].imageUrl, "card")}
                          alt={comic.title}
                          className="w-full h-full object-contain bg-muted/40"
                          loading="lazy"
                          decoding="async"
                          onLoad={handlePreviewLoad(comic.id)}
                        />
                      )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors mb-1">
                      {comic.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {comic.idea}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {formatDate(comic.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layout className="w-3.5 h-3.5" /> {comic.panels?.length || 0} Panels
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> {comic.ratingsCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> {comic.commentsCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" /> {comic.shares ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" /> {comic.downloads ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && !debouncedSearch && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchComics(offset, false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
