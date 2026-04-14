import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ComicPanelProps {
  index: number;
  image?: string;
  isSelected: boolean;
  onSelect: () => void;
  /** Character dialogue — shown as a speech bubble */
  dialogue?: string;
  /** Narration / caption text — shown as a yellow caption box */
  narration?: string;
  /** Whether this panel is currently generating */
  isLoading?: boolean;
}

/**
 * Parse "Speaker: text" dialogue format.
 * Returns { speaker, text } or null if no colon separator.
 */
function parseDialogue(raw: string): { speaker: string; text: string } | null {
  const colonIdx = raw.indexOf(":");
  if (colonIdx > 0 && colonIdx < 30) {
    return {
      speaker: raw.slice(0, colonIdx).trim(),
      text: raw.slice(colonIdx + 1).trim(),
    };
  }
  return null;
}

export function ComicPanel({
  index,
  image,
  isSelected,
  onSelect,
  dialogue,
  narration,
  isLoading,
}: ComicPanelProps) {
  const parsedDialogue = dialogue?.trim() ? parseDialogue(dialogue.trim()) : null;
  const dialogueText = dialogue?.trim() || "";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative bg-white border-[3px] overflow-hidden cursor-pointer flex flex-col",
        "transition-shadow duration-150",
        isSelected
          ? "border-primary shadow-[0_0_0_3px_rgba(139,92,246,0.3)] z-10"
          : "border-black hover:shadow-lg"
      )}
    >
      {/* ── Image Area ─────────────────────────────────────── */}
      <div className="relative aspect-square">
        {image ? (
          <img
            src={image}
            alt={`Panel ${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center p-4">
              <span className="text-gray-400 text-4xl font-bold">{index + 1}</span>
              <p className="text-[10px] text-gray-400 mt-1">
                {isLoading ? "Generating…" : "Waiting for image…"}
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-xs text-white font-medium">Generating…</span>
          </div>
        )}

        {/* ── Narration Caption Box (yellow, top-left) ──────────── */}
        {narration && narration.trim() && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none" style={{ maxWidth: '85%' }}>
            <div className="bg-[#FFEB3B] border-[2.5px] border-black px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-black text-xs sm:text-sm leading-snug font-bold font-serif">
                {narration}
              </p>
            </div>
          </div>
        )}

        {/* ── Speech Bubble (white, bottom) ─────────────────── */}
        {dialogueText && (
          <div className="absolute bottom-3 left-2 z-20 pointer-events-none" style={{ maxWidth: '88%' }}>
            <div className="relative bg-white text-black px-4 py-2.5 rounded-[24px] border-[2.5px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {/* Speaker name */}
              {parsedDialogue ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-0.5">
                    {parsedDialogue.speaker}
                  </p>
                  <p className="text-sm sm:text-base leading-snug font-extrabold">
                    {parsedDialogue.text}
                  </p>
                </>
              ) : (
                <p className="text-sm sm:text-base leading-snug font-extrabold">
                  {dialogueText}
                </p>
              )}
              {/* Bubble tail */}
              <div className="absolute -bottom-[12px] left-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-black" />
              <div className="absolute -bottom-[8px] left-[27px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
