import { useState, useEffect, type SyntheticEvent } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Clock, Layout, Loader2, Trash2, FileText, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SubscriptionStatus from "@/components/subscription-status";

interface Comic {
  id: string;
  title: string;
  style: string;
  idea: string;
  panels: any[];
  published: boolean;
  createdAt: string;
}

interface Draft {
  id: string;
  title: string;
  style: string;
  idea: string;
  panels: any[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

type TabType = "all" | "comics" | "drafts";

interface DashboardViewStateCache {
  comics: Comic[];
  drafts: Draft[];
  activeTab: TabType;
  previewAspectRatios: Record<string, string>;
  scrollY: number;
}

let dashboardViewStateCache: DashboardViewStateCache | null = null;

/** Panel previews sit on hatched ink until the art loads. */
const COVER_GROUND = "art-placeholder-ink";

/** Status stamps: draft yellow, generating blue, completed ink, failed red. */
const STATUS_BADGES: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-[#f2b32e] text-[#12100c]",
    icon: <FileText className="w-3 h-3" />,
  },
  GENERATING: {
    label: "Generating",
    className: "bg-[#2f4fd8] text-[#f2ede1]",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-[#12100c] text-[#f2ede1]",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  FAILED: {
    label: "Failed",
    className: "bg-[#d8402f] text-[#f2ede1]",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

const STAMP_BASE =
  "absolute left-0 top-0 z-10 flex items-center gap-1.5 border-b-[3px] border-r-[3px] border-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]";
const STYLE_STAMP =
  "absolute right-0 top-0 z-10 border-b-[3px] border-l-[3px] border-[#12100c] bg-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]";
const CARD_SHELL =
  "group h-full cursor-pointer border-[3px] border-[#12100c] bg-[#f8f5ec] transition-shadow hover:shadow-[6px_6px_0_#12100c]";

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [comics, setComics] = useState<Comic[]>(() => dashboardViewStateCache?.comics ?? []);
  const [drafts, setDrafts] = useState<Draft[]>(() => dashboardViewStateCache?.drafts ?? []);
  const [isLoading, setIsLoading] = useState(() => !dashboardViewStateCache);
  const [activeTab, setActiveTab] = useState<TabType>(() => dashboardViewStateCache?.activeTab ?? "all");
  const [previewAspectRatios, setPreviewAspectRatios] = useState<Record<string, string>>(
    () => dashboardViewStateCache?.previewAspectRatios ?? {},
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  const fetchData = async () => {
    try {
      const [comicsRes, draftsRes, subRes] = await Promise.all([
        apiRequest("GET", "/api/comics?limit=50"),
        apiRequest("GET", "/api/drafts?limit=50"),
        apiRequest("GET", "/api/user/subscription"),
      ]);
      const comicsData = await comicsRes.json();
      const draftsData = await draftsRes.json();
      setComics(comicsData.comics);
      setDrafts(
        (draftsData.drafts || []).filter(
          (d: Draft) =>
            d.status !== "COMPLETED" && !(d.status === "GENERATING" && (!d.panels || d.panels.length === 0)),
        ),
      );
      const subData = await subRes.json();
      setIsSubscribed(!!subData.isActive);
    } catch (error: any) {
      toast({ title: "Failed to load projects", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    dashboardViewStateCache = {
      comics,
      drafts,
      activeTab,
      previewAspectRatios,
      scrollY: window.scrollY,
    };
  }, [comics, drafts, activeTab, previewAspectRatios]);

  useEffect(() => {
    if (!dashboardViewStateCache) return;

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: dashboardViewStateCache?.scrollY ?? 0, behavior: "auto" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const handleSubscribeNow = () => {
    setLocation("/user-guide#packages");
  };

  const handleDeleteComic = async (e: React.MouseEvent, comicId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/comics/${comicId}`);
      setComics((prev) => prev.filter((c) => c.id !== comicId));
      toast({ title: "Comic deleted" });
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDraft = async (e: React.MouseEvent, draftId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/drafts/${draftId}`);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast({ title: "Draft deleted" });
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  };

  const handleRegenerateProject = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/editor/${projectId}?regenerate=1`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handlePreviewLoad = (key: string) => (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    setPreviewAspectRatios((prev) => (prev[key] === ratio ? prev : { ...prev, [key]: ratio }));
  };

  const showComics = activeTab === "all" || activeTab === "comics";
  const showDrafts = activeTab === "all" || activeTab === "drafts";

  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-6 border-b-4 border-[#12100c] pb-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <h1 className="font-display text-[42px] uppercase leading-[0.95] text-[#12100c] sm:text-[58px]">
              Your Studio
            </h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
              Manage your comic projects and drafts.
            </p>
            <SubscriptionStatus />
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            {!isSubscribed && (
              <Button variant="outline" onClick={handleSubscribeNow}>
                Subscribe Now
              </Button>
            )}
            <Link href="/editor/new">
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New Comic
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs — joined square segments. */}
        <div className="mb-10 inline-flex">
          {([
            { key: "all" as TabType, label: "All", count: comics.length + drafts.length },
            { key: "comics" as TabType, label: "Comics", count: comics.length },
            { key: "drafts" as TabType, label: "Drafts", count: drafts.length },
          ]).map((tab, index) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-2 border-[#12100c] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                index > 0 ? "border-l-0" : ""
              } ${
                activeTab === tab.key
                  ? "bg-[#12100c] text-[#f2ede1]"
                  : "bg-transparent text-[#4a4535] hover:bg-[#ddd6c4]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#d8402f]" />
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Draft Cards */}
            {showDrafts && drafts.map((draft) => {
              const badge = STATUS_BADGES[draft.status] || STATUS_BADGES.DRAFT;
              return (
                <Link key={`draft-${draft.id}`} href={`/editor/${draft.id}`}>
                  <div className={CARD_SHELL}>
                    <div
                      className={`relative w-full overflow-hidden border-b-[3px] border-[#12100c] ${COVER_GROUND}`}
                      style={{ aspectRatio: previewAspectRatios[`draft-${draft.id}`] ?? "16 / 9" }}
                    >
                      <div className={`${STAMP_BASE} ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </div>
                      <div className={STYLE_STAMP}>{draft.style}</div>
                      {/* Show first panel image if available */}
                      {draft.panels?.[0]?.imageUrl && (
                        <img
                          src={draft.panels[0].imageUrl}
                          alt={draft.title}
                          className="h-full w-full object-contain"
                          onLoad={handlePreviewLoad(`draft-${draft.id}`)}
                        />
                      )}
                    </div>

                    <div className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c] transition-colors group-hover:text-[#d8402f]">
                          {draft.title}
                        </h3>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#6d675a] hover:text-[#d8402f]"
                            onClick={(e) => handleRegenerateProject(e, draft.id)}
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#6d675a] hover:text-[#d8402f]"
                            onClick={(e) => handleDeleteDraft(e, draft.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="mb-4 line-clamp-2 text-[14px] leading-relaxed text-[#4a4535]">
                        {draft.idea || "No description yet"}
                      </p>

                      <div className="flex items-center gap-4 border-t-[2px] border-[#ddd6c4] pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4a4535]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatDate(draft.updatedAt)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layout className="h-3 w-3" />
                          {draft.panels?.length || 0} Panels
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Comic Cards */}
            {showComics && comics.map((comic) => (
              <Link key={`comic-${comic.id}`} href={`/editor/${comic.id}`}>
                <div className={CARD_SHELL}>
                  <div
                    className={`relative w-full overflow-hidden border-b-[3px] border-[#12100c] ${COVER_GROUND}`}
                    style={{ aspectRatio: previewAspectRatios[`comic-${comic.id}`] ?? "16 / 9" }}
                  >
                    <div
                      className={`${STAMP_BASE} ${
                        comic.published ? "bg-[#12100c] text-[#f2ede1]" : "bg-[#f2b32e] text-[#12100c]"
                      }`}
                    >
                      {comic.published ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      {comic.published ? 'Published' : 'Unpublished'}
                    </div>
                    <div className={STYLE_STAMP}>{comic.style}</div>
                    {/* Show first panel image if available */}
                    {comic.panels?.[0]?.imageUrl && (
                      <img
                        src={comic.panels[0].imageUrl}
                        alt={comic.title}
                        className="h-full w-full object-contain"
                        onLoad={handlePreviewLoad(`comic-${comic.id}`)}
                      />
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c] transition-colors group-hover:text-[#d8402f]">
                        {comic.title}
                      </h3>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#6d675a] hover:text-[#d8402f]"
                          onClick={(e) => handleRegenerateProject(e, comic.id)}
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#6d675a] hover:text-[#d8402f]"
                          onClick={(e) => handleDeleteComic(e, comic.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="mb-4 line-clamp-2 text-[14px] leading-relaxed text-[#4a4535]">{comic.idea}</p>

                    <div className="flex items-center gap-4 border-t-[2px] border-[#ddd6c4] pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4a4535]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDate(comic.createdAt)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layout className="h-3 w-3" />
                        {comic.panels?.length || 0} Panels
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Create New Card Placeholder */}
            <Link href="/editor/new">
              <div className="flex h-full min-h-[300px] cursor-pointer flex-col items-center justify-center gap-4 border-4 border-dashed border-[#12100c] text-[#4a4535] transition-colors hover:bg-[#ddd6c4] hover:text-[#12100c]">
                <div className="flex h-16 w-16 items-center justify-center border-[3px] border-[#12100c] bg-[#f8f5ec]">
                  <Plus className="h-8 w-8" />
                </div>
                <span className="font-display text-[18px] uppercase tracking-wide">Create New Project</span>
              </div>
            </Link>
          </div>
        )}

        {!isLoading && comics.length === 0 && drafts.length === 0 && (
          <div className="mt-10 border-[3px] border-dashed border-[#6d675a] py-20 text-center">
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
              You haven't created any comics yet.
            </p>
            <Link href="/editor/new">
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Create Your First Comic
              </Button>
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}