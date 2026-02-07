import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComicPanel } from "@/components/editor/comic-panel";
import { 
  Sparkles, 
  LayoutGrid, 
  Save, 
  Share2, 
  ChevronRight, 
  Plus, 
  User, 
  MessageSquare,
  Wand2,
  Download,
  RefreshCw,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Mock data for the editor state
const DEFAULT_PANELS = Array(6).fill(null).map((_, i) => ({
  id: `panel-${i}`,
  prompt: "",
  image: i < 3 ? `/comic-panel-sample_${i+1}.jpg` : undefined, // First 3 have images
  dialogue: i === 0 ? [{ id: "d1", text: "The target is in sight.", x: 50, y: 20 }] : []
}));

export default function Editor() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(0);
  const [storyPremise, setStoryPremise] = useState("A cyberpunk detective hunting a rogue android in the neon slums of Neo-Tokyo.");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate generation delay
    setTimeout(() => {
      setIsGenerating(false);
      // In a real app, this would populate the panels
    }, 2000);
  };

  const selectedPanel = selectedPanelIndex !== null ? panels[selectedPanelIndex] : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Navbar />
      
      {/* Editor Toolbar */}
      <div className="h-14 border-b border-white/5 bg-card/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Drafts</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">The Neon Detective</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Story & Characters */}
        <div className="w-80 border-r border-white/5 bg-card/30 flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Story Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Story Premise</Label>
                  <span className="text-xs text-muted-foreground">0/500</span>
                </div>
                <Textarea 
                  value={storyPremise}
                  onChange={(e) => setStoryPremise(e.target.value)}
                  placeholder="Describe your story here..."
                  className="min-h-[120px] bg-background/50 resize-none focus:ring-primary/50"
                />
                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-primary to-indigo-600 hover:opacity-90 transition-opacity"
                >
                  {isGenerating ? (
                    <>Generating Beats...</>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" /> Generate Story
                    </>
                  )}
                </Button>
              </div>

              <Separator className="bg-white/10" />

              {/* Characters Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Characters</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-white/5 hover:border-primary/50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">A</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">Alex (Detective)</div>
                      <div className="text-xs text-muted-foreground truncate">Cyborg eye, trench coat</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-white/5 hover:border-primary/50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">S</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">Sarah (Hacker)</div>
                      <div className="text-xs text-muted-foreground truncate">Green hair, tactical vest</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* CENTER: Canvas */}
        <div className="flex-1 bg-background/50 relative overflow-hidden flex flex-col">
          <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
            <div className="w-full max-w-4xl aspect-[3/2] grid grid-cols-3 grid-rows-2 gap-4">
              {panels.map((panel, index) => (
                <ComicPanel
                  key={panel.id}
                  index={index}
                  image={panel.image}
                  isSelected={selectedPanelIndex === index}
                  onSelect={() => setSelectedPanelIndex(index)}
                  dialogue={panel.dialogue}
                />
              ))}
            </div>
          </div>
          
          {/* Bottom Context Bar (Zoom, Layout) */}
          <div className="h-10 border-t border-white/5 bg-card/30 flex items-center justify-center gap-4 px-4 text-xs text-muted-foreground">
             <span>Layout: 6-Panel Grid</span>
             <Separator orientation="vertical" className="h-4" />
             <span>Zoom: 100%</span>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Panel Details */}
        <div className="w-80 border-l border-white/5 bg-card/30 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-display font-bold">Panel #{selectedPanelIndex !== null ? selectedPanelIndex + 1 : "-"}</h3>
            <p className="text-xs text-muted-foreground">Configure the selected panel</p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {selectedPanel ? (
                <>
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Image Prompt</Label>
                    <Textarea 
                      placeholder="Describe the scene..."
                      className="min-h-[100px] text-sm bg-background/50"
                      defaultValue="Close up shot of Alex looking intense, neon rain in background, cinematic lighting."
                    />
                    <Button variant="secondary" className="w-full text-xs">
                      <RefreshCw className="w-3 h-3 mr-2" /> Regenerate Image
                    </Button>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dialogue</Label>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Add Bubble
                      </Button>
                    </div>
                    
                    {selectedPanel.dialogue.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPanel.dialogue.map((bubble, i) => (
                          <div key={bubble.id} className="p-3 rounded-lg bg-background/50 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground">Bubble {i + 1}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <Textarea 
                              defaultValue={bubble.text}
                              className="h-16 text-xs resize-none"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                        <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-muted-foreground">No dialogue yet</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <LayoutGrid className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Select a panel to edit</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
