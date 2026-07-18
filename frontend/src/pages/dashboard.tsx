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

const STYLE_GRADIENTS: Record<string, string> = {
  anime: "bg-gradient-to-br from-purple-900 to-indigo-900",
  realistic: "bg-gradient-to-br from-slate-800 to-gray-900",
  cartoon: "bg-gradient-to-br from-blue-900 to-cyan-900",
  noir: "bg-gradient-to-br from-gray-900 to-black",
  watercolor: "bg-gradient-to-br from-sky-900 to-teal-900",
  retro: "bg-gradient-to-br from-amber-900 to-orange-900",
};

const STATUS_BADGES: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: <FileText className="w-3 h-3" />,
  },
  GENERATING: {
    label: "Generating",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

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
    setLocation("/pricing");
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Your Studio</h1>
            <p className="text-muted-foreground">Manage your comic projects and drafts.</p>
            <SubscriptionStatus />
          </div>
          <div className="flex items-center gap-3">
            {!isSubscribed && (
              <Button variant="outline" onClick={handleSubscribeNow}>
                Subscribe Now
              </Button>
            )}
            <Link href="/editor/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> New Comic
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {([
            { key: "all" as TabType, label: "All", count: comics.length + drafts.length },
            { key: "comics" as TabType, label: "Comics", count: comics.length },
            { key: "drafts" as TabType, label: "Drafts", count: drafts.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Draft Cards */}
            {showDrafts && drafts.map((draft) => {
              const badge = STATUS_BADGES[draft.status] || STATUS_BADGES.DRAFT;
              return (
                <Link key={`draft-${draft.id}`} href={`/editor/${draft.id}`}>
                  <div className="group relative bg-card rounded-xl border border-border/70 overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/10">
                    <div
                      className={`w-full ${STYLE_GRADIENTS[draft.style] || STYLE_GRADIENTS.anime} relative`}
                      style={{ aspectRatio: previewAspectRatios[`draft-${draft.id}`] ?? "16 / 9" }}
                    >
                      <div className="absolute inset-0 bg-foreground/15 group-hover:bg-transparent transition-colors" />
                      {/* Status badge */}
                      <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </div>
                      <div className="absolute top-4 right-4 bg-background/85 backdrop-blur-md px-2 py-1 rounded-md text-xs font-medium border border-border/70">
                        {draft.style}
                      </div>
                      {/* Show first panel image if available */}
                      {draft.panels?.[0]?.imageUrl && (
                        <img
                          src={draft.panels[0].imageUrl}
                          alt={draft.title}
                          className="w-full h-full object-contain bg-muted/40"
                          onLoad={handlePreviewLoad(`draft-${draft.id}`)}
                        />
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors">
                          {draft.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={(e) => handleRegenerateProject(e, draft.id)}
                          >
                            <Wand2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteDraft(e, draft.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{draft.idea || "No description yet"}</p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(draft.updatedAt)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layout className="w-3.5 h-3.5" />
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
                <div className="group relative bg-card rounded-xl border border-border/70 overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/10">
                  <div
                    className={`w-full ${STYLE_GRADIENTS[comic.style] || STYLE_GRADIENTS.anime} relative`}
                    style={{ aspectRatio: previewAspectRatios[`comic-${comic.id}`] ?? "16 / 9" }}
                  >
                    <div className="absolute inset-0 bg-foreground/15 group-hover:bg-transparent transition-colors" />
                    <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${comic.published ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {comic.published ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      {comic.published ? 'Published' : 'Unpublished'}
                    </div>
                    <div className="absolute top-4 right-4 bg-background/85 backdrop-blur-md px-2 py-1 rounded-md text-xs font-medium border border-border/70">
                      {comic.style}
                    </div>
                    {/* Show first panel image if available */}
                    {comic.panels?.[0]?.imageUrl && (
                      <img
                        src={comic.panels[0].imageUrl}
                        alt={comic.title}
                        className="w-full h-full object-contain bg-muted/40"
                        onLoad={handlePreviewLoad(`comic-${comic.id}`)}
                      />
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors">
                        {comic.title}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={(e) => handleRegenerateProject(e, comic.id)}
                        >
                          <Wand2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteComic(e, comic.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{comic.idea}</p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(comic.createdAt)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layout className="w-3.5 h-3.5" />
                        {comic.panels?.length || 0} Panels
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Create New Card Placeholder */}
            <Link href="/editor/new">
              <div className="h-full min-h-[300px] border-2 border-dashed border-border/70 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer gap-4">
                <div className="w-16 h-16 rounded-full bg-background border border-border/70 flex items-center justify-center">
                  <Plus className="w-8 h-8" />
                </div>
                <span className="font-medium">Create New Project</span>
              </div>
            </Link>
          </div>
        )}

        {!isLoading && comics.length === 0 && drafts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">You haven't created any comics yet.</p>
            <Link href="/editor/new">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Create Your First Comic
              </Button>
            </Link>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
