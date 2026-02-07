import { useState } from "react";
import { cn } from "@/lib/utils";
import { Move, MessageSquare, RefreshCw, Maximize2, X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComicPanelProps {
  index: number;
  image?: string;
  isSelected: boolean;
  onSelect: () => void;
  dialogue?: Array<{ id: string; text: string; x: number; y: number }>;
}

export function ComicPanel({ index, image, isSelected, onSelect, dialogue = [] }: ComicPanelProps) {
  return (
    <div 
      onClick={onSelect}
      className={cn(
        "relative aspect-square bg-card border-2 rounded-lg overflow-hidden transition-all group cursor-pointer",
        isSelected ? "border-primary ring-2 ring-primary/20 z-10 scale-[1.02] shadow-xl" : "border-border hover:border-primary/50"
      )}
    >
      {/* Panel Number Badge */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded z-20">
        #{index + 1}
      </div>

      {/* Image or Placeholder */}
      {image ? (
        <img src={image} alt={`Panel ${index + 1}`} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted/20">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <span className="text-muted-foreground text-xl font-bold">{index + 1}</span>
            </div>
            <p className="text-xs text-muted-foreground">Waiting for story generation...</p>
          </div>
        </div>
      )}

      {/* Speech Bubbles Layer */}
      {dialogue.map((bubble) => (
        <div
          key={bubble.id}
          style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 max-w-[80%] bg-white text-black p-3 rounded-2xl shadow-lg border-2 border-black comic-font text-sm leading-tight z-30 group-hover:scale-105 transition-transform"
        >
          {bubble.text}
          {/* Bubble Tail Visualization (CSS Triangle) */}
          <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-black"></div>
          <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white"></div>
        </div>
      ))}

      {/* Hover Actions */}
      <div className={cn(
        "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2",
        isSelected && "opacity-0" // Hide overlay when selected to see content clearly
      )}>
        <Button variant="secondary" size="sm" className="h-8">
          <Edit3 className="w-4 h-4 mr-2" /> Edit
        </Button>
      </div>
    </div>
  );
}
