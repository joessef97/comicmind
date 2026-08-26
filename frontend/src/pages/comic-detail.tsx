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

/**
 * Panel placeholder ground passed to the reader. The reader wraps this in
 * `bg-gradient-to-br`, so matching from/to stops render as a flat ink fill —
 * Newsprint has no gradients.
 */
const STYLE_GRADIENTS: Record<string, string> = {
  anime: "from-[#262218] to-[#262218]",
  realistic: "from-[#262218] to-[#262218]",
  cartoon: "from-[#262218] to-[#262218]",
  noir: "from-[#262218] to-[#262218]",
  watercolor: "from-[#262218] to-[#262218]",
  retro: "from-[#262218] to-[#262218]",
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
            className={`transition-transform ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
          >
            <Star
              className={`${sizeClass} ${
                filled ? "fill-[#f2b32e] text-[#12100c]" : "text-[#6d675a]"
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
          <Loader2 className="h-8 w-8 animate-spin text-[#d8402f]" />
        </div>
      </PageLayout>
    );
  }

  if (error || !comic) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="mb-6 font-mono text-[12px] uppercase tracking-[0.12em] text-[#6d675a]">
            {error || "Comic not found"}
          </p>
          <Link href="/browse">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse
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

      {/* Back bar */}
      <div className="border-b-[3px] border-[#12100c] bg-[#f2ede1]">
        <div className="container mx-auto px-4 py-3">
          <Link href="/browse">
            <span className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#4a4535] transition-colors hover:text-[#12100c]">
              <ArrowLeft className="h-3.5 w-3.5" /> Browse Comics
            </span>
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="border-b-4 border-[#12100c] bg-[#f2ede1]">
        <div className="container mx-auto grid gap-8 px-4 py-12 md:py-16 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="border-2 border-[#12100c] bg-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]">
                {comic.style}
              </span>
              <span className="border-2 border-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#12100c]">
                {comic.panels.length} Panels
              </span>
            </div>

            <h1 className="font-display text-[42px] uppercase leading-[0.95] text-[#12100c] md:text-[66px]">
              {comic.title}
            </h1>

            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[#4a4535]">{comic.idea}</p>

            <div className="mt-6 flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#6d675a]">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {comic.authorUsername}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {formatDate(comic.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Layout className="h-3.5 w-3.5" /> {comic.panels.length} Panels
              </span>
            </div>
          </div>

          {/* Rating summary */}
          <div className="flex flex-col gap-3 border-[3px] border-[#12100c] bg-[#f2b32e] p-5 hard-shadow-sm">
            <StarRating value={Math.round(avgRating)} size="lg" />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[36px] leading-none text-[#12100c]">
                {avgRating.toFixed(1)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#12100c]">
                ({ratingCount} rating{ratingCount !== 1 ? "s" : ""})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reader on an ink band */}
      <section className="dark border-b-4 border-[#12100c] bg-[#1b1811] px-4 py-12">
        <div className="mx-auto max-w-[1200px] overflow-visible border-[4px] border-[#f2ede1] bg-[#12100c] p-4 md:p-6">
          <ComicBookReader
            comicId={comic.id}
            title={comic.title}
            panels={comic.panels}
            gradient={gradient}
          />
        </div>
      </section>

      <main className="container mx-auto grid gap-12 px-4 py-14 lg:grid-cols-[1fr_320px]">
        <section>
          {/* Engagement stats between ink rules */}
          <div className="flex flex-wrap items-center gap-6 border-y-[3px] border-[#12100c] py-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#12100c]">
            <span className="flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-[#d8402f]" />
              {avgRating.toFixed(1)} ({ratingCount})
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-[#2f4fd8]" />
              {commentTotal}
            </span>
            <span className="flex items-center gap-1.5">
              <Share2 className="h-4 w-4 text-[#4a4535]" />
              {comic.shares ?? 0}
            </span>
            <span className="flex items-center gap-1.5">
              <Download className="h-4 w-4 text-[#4a4535]" />
              {comic.downloads ?? 0}
            </span>
          </div>

          {/* Public Ratings List */}
          <div className="mb-12 mt-10">
            <div className="mb-5 flex items-center gap-2">
              <Star className="h-5 w-5 text-[#12100c]" />
              <h2 className="font-display text-[26px] uppercase leading-none text-[#12100c]">
                Ratings ({ratingsTotal})
              </h2>
            </div>

            {ratingsList.length === 0 ? (
              <p className="border-y-[2px] border-[#ddd6c4] py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
                No ratings yet. Be the first!
              </p>
            ) : (
              <div className="border-t-[3px] border-[#12100c]">
                {ratingsList.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 border-b-[2px] border-[#ddd6c4] py-3"
                  >
                    {r.avatar ? (
                      <img
                        src={r.avatar}
                        alt={r.username}
                        className="h-8 w-8 border-2 border-[#12100c] object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center border-2 border-[#12100c] bg-[#f2b32e] font-display text-[13px] text-[#12100c]">
                        {r.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[14px] font-semibold text-[#12100c]">{r.username}</span>
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <StarRating value={r.value} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {ratingsTotal > RATINGS_PER_PAGE && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ratingsPage <= 1}
                  onClick={() => fetchRatingsList(ratingsPage - 1)}
                >
                  Previous
                </Button>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6d675a]">
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
          <div className="mb-5 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#12100c]" />
            <h2 className="font-display text-[26px] uppercase leading-none text-[#12100c]">
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
                    className="w-full resize-none border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 py-3 text-[14px] placeholder:text-[#6d675a] focus:outline-none focus:ring-2 focus:ring-[#12100c]"
                  />
                  <div className="mt-1 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                    {commentText.length}/500
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="h-11 self-start"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mb-8 border-[3px] border-dashed border-[#6d675a] p-4 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-[#6d675a]">
              <Link href="/login">
                <span className="cursor-pointer text-[#d8402f] hover:underline">Log in</span>
              </Link>{" "}
              to leave a comment.
            </div>
          )}

          {/* Comment list */}
          <div className="border-t-[3px] border-[#12100c]">
            {comments.length === 0 ? (
              <p className="border-b-[2px] border-[#ddd6c4] py-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
                No comments yet. Be the first!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="border-b-[2px] border-[#ddd6c4] py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center border-2 border-[#12100c] bg-[#f2b32e] font-display text-[12px] text-[#12100c]">
                        {c.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[14px] font-semibold text-[#12100c]">{c.username}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    {user && user.id === c.userId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#6d675a] hover:text-[#d8402f]"
                        onClick={() => handleDeleteComment(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed text-[#4a4535]">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment pagination */}
          {commentTotal > COMMENTS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={commentPage <= 1}
                onClick={() => fetchComments(commentPage - 1)}
              >
                Previous
              </Button>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6d675a]">
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

        {/* Sidebar */}
        <aside className="space-y-8 lg:sticky lg:top-[98px] lg:self-start">
          {user && (
            <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] p-5">
              <h3 className="label-mono mb-4 text-[#12100c]">Rate this comic</h3>
              <div className="flex flex-wrap items-center gap-3">
                <StarRating
                  value={myRating}
                  interactive={!isRating}
                  onChange={handleRate}
                  size="lg"
                />
                {isRating && <Loader2 className="h-4 w-4 animate-spin text-[#6d675a]" />}
                {myRating > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                    You rated {myRating} star{myRating !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="dark border-[3px] border-[#12100c] bg-[#12100c] p-5">
            <h3 className="font-display text-[24px] uppercase leading-none text-[#f2ede1]">
              Make your own
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-[#a39b8b]">
              Six panels, one consistent cast. Start with a sentence.
            </p>
            <Link href="/editor/new">
              <Button className="mt-5 w-full border-[3px] border-[#f2ede1] bg-[#d8402f] text-[#f2ede1] shadow-[5px_5px_0_#f2ede1]">
                Start Creating
              </Button>
            </Link>
          </div>

          <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] p-5">
            <h3 className="label-mono mb-4 text-[#12100c]">Share this comic</h3>
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
        </aside>
      </main>
    </PageLayout>
  );
}
