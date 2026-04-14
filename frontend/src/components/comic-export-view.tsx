import { forwardRef, useEffect, useState } from "react";

export interface ExportPanel {
  panelNumber?: number;
  number?: number;
  description?: string;
  dialogue?: string;
  narration?: string;
  imageUrl?: string;
}

interface ComicExportViewProps {
  title: string;
  panels: ExportPanel[];
  onReady?: () => void;
}

/**
 * A dedicated, export-only comic renderer.
 *
 * This component renders a simple, static DOM that html2canvas can reliably
 * capture. It avoids transforms, animations, sticky/fixed positioning,
 * portals, lazy loading, and CSS background-image.
 *
 * It is mounted invisibly in the page, and a ref to the outer container
 * is forwarded so the export function can pass it to html2canvas.
 */
export const ComicExportView = forwardRef<HTMLDivElement, ComicExportViewProps>(
  ({ title, panels, onReady }, ref) => {
    const [imageStatuses, setImageStatuses] = useState<Record<number, boolean>>({});

    // Normalize & sort panels
    const sorted = [...panels]
      .map((p, i) => ({
        num: p.panelNumber ?? p.number ?? i + 1,
        dialogue: p.dialogue ?? "",
        narration: p.narration ?? "",
        imageUrl: p.imageUrl ?? "",
        description: p.description ?? "",
      }))
      .sort((a, b) => a.num - b.num);

    // Track image load status
    const totalImages = sorted.filter((p) => p.imageUrl).length;
    const loadedImages = Object.values(imageStatuses).filter(Boolean).length;

    useEffect(() => {
      if (totalImages > 0 && loadedImages === totalImages) {
        console.log(
          `[ComicExportView] All ${loadedImages} images loaded — export DOM is ready.`
        );
        onReady?.();
      }
    }, [loadedImages, totalImages, onReady]);

    const handleImageLoad = (idx: number) => {
      setImageStatuses((prev) => ({ ...prev, [idx]: true }));
    };

    const handleImageError = (idx: number, src: string) => {
      console.warn(`[ComicExportView] Image ${idx} failed to load: ${src.slice(0, 100)}`);
      // Count as "loaded" so we don't block forever
      setImageStatuses((prev) => ({ ...prev, [idx]: true }));
    };

    /* ────────────── Constants ────────────── */
    const EXPORT_WIDTH = 1800;
    const COLUMNS = 2;
    const GAP = 24;
    const PAD = 40;
    const panelW = Math.floor((EXPORT_WIDTH - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
    const panelH = Math.round(panelW * 1.35);

    return (
      <div
        ref={ref}
        data-comic-export="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: EXPORT_WIDTH,
          background: "#ffffff",
          fontFamily: "'Outfit', 'Inter', sans-serif",
          /* Hidden from visual view but still rendered by the browser for layout */
          opacity: 0,
          pointerEvents: "none",
          zIndex: -9999,
          overflow: "hidden",
        }}
      >
        {/* Title */}
        <div
          style={{
            textAlign: "center",
            padding: `${PAD}px ${PAD}px 0`,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "'Bangers', 'Outfit', cursive",
              fontSize: 48,
              color: "#111",
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        {/* Panels grid — flex wrap with explicit pixel sizes */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: GAP,
            padding: `${GAP}px ${PAD}px ${PAD}px`,
          }}
        >
          {sorted.map((panel, idx) => (
            <div
              key={panel.num}
              style={{
                position: "relative",
                width: panelW,
                height: panelH,
                border: "3px solid #111",
                overflow: "hidden",
                background: "#111",
                borderRadius: 4,
                boxShadow: "3px 3px 0 0 rgba(0,0,0,0.3)",
                flexShrink: 0,
              }}
            >
              {/* Panel image — real <img> tag, no background-image */}
              {panel.imageUrl ? (
                <img
                  src={panel.imageUrl}
                  crossOrigin="anonymous"
                  alt={`Panel ${panel.num}`}
                  onLoad={() => handleImageLoad(idx)}
                  onError={() => handleImageError(idx, panel.imageUrl)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: panelW,
                    height: panelH,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: panelW,
                    height: panelH,
                    background: "linear-gradient(135deg, #6b21a8, #312e81)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 64,
                      fontWeight: "bold",
                    }}
                  >
                    {panel.num}
                  </span>
                </div>
              )}

              {/* Narration box — top-left yellow caption */}
              {panel.narration.trim() && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    maxWidth: "65%",
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      background: "#FFEB3B",
                      border: "2.5px solid #111",
                      padding: "10px 14px",
                      boxShadow: "2px 2px 0 0 rgba(0,0,0,1)",
                    }}
                  >
                    <p
                      style={{
                        color: "#000",
                        fontSize: 15,
                        lineHeight: 1.35,
                        fontWeight: 700,
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        margin: 0,
                      }}
                    >
                      {panel.narration}
                    </p>
                  </div>
                </div>
              )}

              {/* Speech bubble — bottom-left white bubble with tail */}
              {panel.dialogue.trim() && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: 12,
                    maxWidth: "65%",
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      background: "white",
                      color: "black",
                      padding: "12px 16px",
                      borderRadius: 20,
                      border: "2.5px solid #111",
                      boxShadow: "2px 2px 0 0 rgba(0,0,0,1)",
                    }}
                  >
                    <p style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 800, margin: 0 }}>
                      {panel.dialogue}
                    </p>
                    {/* Tail outer (border) */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: -12,
                        left: 20,
                        width: 0,
                        height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderTop: "12px solid #111",
                      }}
                    />
                    {/* Tail inner (fill) */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: -8,
                        left: 23,
                        width: 0,
                        height: 0,
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderTop: "8px solid white",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Watermark */}
        <div
          style={{
            textAlign: "center",
            padding: `0 ${PAD}px ${PAD}px`,
            fontSize: 14,
            color: "#999",
          }}
        >
          Created with ComicMind
        </div>
      </div>
    );
  }
);

ComicExportView.displayName = "ComicExportView";
