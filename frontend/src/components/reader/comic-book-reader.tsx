import {
  memo,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, Pencil } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReadingPosition } from "@/hooks/use-reading-position";
import { getDisplayImageUrl } from "@/lib/utils";
import "./comic-book-reader.css";

/* ─────────────────────────── Types ─────────────────────────────── */

export interface ReaderPanel {
  panelNumber: number;
  description: string;
  dialogue: string;
  narration?: string;
  imageUrl: string;
}

/** Raw panel from the API may use `number` (AI-generated) or `panelNumber` (seed data). */
interface RawPanel {
  number?: number;
  panelNumber?: number;
  description?: string;
  dialogue?: string;
  narration?: string;
  imageUrl?: string;
}

/** Normalize both backend field-name variants into a consistent ReaderPanel. */
function normalizePanel(raw: RawPanel, index: number): ReaderPanel {
  return {
    panelNumber: raw.panelNumber ?? raw.number ?? index + 1,
    description: raw.description ?? "",
    dialogue: raw.dialogue ?? "",
    narration: raw.narration,
    imageUrl: raw.imageUrl ?? "",
  };
}

interface ComicBookReaderProps {
  comicId: string;
  title: string;
  /** Accepts raw panel objects from the API (both `number` and `panelNumber` variants). */
  panels: RawPanel[];
  /** Tailwind gradient className for placeholder panels */
  gradient?: string;
  /** When provided, shows an edit button on each panel. Called with the 1-based panel number. */
  onEditPanel?: (panelNumber: number) => void;
}

/* ─────────────── Panel distribution helpers ─────────────────────── */

/** One panel per page — each panel gets its own full page. */
function distributePages(panels: ReaderPanel[]): ReaderPanel[][] {
  return panels.map((p) => [p]);
}

/** Every page is a single full-bleed panel. */
function layoutClass(_panelCount: number, _pageIdx: number): string {
  return "layout-1";
}

/** Group pages into spreads of 2 (left + right). */
function buildSpreads(pages: ReaderPanel[][]): [ReaderPanel[][], ReaderPanel[][] | null][] {
  const spreads: [ReaderPanel[][], ReaderPanel[][] | null][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    const left: ReaderPanel[][] = [pages[i]];
    const right: ReaderPanel[][] | null = pages[i + 1] ? [pages[i + 1]] : null;
    spreads.push([left, right]);
  }
  return spreads;
}

/* ───────────────────── Sub-components ──────────────────────────── */

/** Single panel inside a page */
const BookPanelCell = memo(function BookPanelCell({
  panel,
  gradient,
  onZoom,
  onEdit,
}: {
  panel: ReaderPanel;
  gradient: string;
  onZoom: (imageUrl: string) => void;
  onEdit?: (panelNumber: number) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const hasImage =
    !imgFailed &&
    !!panel.imageUrl &&
    panel.imageUrl.trim() !== "" &&
    panel.imageUrl !== "/assets/placeholder-panel.png";

  return (
    <div
      className="book-panel"
      onClick={() => hasImage && onZoom(panel.imageUrl)}
      title={hasImage ? "Click to zoom" : undefined}
    >
      {/* Always render the gradient as base layer so it's visible while img loads or on failure */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}
      >
        <span className="text-white/30 text-5xl font-display font-bold select-none">
          {panel.panelNumber}
        </span>
      </div>

      {/* Image on top, hides gradient when loaded */}
      {hasImage && (
        <img
          src={getDisplayImageUrl(panel.imageUrl, "reader")}
          alt={`Panel ${panel.panelNumber}`}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Zoom icon hint */}
      {hasImage && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/panel:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="w-4 h-4 text-white drop-shadow" />
        </div>
      )}

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(panel.panelNumber);
          }}
          className="absolute bottom-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-background/85 hover:bg-primary/90 flex items-center justify-center border border-border/80 transition-all opacity-70 hover:opacity-100 backdrop-blur-sm"
          title="Edit text"
        >
          <Pencil className="w-3.5 h-3.5 text-foreground" />
        </button>
      )}

      {/* Narration box */}
      {panel.narration?.trim() && (
        <div
          className="absolute top-2 left-2 z-10 pointer-events-none"
          style={{ maxWidth: "70%" }}
        >
          <div className="bg-[#FFEB3B] border-[2px] border-black px-2.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-black text-[11px] sm:text-sm leading-snug font-bold font-serif">
              {panel.narration}
            </p>
          </div>
        </div>
      )}

      {/* Speech bubble */}
      {panel.dialogue?.trim() && (
        <div
          className="absolute bottom-3 left-2 z-10 pointer-events-none"
          style={{ maxWidth: "70%" }}
        >
          <div className="relative bg-white text-black px-3 py-2 rounded-[20px] border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[11px] sm:text-sm leading-snug font-extrabold">
              {panel.dialogue}
            </p>
            <div className="absolute -bottom-[10px] left-4 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[10px] border-t-black" />
            <div className="absolute -bottom-[7px] left-[18px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-white" />
          </div>
        </div>
      )}
    </div>
  );
});

/** A single page in the book (paper background, panels grid) */
const BookPage = memo(function BookPage({
  panels,
  pageIndex,
  gradient,
  side,
  pageNumber,
  onZoom,
  onEdit,
}: {
  panels: ReaderPanel[];
  pageIndex: number;
  gradient: string;
  side: "left" | "right";
  pageNumber: number;
  onZoom: (imageUrl: string) => void;
  onEdit?: (panelNumber: number) => void;
}) {
  const layout = layoutClass(panels.length, pageIndex);

  return (
    <div
      className={`page-paper relative w-full h-full ${
        side === "left" ? "page-left" : "page-right"
      }`}
      style={{ minHeight: 0 }}
    >
      <div className={`page-panels ${layout}`}>
        {panels.map((p) => (
          <BookPanelCell
            key={p.panelNumber}
            panel={p}
            gradient={gradient}
            onZoom={onZoom}
            onEdit={onEdit}
          />
        ))}
      </div>

      {/* Page number */}
      <span
        className={`page-number ${
          side === "left" ? "page-number-left" : "page-number-right"
        }`}
      >
        {pageNumber}
      </span>

      {/* Page curl hint on right pages */}
      {side === "right" && <div className="page-curl-hint" />}
    </div>
  );
});

/** Zoom overlay */
function PanelZoomOverlay({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      className="panel-zoom-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.img
        src={imageUrl}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        alt="Zoomed panel"
      />
      <button
        className="absolute top-4 right-4 text-white/90 hover:text-white transition"
        onClick={onClose}
      >
        <X className="w-8 h-8" />
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */

export function ComicBookReader({
  comicId,
  title,
  panels,
  gradient = "from-purple-900 to-indigo-900",
  onEditPanel,
}: ComicBookReaderProps) {
  const isMobile = useIsMobile();
  const { spreadIndex, setSpreadIndex } = useReadingPosition(comicId);

  // Normalize panels from backend (handles `number` vs `panelNumber` field)
  const normalizedPanels = useMemo(
    () => panels.map((p, i) => normalizePanel(p, i)),
    [panels],
  );

  // Distribute panels into pages, then group into spreads
  const pages = useMemo(() => distributePages(normalizedPanels), [normalizedPanels]);
  const spreads = useMemo(() => buildSpreads(pages), [pages]);
  const totalSpreads = spreads.length;

  // Clamp saved index
  useEffect(() => {
    if (spreadIndex >= totalSpreads && totalSpreads > 0) {
      setSpreadIndex(totalSpreads - 1);
    }
  }, [spreadIndex, totalSpreads, setSpreadIndex]);

  const currentSpread = spreadIndex < totalSpreads ? spreadIndex : 0;

  // Preload nearest next spread images for smoother page turns.
  useEffect(() => {
    const next = spreads[currentSpread + 1];
    if (!next) return;
    const preloadUrls = [
      ...next[0][0].map((p) => p.imageUrl),
      ...(next[1]?.[0].map((p) => p.imageUrl) ?? []),
    ]
      .filter(Boolean)
      .map((url) => getDisplayImageUrl(url, "reader"));

    preloadUrls.forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    });
  }, [currentSpread, spreads]);

  // Animation direction: 1 = forward, -1 = backward
  const [flipDir, setFlipDir] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Touch/swipe support
  const touchStartX = useRef<number | null>(null);

  // Guard against onAnimationComplete firing twice (animate + exit)
  const flipHandledRef = useRef(false);

  const canGoNext = currentSpread < totalSpreads - 1;
  const canGoPrev = currentSpread > 0;

  const goNext = useCallback(() => {
    if (!canGoNext || isFlipping) return;
    flipHandledRef.current = false;
    setFlipDir(1);
    setIsFlipping(true);
  }, [canGoNext, isFlipping]);

  const goPrev = useCallback(() => {
    if (!canGoPrev || isFlipping) return;
    flipHandledRef.current = false;
    setFlipDir(-1);
    setIsFlipping(true);
  }, [canGoPrev, isFlipping]);

  // After flip animation completes, update the spread index (once)
  const onFlipComplete = useCallback(() => {
    if (flipHandledRef.current) return; // already handled — ignore exit re-fire
    flipHandledRef.current = true;
    setSpreadIndex((prev: number) => {
      const next = prev + flipDir;
      return Math.max(0, Math.min(next, totalSpreads - 1));
    });
    setIsFlipping(false);
    setFlipDir(0);
  }, [flipDir, totalSpreads, setSpreadIndex]);

  // Keyboard nav — disabled when user is typing in an input/textarea/dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (zoomedImage) return; // zoom overlay handles Escape

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[role='dialog']") ||
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, zoomedImage]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const handleZoom = useCallback((url: string) => {
    setZoomedImage(url);
  }, []);

  if (panels.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No panels to display.
      </div>
    );
  }

  if (totalSpreads === 0) return null;

  // Current spread's left/right pages
  const [leftPages, rightPages] = spreads[currentSpread];
  const leftPanels = leftPages[0];
  const rightPanels = rightPages ? rightPages[0] : null;

  // Page numbers
  const leftPageNum = currentSpread * 2 + 1;
  const rightPageNum = currentSpread * 2 + 2;
  const totalPages = pages.length;

  // For the page-flip animation we need the *next* or *prev* spread data
  const nextSpread =
    currentSpread + 1 < totalSpreads ? spreads[currentSpread + 1] : null;
  const prevSpread = currentSpread - 1 >= 0 ? spreads[currentSpread - 1] : null;

  /* ── Mobile: single page mode ─────────────────────────────────── */
  if (isMobile) {
    // On mobile, show one page at a time
    const mobilePageIdx = currentSpread * 2;
    const mobilePage = pages[mobilePageIdx];
    const mobilePage2 = pages[mobilePageIdx + 1];

    return (
      <div className="relative">
        <div
          className="relative max-w-md mx-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`mobile-${currentSpread}`}
              initial={{ opacity: 0, x: flipDir >= 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: flipDir >= 0 ? -60 : 60 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-3"
            >
              {mobilePage && (
                <div className="rounded-lg overflow-hidden shadow-2xl">
                  <BookPage
                    panels={mobilePage}
                    pageIndex={mobilePageIdx}
                    gradient={gradient}
                    side="left"
                    pageNumber={leftPageNum}
                    onZoom={handleZoom}
                    onEdit={onEditPanel}
                  />
                </div>
              )}
              {mobilePage2 && (
                <div className="rounded-lg overflow-hidden shadow-2xl">
                  <BookPage
                    panels={mobilePage2}
                    pageIndex={mobilePageIdx + 1}
                    gradient={gradient}
                    side="right"
                    pageNumber={rightPageNum}
                    onZoom={handleZoom}
                    onEdit={onEditPanel}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <button
            className="book-nav-btn book-nav-btn-prev"
            onClick={goPrev}
            disabled={!canGoPrev || isFlipping}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="book-nav-btn book-nav-btn-next"
            onClick={goNext}
            disabled={!canGoNext || isFlipping}
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Page indicator */}
        <div className="text-center mt-4 text-sm text-muted-foreground">
          Pages {leftPageNum}–{Math.min(rightPageNum, totalPages)} of{" "}
          {totalPages}
        </div>

        {/* Zoom overlay */}
        <AnimatePresence>
          {zoomedImage && (
            <PanelZoomOverlay
              imageUrl={zoomedImage}
              onClose={() => setZoomedImage(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── Desktop: open book mode ──────────────────────────────────── */
  return (
    <div className="relative w-full" style={{ maxWidth: "100vw", overflowX: "clip" }}>
      {/* Book title header */}
      <div className="text-center mb-4">
        <h2 className="text-black font-display font-black text-lg tracking-tight uppercase">
          {title}
        </h2>
      </div>

      <div
        className="relative mx-auto"
        style={{ maxWidth: "min(1000px, calc(100vw - 32px))" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation buttons */}
        <button
          className="book-nav-btn book-nav-btn-prev"
          onClick={goPrev}
          disabled={!canGoPrev || isFlipping}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          className="book-nav-btn book-nav-btn-next"
          onClick={goNext}
          disabled={!canGoNext || isFlipping}
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Book */}
        <div
          className="comic-book relative w-full"
          style={{ aspectRatio: "2 / 1.35" }}
        >
          {/* Static spread (current left + right) */}
          <div className="absolute inset-0 flex">
            {/* Left page */}
            <div className="w-1/2 h-full">
              <BookPage
                panels={leftPanels}
                pageIndex={currentSpread * 2}
                gradient={gradient}
                side="left"
                pageNumber={leftPageNum}
                onZoom={handleZoom}
                onEdit={onEditPanel}
              />
            </div>

            {/* Right page */}
            <div className="w-1/2 h-full">
              {rightPanels ? (
                <BookPage
                  panels={rightPanels}
                  pageIndex={currentSpread * 2 + 1}
                  gradient={gradient}
                  side="right"
                  pageNumber={rightPageNum}
                  onZoom={handleZoom}
                  onEdit={onEditPanel}
                />
              ) : (
                <div className="page-paper page-right w-full h-full flex items-center justify-center">
                  <span className="text-foreground/25 text-lg font-serif italic">
                    End
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Center spine */}
          <div className="book-spine" />

          {/* ── Page flip animation (forward) ─────────────────── */}
          <AnimatePresence>
            {isFlipping && flipDir === 1 && nextSpread && (
              <motion.div
                className="page-flip-container"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: -180 }}
                exit={{ rotateY: -180 }}
                transition={{
                  duration: 0.7,
                  ease: [0.645, 0.045, 0.355, 1.0],
                }}
                style={{
                  transformOrigin: "left center",
                  transformStyle: "preserve-3d",
                }}
                onAnimationComplete={onFlipComplete}
              >
                {/* Front of turning page = current right page */}
                <div className="page-flip-front">
                  {rightPanels ? (
                    <BookPage
                      panels={rightPanels}
                      pageIndex={currentSpread * 2 + 1}
                      gradient={gradient}
                      side="right"
                      pageNumber={rightPageNum}
                      onZoom={() => {}}
                    />
                  ) : (
                    <div className="page-paper page-right w-full h-full" />
                  )}
                  {/* Shadow on the front during flip */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ background: "rgba(0,0,0,0)" }}
                    animate={{
                      background: [
                        "rgba(0,0,0,0)",
                        "rgba(0,0,0,0.15)",
                        "rgba(0,0,0,0.3)",
                      ],
                    }}
                    transition={{ duration: 0.7 }}
                  />
                </div>

                {/* Back of turning page = next left page */}
                <div className="page-flip-back">
                  <BookPage
                    panels={nextSpread[0][0]}
                    pageIndex={(currentSpread + 1) * 2}
                    gradient={gradient}
                    side="left"
                    pageNumber={leftPageNum + 2}
                    onZoom={() => {}}
                  />
                  {/* Shadow on the back during flip */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ background: "rgba(0,0,0,0.3)" }}
                    animate={{
                      background: [
                        "rgba(0,0,0,0.3)",
                        "rgba(0,0,0,0.1)",
                        "rgba(0,0,0,0)",
                      ],
                    }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Page flip animation (backward) ────────────────── */}
          <AnimatePresence>
            {isFlipping && flipDir === -1 && prevSpread && (
              <motion.div
                className="absolute top-0 left-0 w-1/2 h-full"
                style={{
                  transformOrigin: "right center",
                  transformStyle: "preserve-3d",
                  zIndex: 50,
                }}
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 180 }}
                exit={{ rotateY: 180 }}
                transition={{
                  duration: 0.7,
                  ease: [0.645, 0.045, 0.355, 1.0],
                }}
                onAnimationComplete={onFlipComplete}
              >
                {/* Front = current left page */}
                <div className="page-flip-front">
                  <BookPage
                    panels={leftPanels}
                    pageIndex={currentSpread * 2}
                    gradient={gradient}
                    side="left"
                    pageNumber={leftPageNum}
                    onZoom={() => {}}
                  />
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ background: "rgba(0,0,0,0)" }}
                    animate={{
                      background: [
                        "rgba(0,0,0,0)",
                        "rgba(0,0,0,0.15)",
                        "rgba(0,0,0,0.3)",
                      ],
                    }}
                    transition={{ duration: 0.7 }}
                  />
                </div>

                {/* Back = previous right page */}
                <div className="page-flip-back">
                  {prevSpread[1] ? (
                    <BookPage
                      panels={prevSpread[1][0]}
                      pageIndex={(currentSpread - 1) * 2 + 1}
                      gradient={gradient}
                      side="right"
                      pageNumber={rightPageNum - 2}
                      onZoom={() => {}}
                    />
                  ) : (
                    <div className="page-paper page-right w-full h-full" />
                  )}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ background: "rgba(0,0,0,0.3)" }}
                    animate={{
                      background: [
                        "rgba(0,0,0,0.3)",
                        "rgba(0,0,0,0.1)",
                        "rgba(0,0,0,0)",
                      ],
                    }}
                    transition={{ duration: 0.7 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drop shadow underneath the book to simulate sitting on a table */}
          <div
            className="absolute -bottom-3 left-4 right-4 h-6 rounded-[50%] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Page indicator */}
        <div className="text-center mt-5 text-sm text-muted-foreground select-none">
          Pages {leftPageNum}–{Math.min(rightPageNum, totalPages)} of{" "}
          {totalPages}
        </div>

        {/* Spread dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {Array.from({ length: totalSpreads }).map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSpread
                  ? "bg-primary scale-125"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              onClick={() => {
                if (!isFlipping) {
                  setFlipDir(i > currentSpread ? 1 : -1);
                  setSpreadIndex(i);
                }
              }}
              aria-label={`Go to pages ${i * 2 + 1}–${i * 2 + 2}`}
            />
          ))}
        </div>
      </div>

      {/* Zoom overlay */}
      <AnimatePresence>
        {zoomedImage && (
          <PanelZoomOverlay
            imageUrl={zoomedImage}
            onClose={() => setZoomedImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
