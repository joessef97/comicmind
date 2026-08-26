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
        "relative flex cursor-pointer flex-col overflow-hidden border-[3px] bg-[#f8f5ec]",
        "transition-shadow duration-150",
        isSelected
          ? "z-10 border-[#f2b32e] shadow-[4px_4px_0_#12100c]"
          : "border-[#12100c] hover:shadow-[4px_4px_0_#12100c]"
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
          <div className="art-placeholder flex h-full w-full items-center justify-center">
            <div className="text-center p-4">
              <span className="numeral-outline text-4xl text-[#f2ede1]">{index + 1}</span>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4a4535]">
                {isLoading ? "Generating…" : "Waiting for image…"}
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#12100c]/80">
            <Loader2 className="h-8 w-8 animate-spin text-[#f2b32e]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]">Generating…</span>
          </div>
        )}

        {/* ── Narration Caption Box (yellow, top-left) ──────────── */}
        {narration && narration.trim() && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none" style={{ maxWidth: '85%' }}>
            <div className="border-[3px] border-[#12100c] bg-[#f2b32e] px-3 py-2 shadow-[3px_3px_0_#12100c]">
              <p className="text-xs font-bold leading-snug text-[#12100c] sm:text-sm">
                {narration}
              </p>
            </div>
          </div>
        )}

        {/* ── Speech Bubble (white, bottom) ─────────────────── */}
        {dialogueText && (
          <div className="absolute bottom-3 left-2 z-20 pointer-events-none" style={{ maxWidth: '88%' }}>
            <div className="relative border-[3px] border-[#12100c] bg-[#f8f5ec] px-4 py-2.5 text-[#12100c] shadow-[3px_3px_0_#12100c]">
              {/* Speaker name */}
              {parsedDialogue ? (
                <>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6d675a]">
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
              <div className="absolute -bottom-[12px] left-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-[#12100c]" />
              <div className="absolute -bottom-[8px] left-[27px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-[#f8f5ec]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
