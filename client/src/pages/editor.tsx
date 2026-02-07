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
  X,
  Languages,
  Eye,
  Settings
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for the editor state
const DEFAULT_PANELS = Array(6).fill(null).map((_, i) => ({
  id: `panel-${i}`,
  prompt: "",
  image: i < 3 ? `/comic-panel-sample_${i+1}.jpg` : undefined, 
  dialogue: i === 0 ? [{ id: "d1", text: "The target is in sight.", x: 50, y: 20 }] : [],
  narration: i === 0 ? "A cold night in Neo-Tokyo." : ""
}));

export default function Editor() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(0);
  const [storyPremise, setStoryPremise] = useState("A cyberpunk detective hunting a rogue android in the neon slums of Neo-Tokyo.");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  const selectedPanel = selectedPanelIndex !== null ? panels[selectedPanelIndex] : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden text-foreground">
      <Navbar />
      
      {/* Editor Toolbar */}
      <div className="h-14 border-b border-white/5 bg-card/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Project</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">ComicMind: Story Studio</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hover:bg-white/5">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button variant="ghost" size="sm" className="hover:bg-white/5">
            <Languages className="w-4 h-4 mr-2" /> Localization
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="w-4 h-4 mr-2" /> Export Comic
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Creation Workflow */}
        <div className="w-80 border-r border-white/5 bg-card/30 flex flex-col shrink-0">
          <Tabs defaultValue="story" className="flex-1 flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full bg-background/50 grid grid-cols-2">
                <TabsTrigger value="story" className="text-xs">Story Beats</TabsTrigger>
                <TabsTrigger value="characters" className="text-xs">Characters</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="story" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User Premise</Label>
                    </div>
                    <Textarea 
                      value={storyPremise}
                      onChange={(e) => setStoryPremise(e.target.value)}
                      placeholder="Enter your story idea..."
                      className="min-h-[100px] text-sm bg-background/50 border-white/10"
                    />
                    <Button 
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                      {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4 mr-2" /> Generate Panels</>}
                    </Button>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Narrative Flow</Label>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="group p-3 rounded-lg border border-white/5 bg-background/40 hover:border-primary/40 transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-primary">BEAT 0{i}</span>
                          <Eye className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">Scene {i} description automatically generated from premise...</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="characters" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Character Control</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg border border-primary/40 bg-primary/5 flex flex-col items-center gap-2">
                         <div className="w-12 h-12 rounded-full bg-indigo-500 border-2 border-primary" />
                         <span className="text-xs font-bold">Detective</span>
                      </div>
                      <div className="p-3 rounded-lg border border-white/5 bg-background/40 flex flex-col items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-pointer">
                         <div className="w-12 h-12 rounded-full bg-emerald-500" />
                         <span className="text-xs font-bold">The Hacker</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* CENTER: Comic Canvas */}
        <div className="flex-1 bg-[#0f1115] relative overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="min-h-full p-12 flex items-center justify-center">
              <div className="w-full max-w-5xl bg-white p-6 shadow-2xl shadow-black/50">
                <div className="grid grid-cols-3 grid-rows-2 gap-4">
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
            </div>
          </ScrollArea>
          
          <div className="h-12 border-t border-white/5 bg-card/30 flex items-center justify-between px-6 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
             <div className="flex items-center gap-6">
               <span className="text-primary font-bold">6-Panel Comic Mode</span>
               <span>Character Consistency: 98%</span>
             </div>
             <div className="flex items-center gap-4">
               <span>Resolution: 4K (Post-processed)</span>
             </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: SVG Post-Processing */}
        <div className="w-80 border-l border-white/5 bg-card/30 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Panel Configuration</h3>
              <p className="text-[10px] text-muted-foreground">SVG Speech Bubbles & Narratives</p>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {selectedPanel ? (
                <>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Visual Prompt</Label>
                    <div className="p-3 rounded-lg bg-background/50 border border-white/5 text-[11px] leading-relaxed text-muted-foreground">
                      Deterministic prompt for Character consistency...
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-[10px] border-white/10 hover:bg-white/5">
                      <RefreshCw className="w-3 h-3 mr-2" /> Sync Consistency
                    </Button>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SVG Bubbles</Label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary">
                        <Plus className="w-3 h-3 mr-1" /> Add Layer
                      </Button>
                    </div>
                    
                    {selectedPanel.dialogue.map((bubble, i) => (
                      <div key={bubble.id} className="p-3 rounded-lg bg-background/50 border border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-primary">DIALOGUE {i+1}</span>
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive cursor-pointer" />
                        </div>
                        <Textarea 
                          defaultValue={bubble.text}
                          className="min-h-[60px] text-xs bg-background/30 border-white/5"
                        />
                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-primary w-1/2" />
                           </div>
                           <span className="text-[10px] text-muted-foreground">X: {bubble.x}% Y: {bubble.y}%</span>
                        </div>
                      </div>
                    ))}

                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Narration Layer</Label>
                       <Input 
                        placeholder="Add narrative text..."
                        className="h-8 text-xs bg-background/50"
                        defaultValue={selectedPanel.narration}
                       />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-30">
                  <LayoutGrid className="w-12 h-12 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">Select Panel</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
