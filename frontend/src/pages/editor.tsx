import { useState, useEffect, useCallback, useRef } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ComicPanel } from "@/components/editor/comic-panel";
import { ComicBookReader } from "@/components/reader/comic-book-reader";
import { 
  ChevronRight, 
  BookOpen, 
  PenTool, 
  Palette, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Wand2,
  Loader2,
  Save,
  Download,
  RefreshCw,
  FileText,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validateContentSafety } from "@/lib/content-filter";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


type Step = "title" | "story" | "style" | "generating" | "result";

interface Panel {
  number: number;
  description: string;
  dialogue: string;
  narration: string;
  imageUrl?: string;
  error?: string;
  generationMeta?: {
    model: string;
    prompt: string;
    style: string;
    createdAt: string;
    costEstimate: number;
  };
}

interface DraftData {
  id: string;
  title: string;
  style: string;
  idea: string;
  panels: Panel[];
  characterRefUrl?: string;
  status: string;
}

const ART_STYLES = [
  { id: "anime", name: "Anime", icon: "🎌", description: "Japanese animation style with expressive characters" },
  { id: "realistic", name: "Realistic", icon: "📷", description: "Life-like detail and natural lighting" },
  { id: "cartoon", name: "Cartoon", icon: "🎨", description: "Bold lines and vibrant, playful colors" },
  { id: "noir", name: "Noir", icon: "🌑", description: "High-contrast black and white cinematic style" },
  { id: "watercolor", name: "Watercolor", icon: "💧", description: "Soft textures and fluid artistic strokes" },
  { id: "retro", name: "Retro", icon: "🎪", description: "Classic vintage comic book aesthetic" },
];

export default function Editor() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const regenerateRequested = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("regenerate") === "1";

  const isNewComic = !params.id || params.id === "new";
  const editId = isNewComic ? null : params.id;

  const [step, setStep] = useState<Step>("title");
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("anime");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<number>(0);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [loadedComicId, setLoadedComicId] = useState<string | null>(null);
  const [regenerateExistingStory, setRegenerateExistingStory] = useState(regenerateRequested);

  /** Prevent duplicate submissions of the generate flow */
  const isSubmittingRef = useRef(false);
  /** Per-panel loading map: panelNumber → boolean */
  const [panelLoading, setPanelLoading] = useState<Record<number, boolean>>({});
  /** Track how many panels have been generated so far (for progress bar) */
  const [panelProgress, setPanelProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  /** Character sheet from story generation — passed to every image prompt for consistency */
  const [characterSheet, setCharacterSheet] = useState<string>("");
  /** URL of the generated character reference image (used as visual input for each panel) */
  const [charRefUrl, setCharRefUrl] = useState<string>("");
  /** Explicitly regenerate character reference on next Generate click */
  const [forceRegenerateRef, setForceRegenerateRef] = useState(false);
  /** Panel being edited (for text edit dialog) */
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [editDialogue, setEditDialogue] = useState("");
  const [editNarration, setEditNarration] = useState("");
  const [isSavingPanelText, setIsSavingPanelText] = useState(false);

  // Only attach comicId for true edit flows, never for /editor/new.
  const activeComicId = !isNewComic ? (loadedComicId || undefined) : undefined;

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  // ── Load existing draft or comic on mount ───────────────────────────
  useEffect(() => {
    if (!editId) {
      // Prevent leaking prior editor state into new-comic sessions.
      setLoadedComicId(null);
      setDraftId(null);
      draftIdRef.current = null;
      setCharacterSheet("");
      setCharRefUrl("");
      setRegenerateExistingStory(false);
      setForceRegenerateRef(false);
      setPanels([]);
      setSelectedPanel(0);
      setIsPublished(false);
      setStep("title");
      return;
    }

    const loadExisting = async () => {
      setIsLoadingDraft(true);
      setForceRegenerateRef(false);
      setRegenerateExistingStory(regenerateRequested);
      try {
        // Try loading as draft first
        try {
          const draftRes = await apiRequest("GET", `/api/drafts/${editId}`);
          const draftData = await draftRes.json();
          const d = draftData.draft;

          setTitle(d.title);
          setPremise(d.idea);
          setSelectedStyle(d.style);
          setPanels(d.panels || []);
          setCharRefUrl(d.characterRefUrl || "");
          setDraftId(d.id);
          draftIdRef.current = d.id;

          // Determine which step to show based on status/data
          if (regenerateRequested) {
            setStep("style");
          } else if (d.status === "COMPLETED" && d.panels?.length > 0 && d.panels.some((p: Panel) => p.imageUrl)) {
            setStep("result");
          } else if (d.panels?.length > 0) {
            setStep("result");
          } else {
            setStep("title");
          }
          return;
        } catch {
          // Not a draft, try as comic
        }

        const comicRes = await apiRequest("GET", `/api/comics/${editId}`);
        const comicData = await comicRes.json();
        const c = comicData.comic;

        setTitle(c.title);
        setPremise(c.idea);
        setSelectedStyle(c.style);
        setPanels(c.panels || []);
        setCharRefUrl(c.characterRefUrl || "");
        setLoadedComicId(c.id);
        setIsPublished(c.published ?? false);
        setStep(regenerateRequested ? "style" : "result");
      } catch (error: any) {
        toast({
          title: "Failed to load",
          description: error.message || "Could not load the project.",
          variant: "destructive",
        });
        setLocation("/dashboard");
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadExisting();
  }, [editId, regenerateRequested]);

  // ── Save or create a draft ──────────────────────────────────────────
  const saveDraft = useCallback(async (overrides?: Partial<DraftData>): Promise<string | null> => {
    const payload = {
      title: overrides?.title ?? title,
      style: overrides?.style ?? selectedStyle,
      idea: overrides?.idea ?? premise,
      panels: overrides?.panels ?? panels,
      characterRefUrl: overrides?.characterRefUrl ?? charRefUrl,
      status: overrides?.status ?? "DRAFT",
    };

    try {
      setIsSavingDraft(true);

      const currentDraftId = draftIdRef.current;

      if (currentDraftId) {
        // Update existing draft
        const res = await apiRequest("PUT", `/api/drafts/${currentDraftId}`, payload);
        const data = await res.json();
        return data.draft.id;
      } else {
        // Create new draft
        const res = await apiRequest("POST", "/api/drafts", payload);
        const data = await res.json();
        setDraftId(data.draft.id);
        draftIdRef.current = data.draft.id;
        return data.draft.id;
      }
    } catch (error: any) {
      console.error("Draft save error:", error);
      toast({
        title: "Draft save failed",
        description: error.message || "Could not save draft.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  }, [title, premise, selectedStyle, panels, charRefUrl, toast]);

  // ── Manual "Save as Draft" button ───────────────────────────────────
  const handleSaveDraft = async () => {
    const id = await saveDraft();
    if (id) {
      toast({ title: "Draft saved!", description: "Your progress has been saved." });
    }
  };

  // ── Generate comic with auto-draft ──────────────────────────────────
  const handleGenerate = async (options?: { reuseExistingText?: boolean }) => {
    // Guard: prevent duplicate submissions (double-click / race)
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
    const reuseExistingText = options?.reuseExistingText === true;
    const reusablePanels: Panel[] = panels
      .filter((p) => (p.description || "").trim().length > 0)
      .map((p, idx) => ({
        ...p,
        number: p.number ?? idx + 1,
        narration: p.narration ?? "",
        imageUrl: undefined,
        error: undefined,
        generationMeta: undefined,
      }));
    const shouldReuseText = reuseExistingText && reusablePanels.length > 0;

    if (reuseExistingText && !shouldReuseText) {
      toast({
        title: "No reusable story found",
        description: "Generate story text first, then you can regenerate images only.",
        variant: "destructive",
      });
      return;
    }

    // 1. Auto-save draft before generation
    const savedDraftId = await saveDraft({ status: "GENERATING" } as any);
    if (!savedDraftId) {
      toast({
        title: "Could not save draft",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setStep("generating");
    setIsGeneratingStory(true);
    setGenerationProgress(
      shouldReuseText
        ? "Reusing existing story panels..."
        : "Generating story panels...",
    );

    try {
      let storyPanels: Panel[] = [];
      let csText = characterSheet || "";

      if (shouldReuseText) {
        setIsGeneratingStory(false);
        storyPanels = reusablePanels;
        setPanels(storyPanels);
        await saveDraft({ panels: storyPanels, status: "GENERATING" } as any);
      } else {
        // Step 1: Generate story – attach safety metadata
        const storyRes = await apiRequest("POST", "/api/comics/generate-story", {
          title,
          idea: premise,
          style: selectedStyle,
          safetyCheck: { passed: true, checkedAt: new Date().toISOString() },
        });
        const storyData = await storyRes.json();
        storyPanels = storyData.panels;
        setPanels(storyPanels);

        // Store the character sheet for image consistency
        csText = storyData.characterSheet?.description || "";
        setCharacterSheet(csText);

        // Save panels to draft
        await saveDraft({ panels: storyPanels, status: "GENERATING" } as any);
      }

      // Step 1.5: Generate character reference sheet for visual consistency
      let charRefUrlCaptured = charRefUrl || "";
      if (charRefUrlCaptured && !forceRegenerateRef) {
        setGenerationProgress("Reusing existing character reference sheet...");
      } else {
        if (csText) {
          setGenerationProgress("Creating character reference sheet...");
          try {
            const charRefRes = await apiRequest("POST", "/api/comics/generate-character-ref", {
              characterSheet: { description: csText },
              storyIdea: premise,
              style: selectedStyle,
              comicId: activeComicId,
              forceRegenerate: forceRegenerateRef,
            });
            const charRefData = await charRefRes.json();
            if (charRefData.imageUrl) {
              charRefUrlCaptured = charRefData.imageUrl;
              setCharRefUrl(charRefData.imageUrl);
              await saveDraft({ characterRefUrl: charRefData.imageUrl, status: "GENERATING" } as any);
              console.log(
                charRefData.reused
                  ? "[editor] Character reference reused:"
                  : "[editor] Character reference generated:",
                charRefData.imageUrl,
              );
            }
          } catch (charRefErr) {
            // Character reference is optional — don't block panel generation
            console.warn("[editor] Character reference generation failed (continuing):", charRefErr);
          }
        } else {
          // In text-reuse mode, do not force a paid story regeneration just to build character sheet.
          console.warn("[editor] No character sheet available; skipping character reference generation.");
        }
      }
      setForceRegenerateRef(false);

      // Step 2: Generate images — per-panel via /api/images/generate
      setIsGeneratingStory(false);
      setIsGeneratingImages(true);
      setGenerationProgress("Generating panel images... This may take a minute.");
      setPanelProgress({ done: 0, total: storyPanels.length });

      // Validate all panels upfront before generating any images
      try {
        const validateRes = await apiRequest("POST", "/api/comics/validate-panels", {
          panels: storyPanels,
        });
        const validateData = await validateRes.json();
        if (!validateRes.ok) {
          throw new Error(
            validateData.message ||
            "Panel content validation failed. Please revise your story.",
          );
        }
        console.log("[editor] All panels passed validation:", validateData.validPanelCount);
      } catch (validateErr: any) {
        console.error("[editor] Panel validation failed:", validateErr);
        setIsGeneratingImages(false);
        setGenerationProgress("");
        toast({
          title: "Content validation failed",
          description: validateErr.message || "One or more panels contain inappropriate content. Please regenerate the story.",
          variant: "destructive",
        });
        setStep("style");
        return;
      }

      // Switch to "result" step early so users see panels appearing one-by-one
      setStep("result");

      const panelsWithImages = [...storyPanels] as Panel[];

      for (let i = 0; i < panelsWithImages.length; i++) {
        const panel = panelsWithImages[i];
        setPanelLoading((prev) => ({ ...prev, [panel.number]: true }));
        setGenerationProgress(`Generating image ${i + 1} of ${panelsWithImages.length}…`);

        try {
          const imgRes = await apiRequest("POST", "/api/images/generate", {
            comicId: activeComicId,
            panelIndex: i,
            prompt: panel.description,
            style: selectedStyle,
            characterSheet: csText || undefined,
            characterRefUrl: charRefUrlCaptured || undefined,
          });
          const imgData = await imgRes.json();
          panelsWithImages[i] = {
            ...panel,
            imageUrl: imgData.imageUrl,
            generationMeta: imgData.meta,
            error: undefined,
          };
        } catch (err: any) {
          console.error(`Panel ${i + 1} generation failed:`, err);
          panelsWithImages[i] = {
            ...panel,
            error: err.message || `Failed to generate image for panel ${i + 1}`,
          };
        } finally {
          setPanelLoading((prev) => ({ ...prev, [panel.number]: false }));
          setPanelProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        }

        // Update state after each panel so user sees incremental results
        setPanels([...panelsWithImages]);
      }

      // Mark draft as completed
      await saveDraft({ panels: panelsWithImages, characterRefUrl: charRefUrlCaptured, status: "COMPLETED" } as any);

      setIsGeneratingImages(false);
      setGenerationProgress("");
      toast({ title: "Comic generated!", description: "Your comic panels are ready." });
    } catch (error: any) {
      console.error("Generation error:", error);

      // Mark draft as failed but keep data
      await saveDraft({ status: "FAILED" } as any);

      toast({
        title: "Generation failed",
        description: error.message || "Something went wrong. Your draft has been saved — you can retry.",
        variant: "destructive",
      });
      // Return to style step — do NOT clear the form
      setStep("style");
    } finally {
      setIsGeneratingStory(false);
      setIsGeneratingImages(false);
      setGenerationProgress("");
    }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleRetryPanel = async (panel: Panel) => {
    const panelIndex = panel.number - 1;
    setPanelLoading((prev) => ({ ...prev, [panel.number]: true }));

    try {
      const res = await apiRequest("POST", "/api/images/generate", {
        comicId: activeComicId,
        panelIndex,
        prompt: panel.description,
        style: selectedStyle,
        characterSheet: characterSheet || undefined,
        characterRefUrl: charRefUrl || undefined,
      });
      const data = await res.json();
      const updated = panels.map((p) =>
        p.number === panel.number
          ? { ...p, imageUrl: data.imageUrl, generationMeta: data.meta, error: undefined }
          : p
      );
      setPanels(updated);

      // Auto-save updated panels to draft
      if (draftId) {
        await saveDraft({ panels: updated } as any);
      }

      toast({ title: "Panel regenerated!" });
    } catch (error: any) {
      toast({
        title: "Retry failed",
        description: error.message || "Could not regenerate panel.",
        variant: "destructive",
      });
    } finally {
      setPanelLoading((prev) => ({ ...prev, [panel.number]: false }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (loadedComicId) {
        // Update existing comic
        await apiRequest("PUT", `/api/comics/${loadedComicId}`, {
          title,
          style: selectedStyle,
          idea: premise,
          panels,
          characterRefUrl: charRefUrl || undefined,
        });
      } else {
        // Create new comic
        await apiRequest("POST", "/api/comics", {
          title,
          style: selectedStyle,
          idea: premise,
          panels,
          characterRefUrl: charRefUrl || undefined,
        });
      }

      // If this was a draft, delete it now that it's saved as a comic
      const currentDraftId = draftIdRef.current;
      if (currentDraftId) {
        try {
          await apiRequest("DELETE", `/api/drafts/${currentDraftId}`);
        } catch (_) { /* best-effort cleanup */ }
        setDraftId(null);
        draftIdRef.current = null;
      }

      toast({ title: "Comic saved!", description: "Your comic has been saved to your dashboard." });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save comic.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      let comicId = loadedComicId;

      // If comic hasn't been saved yet, save it first
      if (!comicId) {
        const res = await apiRequest("POST", "/api/comics", {
          title,
          style: selectedStyle,
          idea: premise,
          panels,
          characterRefUrl: charRefUrl || undefined,
        });
        const data = await res.json();
        comicId = data.comic.id;
        setLoadedComicId(comicId);

        // Delete the draft now that it's a real comic
        const currentDraftId = draftIdRef.current;
        if (currentDraftId) {
          try {
            await apiRequest("DELETE", `/api/drafts/${currentDraftId}`);
          } catch (_) { /* best-effort cleanup */ }
          setDraftId(null);
          draftIdRef.current = null;
        }
      }

      // Toggle publish status
      const newPublished = !isPublished;
      const publishRes = await apiRequest("PATCH", `/api/comics/${comicId}/publish`, { published: newPublished });
      const publishData = await publishRes.json();
      // Use server-confirmed published state
      const confirmedPublished = publishData.comic?.published ?? newPublished;
      setIsPublished(confirmedPublished);

      toast({
        title: confirmedPublished ? "Comic published!" : "Comic unpublished",
        description: confirmedPublished
          ? "Your comic is now visible on the Browse page."
          : "Your comic is no longer publicly visible.",
      });
    } catch (error: any) {
      toast({
        title: "Publish failed",
        description: error.message || "Could not publish comic.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "title", label: "Title", icon: BookOpen },
      { key: "story", label: "Story", icon: PenTool },
      { key: "style", label: "Style", icon: Palette },
    ];

    return (
      <div className="flex items-center justify-center gap-4 mb-12">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
              step === s.key || (step === "generating" && s.key === "style") || step === "result"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-muted/50 text-muted-foreground"
            )}>
              <s.icon className="w-4 h-4" />
              <span className="text-sm font-bold">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-8 bg-border/80" />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <PageLayout className="bg-background text-foreground font-sans selection:bg-primary/30">

      {isLoadingDraft ? (
        <main className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="bg-card border border-border/70 rounded-2xl p-12 shadow-2xl">
            <div className="flex flex-col items-center gap-6 text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground">Loading project...</p>
            </div>
          </div>
        </main>
      ) : (
      <main className={cn(
        "container mx-auto px-4 py-16",
        step === "result" ? "max-w-[1200px]" : "max-w-2xl"
      )}>
        {step !== "result" && renderStepIndicator()}

        {/* Draft indicator bar */}
        {draftId && step !== "generating" && step !== "result" && (
          <div className="flex items-center justify-between bg-muted/50 border border-border/70 rounded-xl px-4 py-2 mb-6 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>Draft auto-saved</span>
              {isSavingDraft && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="h-7 text-xs text-muted-foreground hover:text-primary"
            >
              <Save className="w-3 h-3 mr-1" /> Save Draft
            </Button>
          </div>
        )}

        {/* Title Step */}
        {step === "title" && (
          <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-display font-bold tracking-tight">Name Your Comic</h1>
                <p className="text-muted-foreground">Give your comic a memorable title</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold text-muted-foreground">Comic Title</Label>
                <div className="relative">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter title..."
                    maxLength={50}
                    className="h-14 bg-muted/50 border-border/80 focus:border-primary/50 text-lg px-4 transition-all"
                  />
                  <div className="absolute right-4 bottom-[-24px] text-[10px] text-muted-foreground font-mono">
                    {title.length}/50
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("story")}
                disabled={!title.trim()}
                className="w-full h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Story Step */}
        {step === "story" && (
          <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-display font-bold tracking-tight">Tell Your Story</h1>
                <p className="text-muted-foreground">Describe the plot of your 6-panel comic</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold text-muted-foreground">Story Premise</Label>
                <div className="relative">
                  <Textarea
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                    placeholder="Once upon a time..."
                    maxLength={1000}
                    className="min-h-[160px] bg-muted/50 border-border/80 focus:border-primary/50 text-base p-4 resize-none transition-all"
                  />
                  <div className="absolute right-4 bottom-[-24px] text-[10px] text-muted-foreground font-mono">
                    {premise.length}/1000
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  Tips for a great story
                </div>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Include a clear beginning, conflict, and resolution</li>
                  <li>Describe key characters and their motivations</li>
                  <li>Keep it concise - 6 panels go quickly!</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("title")}
                  className="flex-1 h-14 border-border/80 hover:bg-muted/70 font-bold"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button
                  onClick={() => setStep("style")}
                  disabled={!premise.trim()}
                  className="flex-[2] h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Style Step */}
        {step === "style" && (
          <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-display font-bold tracking-tight">Choose Your Style</h1>
                <p className="text-muted-foreground">Select the visual style for your comic</p>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold text-muted-foreground">Art Style</Label>
                <div className="grid grid-cols-3 gap-3">
                  {ART_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s.id)}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all group",
                        selectedStyle === s.id
                          ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
                          : "bg-muted/50 border-border/80 hover:border-border"
                      )}
                    >
                      <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{s.icon}</span>
                      <span className={cn(
                        "text-xs font-bold",
                        selectedStyle === s.id ? "text-primary" : "text-muted-foreground"
                      )}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#ff0080] font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Content Guidelines
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our AI ensures all generated content is family-friendly. Violent, explicit, or harmful content will be filtered automatically.
                </p>
              </div>

              <div className="bg-muted/50 border border-border/70 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Your Comic Summary</h3>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground font-medium">Title:</span>
                    <span className="font-bold">{title}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground font-medium">Style:</span>
                    <span className="font-bold">{ART_STYLES.find(s => s.id === selectedStyle)?.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic line-clamp-2 mt-2">"{premise}"</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("story")}
                  className="flex-1 h-14 border-border/80 hover:bg-muted/70 font-bold"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button
                  onClick={() => handleGenerate()}
                  disabled={isGeneratingStory || isGeneratingImages || isSavingDraft}
                  className="flex-[2] h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  <><Wand2 className="mr-2 w-5 h-5" /> Generate Comic</>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Step */}
        {step === "generating" && (
          <div className="bg-card border border-border/70 rounded-2xl p-12 shadow-2xl">
            <div className="flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold">
                  {isGeneratingStory ? "Writing Your Story..." : "Creating Panel Images..."}
                </h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  {generationProgress}
                </p>
              </div>
              {isGeneratingImages && (
                <div className="w-full max-w-xs bg-muted/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-[#d946ef] rounded-full transition-all duration-500"
                    style={{ width: `${panelProgress.total ? (panelProgress.done / panelProgress.total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Step */}
        {step === "result" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-display font-bold">{title}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {ART_STYLES.find(s => s.id === selectedStyle)?.name} style &middot; {panels.length} panels
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("title");
                    setPanels([]);
                    setTitle("");
                    setPremise("");
                    setSelectedStyle("anime");
                    setDraftId(null);
                    setLoadedComicId(null);
                    setCharacterSheet("");
                    setCharRefUrl("");
                    setRegenerateExistingStory(false);
                    setForceRegenerateRef(false);
                    setLocation("/editor/new");
                  }}
                  className="border-border/80 hover:bg-muted/70"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> New Comic
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegenerateExistingStory(true);
                    setStep("style");
                  }}
                  disabled={
                    isGeneratingStory ||
                    isGeneratingImages ||
                    isSavingDraft ||
                    panels.length === 0
                  }
                  className="border-border/80 hover:bg-muted/70"
                >
                  <Wand2 className="w-4 h-4 mr-2" /> Regenerate Comic
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForceRegenerateRef(true);
                    toast({
                      title: "Character reference will regenerate",
                      description: "Click Generate Comic to create a fresh reference sheet.",
                    });
                  }}
                  className="border-border/80 hover:bg-muted/70"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Reference Next Run
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save Comic</>
                  )}
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={isPublished
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-green-600 hover:bg-green-700"
                  }
                >
                  {isPublishing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isPublished ? "Unpublishing..." : "Publishing..."}</>
                  ) : (
                    <><Globe className="w-4 h-4 mr-2" /> {isPublished ? "Unpublish" : "Publish"}</>
                  )}
                </Button>
              </div>
            </div>

            {/* Per-panel progress banner while images are still generating */}
            {isGeneratingImages && (
              <div className="flex items-center gap-3 bg-card border border-border/70 rounded-xl px-4 py-3">
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                <span className="text-sm text-muted-foreground">{generationProgress}</span>
                <div className="flex-1 bg-muted/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-[#d946ef] rounded-full transition-all duration-500"
                    style={{ width: `${panelProgress.total ? (panelProgress.done / panelProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono">{panelProgress.done}/{panelProgress.total}</span>
              </div>
            )}

            {/* ── Comic Book Reader ─────────────────────────────── */}
            <ComicBookReader
              comicId={loadedComicId || draftId || "editor-preview"}
              title={title}
              panels={panels}
              onEditPanel={(panelNumber) => {
                const panel = panels.find((p) => p.number === panelNumber);
                if (panel) {
                  setEditingPanel(panel);
                  setEditDialogue(panel.dialogue || "");
                  setEditNarration(panel.narration || "");
                }
              }}
            />

            {/* Error + Retry buttons for individual panels */}
            {panels.some((p) => p.error) && (
              <div className="flex flex-wrap gap-2 justify-center">
                {panels.map((panel, idx) =>
                  panel.error && !panelLoading[panel.number] ? (
                    <Button
                      key={panel.number}
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetryPanel(panel)}
                      className="text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry Panel {idx + 1}
                    </Button>
                  ) : null,
                )}
              </div>
            )}

            {/* Panel Details */}
            {panels[selectedPanel] && (
              <div className="bg-card border border-border/70 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg">Panel {selectedPanel + 1}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerate Image
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border/80">
                      {panels.map((panel, idx) => (
                        <DropdownMenuItem
                          key={panel.number}
                          disabled={!!panelLoading[panel.number]}
                          onClick={() => handleRetryPanel(panel)}
                          className="text-sm cursor-pointer"
                        >
                          {panelLoading[panel.number] ? (
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-2" />
                          )}
                          Panel {idx + 1}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium">Description</span>
                    <p>{panels[selectedPanel].description}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium">Dialogue</span>
                    <p>{panels[selectedPanel].dialogue || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium">Narration</span>
                    <p>{panels[selectedPanel].narration || "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      )}

      {/* ── Edit Panel Text Dialog ─────────────────────────── */}
      <Dialog
        open={!!editingPanel}
        onOpenChange={(open) => {
          if (!open) setEditingPanel(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle>Edit Panel {editingPanel?.number} Text</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Dialogue (speech bubble)</Label>
              <Textarea
                value={editDialogue}
                onChange={(e) => setEditDialogue(e.target.value)}
                placeholder="Character: What they say..."
                className="min-h-[80px] bg-muted/50 border-border/80 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Narration (caption box)</Label>
              <Textarea
                value={editNarration}
                onChange={(e) => setEditNarration(e.target.value)}
                placeholder="The narrator describes the scene..."
                className="min-h-[80px] bg-muted/50 border-border/80 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPanel(null)}
              className="border-border/80 hover:bg-muted/70"
              disabled={isSavingPanelText}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={isSavingPanelText}
              onClick={async () => {
                if (!editingPanel) return;

                const safetyCheck = validateContentSafety(editDialogue, editNarration);
                if (!safetyCheck.valid) {
                  toast({
                    title: "Panel text blocked",
                    description:
                      safetyCheck.message || "This edit contains restricted content.",
                    variant: "destructive",
                  });
                  return;
                }

                const updatedPanels = panels.map((p) =>
                  p.number === editingPanel.number
                    ? { ...p, dialogue: editDialogue, narration: editNarration }
                    : p,
                );

                setIsSavingPanelText(true);
                try {
                  if (draftIdRef.current) {
                    const savedDraftId = await saveDraft({ panels: updatedPanels } as any);
                    if (!savedDraftId) return;
                  } else if (loadedComicId) {
                    await apiRequest("PUT", `/api/comics/${loadedComicId}`, {
                      title,
                      style: selectedStyle,
                      idea: premise,
                      panels: updatedPanels,
                      characterRefUrl: charRefUrl || undefined,
                    });
                  } else {
                    const savedDraftId = await saveDraft({ panels: updatedPanels } as any);
                    if (!savedDraftId) return;
                  }

                  setPanels(updatedPanels);
                  setEditingPanel(null);
                  toast({ title: `Panel ${editingPanel.number} text updated` });
                } catch (error: any) {
                  toast({
                    title: "Could not save panel text",
                    description: error?.message || "Content safety blocked this edit.",
                    variant: "destructive",
                  });
                } finally {
                  setIsSavingPanelText(false);
                }
              }}
            >
              {isSavingPanelText ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
