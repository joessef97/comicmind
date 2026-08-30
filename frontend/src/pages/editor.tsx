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
  startGenerationJob,
  watchGenerationJob,
  type JobSnapshot,
} from "@/hooks/use-generation-job";
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
  characterSheet?: string;
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
  /** Tears down the SSE subscription when the editor unmounts. */
  const unwatchRef = useRef<(() => void) | null>(null);
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

  // Close any open progress stream on unmount. The job itself keeps running —
  // this only drops our view of it.
  useEffect(() => {
    return () => {
      unwatchRef.current?.();
      unwatchRef.current = null;
    };
  }, []);

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
          setCharacterSheet(d.characterSheet || "");
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
        setCharacterSheet(c.characterSheet || "");
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
      characterSheet: overrides?.characterSheet ?? characterSheet,
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
  }, [title, premise, selectedStyle, panels, characterSheet, charRefUrl, toast]);

  // ── Manual "Save as Draft" button ───────────────────────────────────
  const handleSaveDraft = async () => {
    const id = await saveDraft();
    if (id) {
      toast({ title: "Draft saved!", description: "Your progress has been saved." });
    }
  };

  // ── Generate comic with auto-draft ──────────────────────────────────
  /**
   * Watches a queued job to completion, mapping ledger snapshots onto panel
   * state. Resolves when the job reaches a terminal status.
   *
   * The browser is a spectator here: navigating away does not stop the work,
   * and returning re-attaches through findActiveJob.
   */
  const watchQueuedGeneration = (
    jobId: string,
    initialPanels: Panel[],
    csText: string,
    charRefUrlCaptured: string,
  ): Promise<void> =>
    new Promise((resolve) => {
      const token = localStorage.getItem("token") || "";
      const latest = [...initialPanels];

      const applySnapshot = (snapshot: JobSnapshot) => {
        for (const p of snapshot.panels) {
          const target = latest[p.panelNumber];
          if (!target) continue;

          latest[p.panelNumber] = {
            ...target,
            imageUrl: p.imageUrl ?? target.imageUrl,
            error: p.status === "failed" ? (p.error ?? "Generation failed") : undefined,
          };
          setPanelLoading((prev) => ({ ...prev, [target.number]: p.status === "running" }));
        }

        setPanels([...latest]);
        setPanelProgress({ done: snapshot.completedPanels, total: snapshot.totalPanels });
        setGenerationProgress(
          `Generating images ${snapshot.completedPanels} of ${snapshot.totalPanels}…`,
        );
      };

      const finish = async (snapshot: JobSnapshot) => {
        applySnapshot(snapshot);
        setPanelLoading({});

        const failed = snapshot.panels.filter((p) => p.status === "failed").length;
        await saveDraft({
          panels: latest,
          characterSheet: csText,
          characterRefUrl: charRefUrlCaptured,
          status: failed === snapshot.totalPanels ? "FAILED" : "COMPLETED",
        } as any);

        setIsGeneratingImages(false);
        setGenerationProgress("");

        if (failed === 0) {
          toast({ title: "Comic generated!", description: "Your comic panels are ready." });
        } else {
          // Partial success: the rest of the comic is intact and the failed
          // panels can be retried individually.
          toast({
            title: `${snapshot.totalPanels - failed} of ${snapshot.totalPanels} panels ready`,
            description: `${failed} panel${failed === 1 ? "" : "s"} failed. You can retry them individually.`,
            variant: "destructive",
          });
        }

        resolve();
      };

      unwatchRef.current = watchGenerationJob(jobId, token, {
        onProgress: applySnapshot,
        onDone: (snapshot) => void finish(snapshot),
        onError: (message) => {
          setIsGeneratingImages(false);
          setGenerationProgress("");
          // The job keeps running server-side; only our view of it dropped.
          toast({
            title: "Lost connection",
            description: `${message} Generation is still running — reopen this draft to see the result.`,
            variant: "destructive",
          });
          resolve();
        },
      });
    });

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
      // Local capture: state set below is not readable again in this same run.
      let jobIdCaptured: string | null = null;

      if (shouldReuseText) {
        setIsGeneratingStory(false);
        storyPanels = reusablePanels;
        setPanels(storyPanels);
        await saveDraft({ panels: storyPanels, characterSheet: csText, status: "GENERATING" } as any);
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

        // Present only when the server-side generation ledger is enabled.
        jobIdCaptured = storyData.jobId ?? null;

        // Store the character sheet for image consistency
        csText = storyData.characterSheet?.description || "";
        setCharacterSheet(csText);

        // Save panels to draft
        await saveDraft({ panels: storyPanels, characterSheet: csText, status: "GENERATING" } as any);
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
              await saveDraft({ characterSheet: csText, characterRefUrl: charRefData.imageUrl, status: "GENERATING" } as any);
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

      // Preferred path: hand rendering to the server-side queue. Returns null
      // when the deployment cannot queue, in which case we fall through to the
      // client-driven loop below.
      const queuedJobId = await startGenerationJob(
        {
          panels: storyPanels.map((p) => ({ description: p.description })),
          style: selectedStyle,
          comicId: activeComicId,
          draftId: draftId ?? null,
          characterSheet: csText || undefined,
          characterRefUrl: charRefUrlCaptured || undefined,
        },
        // Stable across retries of this same submit, so a double click or a
        // dropped response attaches to the original job instead of paying twice.
        jobIdCaptured || `${draftId ?? "draft"}-${storyPanels.length}-${title}`,
      );

      if (queuedJobId) {
        await watchQueuedGeneration(queuedJobId, storyPanels, csText, charRefUrlCaptured);
        return;
      }

      const panelsWithImages = [...storyPanels] as Panel[];

      // Generate panels in parallel batches of 2 to cut wait time ~in half.
      // Using 2 (not 3+) to stay within OpenAI rate limits on free-tier.
      const CONCURRENCY = 2;
      for (let batchStart = 0; batchStart < panelsWithImages.length; batchStart += CONCURRENCY) {
        const batchEnd = Math.min(batchStart + CONCURRENCY, panelsWithImages.length);
        const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, k) => batchStart + k);

        // Mark all panels in this batch as loading
        for (const i of batchIndices) {
          setPanelLoading((prev) => ({ ...prev, [panelsWithImages[i].number]: true }));
        }
        setGenerationProgress(
          `Generating images ${batchStart + 1}–${batchEnd} of ${panelsWithImages.length}…`,
        );

        // Fire all requests in this batch concurrently
        const batchResults = await Promise.allSettled(
          batchIndices.map(async (i) => {
            const panel = panelsWithImages[i];
            const imgRes = await apiRequest("POST", "/api/images/generate", {
              comicId: activeComicId,
              jobId: jobIdCaptured || undefined,
              panelIndex: i,
              prompt: panel.description,
              style: selectedStyle,
              characterSheet: csText || undefined,
              characterRefUrl: charRefUrlCaptured || undefined,
            });
            const imgData = await imgRes.json();
            return { i, imgData };
          }),
        );

        // Process results and update UI
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            const { i, imgData } = result.value;
            panelsWithImages[i] = {
              ...panelsWithImages[i],
              imageUrl: imgData.imageUrl,
              generationMeta: imgData.meta,
              error: undefined,
            };
          } else {
            // Find which index failed (match by order)
            const failedIdx = batchIndices[batchResults.indexOf(result)];
            console.error(`Panel ${failedIdx + 1} generation failed:`, result.reason);
            panelsWithImages[failedIdx] = {
              ...panelsWithImages[failedIdx],
              error: result.reason?.message || `Failed to generate image for panel ${failedIdx + 1}`,
            };
          }
        }

        // Clear loading state for this batch and update progress
        for (const i of batchIndices) {
          setPanelLoading((prev) => ({ ...prev, [panelsWithImages[i].number]: false }));
        }
        setPanelProgress((prev) => ({ ...prev, done: prev.done + batchIndices.length }));

        // Update state after each batch so user sees incremental results
        setPanels([...panelsWithImages]);
      }

      // Mark draft as completed
      await saveDraft({ panels: panelsWithImages, characterSheet: csText, characterRefUrl: charRefUrlCaptured, status: "COMPLETED" } as any);

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
          characterSheet: characterSheet || undefined,
          characterRefUrl: charRefUrl || undefined,
        });
      } else {
        // Create new comic
        await apiRequest("POST", "/api/comics", {
          title,
          style: selectedStyle,
          idea: premise,
          panels,
          characterSheet: characterSheet || undefined,
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
          characterSheet: characterSheet || undefined,
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
    const order = ["title", "story", "style"];
    const currentIndex = order.indexOf(step);

    return (
      <div className="mb-12 flex items-stretch border-[3px] border-[#f2ede1]">
        {steps.map((s, i) => {
          const done = step === "result" || (currentIndex > -1 ? i < currentIndex : true);
          const current = step === s.key || (step === "generating" && s.key === "style");

          return (
            <div
              key={s.key}
              className={cn(
                "flex flex-1 items-center gap-3 px-4 py-3 transition-colors",
                i > 0 && "border-l-[3px] border-[#f2ede1]",
                current ? "bg-[#241f16]" : "bg-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border-[3px] border-[#f2ede1] font-display text-[15px]",
                  current
                    ? "bg-[#d8402f] text-[#f2ede1]"
                    : done
                      ? "bg-[#f2b32e] text-[#12100c]"
                      : "bg-transparent text-[#a39b8b]",
                )}
              >
                {i + 1}
              </span>
              <s.icon className={cn("h-4 w-4 shrink-0", current ? "text-[#f2ede1]" : "text-[#a39b8b]")} />
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.12em]",
                  current ? "text-[#f2ede1]" : "text-[#a39b8b]",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <PageLayout className="dark bg-[#12100c] text-[#f2ede1]">

      {isLoadingDraft ? (
        <main className="container mx-auto max-w-2xl px-4 py-16">
          <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-12">
            <div className="flex flex-col items-center gap-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#f2b32e]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">
                Loading project...
              </p>
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
          <div className="mb-6 flex items-center justify-between border-[3px] border-[#4a4535] bg-[#1b1811] px-4 py-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39b8b]">
              <FileText className="h-3.5 w-3.5" />
              <span>Draft auto-saved</span>
              {isSavingDraft && <Loader2 className="h-3 w-3 animate-spin text-[#f2b32e]" />}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="h-7 border-2 border-[#4a4535] text-[#a39b8b] hover:border-[#f2ede1] hover:text-[#f2ede1]"
            >
              <Save className="mr-1 h-3 w-3" /> Save Draft
            </Button>
          </div>
        )}

        {/* Title Step */}
        {step === "title" && (
          <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-8">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="font-display text-[40px] uppercase leading-none text-[#f2ede1]">Name Your Comic</h1>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">Give your comic a memorable title</p>
              </div>

              <div className="space-y-3">
                <Label className="text-[#a39b8b]">Comic Title</Label>
                <div className="relative">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter title..."
                    maxLength={50}
                    className="h-14 border-[3px] border-[#f2ede1] bg-[#12100c] px-4 text-lg text-[#f2ede1] placeholder:text-[#6d675a]"
                  />
                  <div className="absolute right-4 bottom-[-24px] font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                    {title.length}/50
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("story")}
                disabled={!title.trim()}
                className="h-14 w-full border-[3px] border-[#f2ede1] shadow-[7px_7px_0_#f2ede1]"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Story Step */}
        {step === "story" && (
          <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-8">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="font-display text-[40px] uppercase leading-none text-[#f2ede1]">Tell Your Story</h1>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">Describe the plot of your 6-panel comic</p>
              </div>

              <div className="space-y-3">
                <Label className="text-[#a39b8b]">Story Premise</Label>
                <div className="relative">
                  <Textarea
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                    placeholder="Once upon a time..."
                    maxLength={1000}
                    className="min-h-[160px] resize-none border-[3px] border-[#f2ede1] bg-[#12100c] p-4 text-base text-[#f2ede1] placeholder:text-[#6d675a]"
                  />
                  <div className="absolute right-4 bottom-[-24px] font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
                    {premise.length}/1000
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-[3px] border-[#4a4535] bg-[#12100c] p-4">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#f2b32e]">
                  <Sparkles className="h-4 w-4" />
                  Tips for a great story
                </div>
                <ul className="list-inside list-disc space-y-2 text-[13px] leading-relaxed text-[#a39b8b]">
                  <li>Include a clear beginning, conflict, and resolution</li>
                  <li>Describe key characters and their motivations</li>
                  <li>Keep it concise - 6 panels go quickly!</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("title")}
                  className="h-14 flex-1 border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button
                  onClick={() => setStep("style")}
                  disabled={!premise.trim()}
                  className="h-14 flex-[2] border-[3px] border-[#f2ede1] shadow-[7px_7px_0_#f2ede1]"
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Style Step */}
        {step === "style" && (
          <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-8">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="font-display text-[40px] uppercase leading-none text-[#f2ede1]">Choose Your Style</h1>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">Select the visual style for your comic</p>
              </div>

              <div className="space-y-4">
                <Label className="text-[#a39b8b]">Art Style</Label>
                <div className="grid grid-cols-3 gap-3">
                  {ART_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s.id)}
                      className={cn(
                        "group flex flex-col items-center gap-3 border-[3px] p-4 transition-colors",
                        selectedStyle === s.id
                          ? "border-[#f2b32e] bg-[#241f16]"
                          : "border-[#4a4535] bg-[#12100c] hover:border-[#f2ede1]"
                      )}
                    >
                      <span className="text-2xl grayscale transition-all group-hover:grayscale-0">{s.icon}</span>
                      <span className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.12em]",
                        selectedStyle === s.id ? "text-[#f2b32e]" : "text-[#a39b8b]"
                      )}>{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-[3px] border-[#d8402f] bg-[#12100c] p-4">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#d8402f]">
                  <AlertTriangle className="h-4 w-4" />
                  Content Guidelines
                </div>
                <p className="text-[13px] leading-relaxed text-[#a39b8b]">
                  Our AI ensures all generated content is family-friendly. Violent, explicit, or harmful content will be filtered automatically.
                </p>
              </div>

              <div className="space-y-4 border-[3px] border-[#4a4535] bg-[#12100c] p-6">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a39b8b]">Your Comic Summary</h3>
                <div className="space-y-2">
                  <div className="flex gap-2 font-mono text-[11px] uppercase tracking-[0.1em]">
                    <span className="text-[#6d675a]">Title:</span>
                    <span className="text-[#f2ede1]">{title}</span>
                  </div>
                  <div className="flex gap-2 font-mono text-[11px] uppercase tracking-[0.1em]">
                    <span className="text-[#6d675a]">Style:</span>
                    <span className="text-[#f2ede1]">{ART_STYLES.find(s => s.id === selectedStyle)?.name}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[13px] italic leading-relaxed text-[#a39b8b]">"{premise}"</p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep("story")}
                  className="h-14 flex-1 border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button
                  onClick={() => handleGenerate()}
                  disabled={isGeneratingStory || isGeneratingImages || isSavingDraft}
                  className="h-14 flex-[2] border-[3px] border-[#f2ede1] shadow-[7px_7px_0_#f2ede1]"
                >
                  <><Wand2 className="mr-2 w-5 h-5" /> Generate Comic</>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Step */}
        {step === "generating" && (
          <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-12">
            <div className="flex flex-col items-center gap-6 text-center animate-in fade-in duration-500">
              <div className="flex h-20 w-20 items-center justify-center border-[3px] border-[#f2ede1] bg-[#12100c]">
                <Loader2 className="h-10 w-10 animate-spin text-[#f2b32e]" />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-[30px] uppercase leading-none text-[#f2ede1]">
                  {isGeneratingStory ? "Writing Your Story..." : "Creating Panel Images..."}
                </h2>
                <p className="max-w-md font-mono text-[11px] uppercase tracking-[0.1em] text-[#a39b8b]">
                  {generationProgress}
                </p>
              </div>
              {isGeneratingImages && (
                <div className="h-3 w-full max-w-xs overflow-hidden border-2 border-[#f2ede1] bg-[#12100c]">
                  <div
                    className="h-full bg-[#f2b32e] transition-all duration-500"
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
            <div className="flex flex-wrap items-end justify-between gap-6 border-b-[3px] border-[#f2ede1] pb-6">
              <div>
                <h1 className="font-display text-[36px] uppercase leading-none text-[#f2ede1]">{title}</h1>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#a39b8b]">
                  {ART_STYLES.find(s => s.id === selectedStyle)?.name} style &middot; {panels.length} panels
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
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
                  className="border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
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
                  className="border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
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
                  className="border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Reference Next Run
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="border-[3px] border-[#f2ede1] shadow-[5px_5px_0_#f2ede1]"
                >
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save Comic</>
                  )}
                </Button>
                {/* Publish is the confirm action, so it takes the yellow fill. */}
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={isPublished
                    ? "border-[3px] border-[#f2ede1] bg-[#4a4535] text-[#f2ede1]"
                    : "border-[3px] border-[#f2ede1] bg-[#f2b32e] text-[#12100c] shadow-[5px_5px_0_#f2ede1]"
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
              <div className="flex items-center gap-3 border-[3px] border-[#f2ede1] bg-[#1b1811] px-4 py-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#f2b32e]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#a39b8b]">
                  {generationProgress}
                </span>
                <div className="h-2 flex-1 overflow-hidden border-2 border-[#4a4535] bg-[#12100c]">
                  <div
                    className="h-full bg-[#f2b32e] transition-all duration-500"
                    style={{ width: `${panelProgress.total ? (panelProgress.done / panelProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[#a39b8b]">{panelProgress.done}/{panelProgress.total}</span>
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
                      className="border-[3px] border-[#d8402f] text-[#d8402f] hover:bg-[#d8402f] hover:text-[#f2ede1]"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Retry Panel {idx + 1}
                    </Button>
                  ) : null,
                )}
              </div>
            )}

            {/* Panel Details */}
            {panels[selectedPanel] && (
              <div className="border-[3px] border-[#f2ede1] bg-[#1b1811] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[22px] uppercase leading-none text-[#f2ede1]">
                    Panel {selectedPanel + 1}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="border-[3px] border-[#f2ede1] bg-[#d8402f] text-[#f2ede1]"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Regenerate Image
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-[3px] border-[#12100c] bg-[#f8f5ec]">
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
                <div className="grid gap-6 border-t-[3px] border-[#4a4535] pt-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#6d675a]">
                      Description
                    </span>
                    <p className="text-[14px] leading-relaxed text-[#f2ede1]">
                      {panels[selectedPanel].description}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#6d675a]">
                      Dialogue
                    </span>
                    <p className="text-[14px] leading-relaxed text-[#f2ede1]">
                      {panels[selectedPanel].dialogue || "—"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#6d675a]">
                      Narration
                    </span>
                    <p className="text-[14px] leading-relaxed text-[#f2ede1]">
                      {panels[selectedPanel].narration || "—"}
                    </p>
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
        <DialogContent className="sm:max-w-md border-[3px] border-[#12100c] bg-[#f8f5ec]">
          <DialogHeader>
            <DialogTitle>Edit Panel {editingPanel?.number} Text</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label >Dialogue (speech bubble)</Label>
              <Textarea
                value={editDialogue}
                onChange={(e) => setEditDialogue(e.target.value)}
                placeholder="Character: What they say..."
                className="min-h-[80px] resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label >Narration (caption box)</Label>
              <Textarea
                value={editNarration}
                onChange={(e) => setEditNarration(e.target.value)}
                placeholder="The narrator describes the scene..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPanel(null)}
              className="border-[3px] border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
              disabled={isSavingPanelText}
            >
              Cancel
            </Button>
            <Button
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
                      characterSheet: characterSheet || undefined,
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
