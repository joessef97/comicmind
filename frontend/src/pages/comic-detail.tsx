import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Star,
  MessageCircle,
  ArrowLeft,
  Send,
  Clock,
  Layout,
  User,
  Trash2,
  Heart,
  Share2,
  Download,
} from "lucide-react";
import { ComicBookReader } from "@/components/reader/comic-book-reader";
import { ShareButtons } from "@/components/share-buttons";
import { ComicExportView } from "@/components/comic-export-view";

interface Panel {
  panelNumber: number;
  description: string;
  dialogue: string;
  narration?: string;
  imageUrl: string;
}

interface RatingEntry {
  id: string;
  userId: string;
  value: number;
  username: string;
  avatar?: string;
  createdAt: string;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  comicId: string;
  text: string;
  createdAt: string;
}

interface ComicDetail {
  id: string;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: Panel[];
  createdAt: string;
  averageRating: number;
  ratingCount: number;
  comments: Comment[];
  authorUsername: string;
  shares: number;
  downloads: number;
}

const STYLE_GRADIENTS: Record<string, string> = {
  anime: "from-purple-900 to-indigo-900",
  realistic: "from-slate-800 to-gray-900",
  cartoon: "from-blue-900 to-cyan-900",
  noir: "from-gray-900 to-black",
  watercolor: "from-sky-900 to-teal-900",
  retro: "from-amber-900 to-orange-900",
};

function StarRating({
  value,
  interactive = false,
  onChange,
  size = "md",
}: {
  value: number;
  interactive?: boolean;
  onChange?: (n: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= (hover || value);
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            className={`transition-colors ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
          >
            <Star
              className={`${sizeClass} ${
                filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function ComicDetailPage() {
  const params = useParams<{ id: string }>();
  const comicId = params.id;
  const { user } = useAuth();
  const { toast } = useToast();

  const [comic, setComic] = useState<ComicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportMounted, setExportMounted] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const exportReadyPromiseRef = useRef<Promise<void> | null>(null);
  const exportReadyResolveRef = useRef<(() => void) | null>(null);

  // Rating
  const [myRating, setMyRating] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [isRating, setIsRating] = useState(false);

  // Public ratings list
  const [ratingsList, setRatingsList] = useState<RatingEntry[]>([]);
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [ratingsPage, setRatingsPage] = useState(1);
  const RATINGS_PER_PAGE = 10;

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const COMMENTS_PER_PAGE = 20;

  // ── fetch comic detail ────────────────────────────────────────────
  const fetchComic = async () => {
    try {
      const res = await fetch(`/api/comics/public/${comicId}`);
      if (!res.ok) throw new Error("Comic not found");
      const data = await res.json();
      setComic(data);
    } catch (err: any) {
      setError(err.message || "Failed to load comic");
    } finally {
      setIsLoading(false);
    }
  };

  // ── fetch ratings summary ─────────────────────────────────────────
  const fetchRatingSummary = async () => {
    try {
      const res = await fetch(`/api/comics/${comicId}/ratings/summary`);
      if (res.ok) {
        const data = await res.json();
        setAvgRating(data.average ?? 0);
        setRatingCount(data.count ?? 0);
      }
    } catch { /* silent */ }
  };

  // ── fetch user's own rating ───────────────────────────────────────
  const fetchMyRating = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/comics/${comicId}/rating/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rating) setMyRating(data.rating.value);
      }
    } catch { /* silent */ }
  };

  // ── fetch paginated ratings list ──────────────────────────────────
  const fetchRatingsList = async (page: number) => {
    try {
      const res = await fetch(
        `/api/comics/${comicId}/ratings?limit=${RATINGS_PER_PAGE}&page=${page}`
      );
      if (res.ok) {
        const data = await res.json();
        setRatingsList(data.ratings ?? []);
        setRatingsTotal(data.total ?? 0);
        setRatingsPage(page);
      }
    } catch { /* silent */ }
  };

  // ── fetch paginated comments ──────────────────────────────────────
  const fetchComments = async (page: number) => {
    try {
      const res = await fetch(
        `/api/comics/${comicId}/comments?limit=${COMMENTS_PER_PAGE}&page=${page}`
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
        setCommentTotal(data.total ?? 0);
        setCommentPage(page);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchComic();
    fetchRatingSummary();
    fetchRatingsList(1);
    fetchComments(1);
  }, [comicId]);

  useEffect(() => {
    fetchMyRating();
  }, [comicId, user]);

  const handleExportReady = useCallback(() => {
    setExportReady(true);
    exportReadyResolveRef.current?.();
    exportReadyResolveRef.current = null;
  }, []);

  const prepareExport = useCallback(async () => {
    if (!exportMounted) {
      setExportMounted(true);
    }
    if (exportReady) return;

    if (!exportReadyPromiseRef.current) {
      exportReadyPromiseRef.current = new Promise<void>((resolve) => {
        exportReadyResolveRef.current = resolve;
      });
    }
    await exportReadyPromiseRef.current;
  }, [exportMounted, exportReady]);

  // ── handlers ──────────────────────────────────────────────────────

  const handleRate = async (value: number) => {
    if (!user) {
      toast({ title: "Please log in to rate comics", variant: "destructive" });
      return;
    }
    setIsRating(true);
    try {
      await apiRequest("POST", `/api/comics/${comicId}/rating`, { value });
      setMyRating(value);
      // Refresh summary
      await fetchRatingSummary();
      await fetchRatingsList(1);
      toast({ title: `Rated ${value} star${value !== 1 ? "s" : ""}` });
    } catch (err: any) {
      toast({ title: "Failed to rate", description: err.message, variant: "destructive" });
    } finally {
      setIsRating(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Please log in to comment", variant: "destructive" });
      return;
    }
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await apiRequest("POST", `/api/comics/${comicId}/comments`, {
        text: commentText.trim(),
      });
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setCommentTotal((t) => t + 1);
      setCommentText("");
      toast({ title: "Comment added" });
    } catch (err: any) {
      toast({ title: "Failed to post comment", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentTotal((t) => Math.max(t - 1, 0));
      toast({ title: "Comment deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete comment", description: err.message, variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !comic) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground text-lg mb-4">{error || "Comic not found"}</p>
          <Link href="/browse">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Browse
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const gradient = STYLE_GRADIENTS[comic.style] || STYLE_GRADIENTS.anime;

  return (
    <PageLayout>
      {/* Mount export DOM only when download is requested to avoid eager offscreen image loading. */}
      {exportMounted && (
        <ComicExportView
          ref={exportRef}
          title={comic.title}
          panels={comic.panels}
          onReady={handleExportReady}
        />
      )}

      {/* Hero header */}
      <div className={`bg-gradient-to-br ${gradient} relative`}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
          <Link href="/browse">
            <span className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-6 cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Browse Comics
            </span>
          </Link>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-3">
            {comic.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm mb-4">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" /> {comic.authorUsername}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {formatDate(comic.createdAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Layout className="w-4 h-4" /> {comic.panels.length} Panels
            </span>
            <span className="inline-block bg-white/10 border border-white/20 rounded-md px-2 py-0.5 text-xs font-medium capitalize">
              {comic.style}
            </span>
          </div>

          <p className="text-white/80 max-w-2xl text-base">{comic.idea}</p>

          {/* Rating summary */}
          <div className="flex items-center gap-3 mt-6">
            <StarRating value={Math.round(avgRating)} size="lg" />
            <span className="text-white font-bold text-lg">{avgRating.toFixed(1)}</span>
            <span className="text-white/50 text-sm">
              ({ratingCount} rating{ratingCount !== 1 ? "s" : ""})
            </span>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-10">
        {/* Comic Book Reader */}
        <section className="mb-16">
          <div className="bg-card rounded-md shadow-2xl p-4 md:p-6 max-w-[1200px] mx-auto overflow-visible">
            <ComicBookReader
              comicId={comic.id}
              title={comic.title}
              panels={comic.panels}
              gradient={gradient}
            />
          </div>
        </section>

        {/* Share & Stats Section */}
        <section className="max-w-2xl mb-12">
          <div className="p-5 bg-card rounded-xl border border-border/70">
            <div className="flex flex-wrap items-center gap-5 mb-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="w-4 h-4 text-red-400" />
                {avgRating.toFixed(1)} ({ratingCount})
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                {commentTotal}
              </span>
              <span className="flex items-center gap-1">
                <Share2 className="w-4 h-4 text-green-400" />
                {comic.shares ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-4 h-4 text-purple-400" />
                {comic.downloads ?? 0}
              </span>
            </div>
            <h3 className="text-sm font-medium mb-3">Share this comic</h3>
            <ShareButtons
              comicId={comic.id}
              title={comic.title}
              description={comic.idea}
              exportRef={exportRef}
              prepareExport={prepareExport}
              onShareCountUpdate={(shares) =>
                setComic((prev) => (prev ? { ...prev, shares } : prev))
              }
              onDownloadCountUpdate={(downloads) =>
                setComic((prev) => (prev ? { ...prev, downloads } : prev))
              }
            />
          </div>
        </section>

        {/* Rate & Comment section */}
        <section className="max-w-2xl">
          {/* Your rating */}
          {user && (
            <div className="mb-8 p-5 bg-card rounded-xl border border-border/70">
              <h3 className="text-sm font-medium mb-3">Rate this comic</h3>
              <div className="flex items-center gap-3">
                <StarRating
                  value={myRating}
                  interactive={!isRating}
                  onChange={handleRate}
                  size="lg"
                />
                {isRating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {myRating > 0 && (
                  <span className="text-sm text-muted-foreground">
                    You rated {myRating} star{myRating !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Public Ratings List */}
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-display font-bold">
                Ratings ({ratingsTotal})
              </h2>
            </div>

            {ratingsList.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No ratings yet. Be the first!
              </p>
            ) : (
              <div className="space-y-3">
                {ratingsList.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border/70"
                  >
                    {r.avatar ? (
                      <img
                        src={r.avatar}
                        alt={r.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {r.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{r.username}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <StarRating value={r.value} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {ratingsTotal > RATINGS_PER_PAGE && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ratingsPage <= 1}
                  onClick={() => fetchRatingsList(ratingsPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {ratingsPage} of {Math.ceil(ratingsTotal / RATINGS_PER_PAGE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ratingsPage >= Math.ceil(ratingsTotal / RATINGS_PER_PAGE)}
                  onClick={() => fetchRatingsList(ratingsPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-display font-bold">
              Comments ({commentTotal})
            </h2>
          </div>

          {/* Add comment form */}
          {user ? (
            <form onSubmit={handleComment} className="mb-8">
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts on this comic…"
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-lg bg-card border border-border/80 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  />
                  <div className="text-xs text-muted-foreground/50 text-right mt-1">
                    {commentText.length}/500
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="self-end h-10"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mb-8 p-4 rounded-lg bg-card border border-border/70 text-center text-sm text-muted-foreground">
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer">Log in</span>
              </Link>{" "}
              to leave a comment.
            </div>
          )}

          {/* Comment list */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No comments yet. Be the first!
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="p-4 bg-card rounded-lg border border-border/70"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {c.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{c.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    {user && user.id === c.userId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteComment(c.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment pagination */}
          {commentTotal > COMMENTS_PER_PAGE && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={commentPage <= 1}
                onClick={() => fetchComments(commentPage - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {commentPage} of {Math.ceil(commentTotal / COMMENTS_PER_PAGE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={commentPage >= Math.ceil(commentTotal / COMMENTS_PER_PAGE)}
                onClick={() => fetchComments(commentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      </main>
    </PageLayout>
  );
}
