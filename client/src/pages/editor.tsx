import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ChevronRight, 
  BookOpen, 
  PenTool, 
  Palette, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type Step = "title" | "story" | "style";

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
  const [step, setStep] = useState<Step>("title");
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("anime");

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-12">
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
        step === "title" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground"
      )}>
        <BookOpen className="w-4 h-4" />
        <span className="text-sm font-bold">Title</span>
      </div>
      <div className="h-px w-8 bg-white/10" />
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
        step === "story" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground"
      )}>
        <PenTool className="w-4 h-4" />
        <span className="text-sm font-bold">Story</span>
      </div>
      <div className="h-px w-8 bg-white/10" />
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
        step === "style" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground"
      )}>
        <Palette className="w-4 h-4" />
        <span className="text-sm font-bold">Style</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1115] text-foreground font-sans selection:bg-primary/30">
      <Navbar />
      
      <main className="container max-w-2xl mx-auto px-4 py-16">
        {renderStepIndicator()}

        <div className="bg-[#161920] border border-white/5 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          {step === "title" && (
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
                    className="h-14 bg-[#1c202a] border-white/5 focus:border-primary/50 text-lg px-4 transition-all"
                  />
                  <div className="absolute right-4 bottom-[-24px] text-[10px] text-muted-foreground font-mono">
                    {title.length}/50
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => setStep("story")}
                disabled={!title}
                className="w-full h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}

          {step === "story" && (
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
                    className="min-h-[160px] bg-[#1c202a] border-white/5 focus:border-primary/50 text-base p-4 resize-none transition-all"
                  />
                  <div className="absolute right-4 bottom-[-24px] text-[10px] text-muted-foreground font-mono">
                    {premise.length}/500
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
                  className="flex-1 h-14 border-white/5 hover:bg-white/5 font-bold"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button 
                  onClick={() => setStep("style")}
                  disabled={!premise}
                  className="flex-[2] h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === "style" && (
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
                          : "bg-[#1c202a] border-white/5 hover:border-white/10"
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

              <div className="bg-[#1c1218] border border-[#ff0080]/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#ff0080] font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Content Guidelines
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our AI ensures all generated content is family-friendly. Violent, explicit, or harmful content will be filtered automatically.
                </p>
              </div>

              <div className="bg-[#1c202a] border border-white/5 rounded-xl p-6 space-y-4">
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
                  className="flex-1 h-14 border-white/5 hover:bg-white/5 font-bold"
                >
                  <ArrowLeft className="mr-2 w-5 h-5" /> Back
                </Button>
                <Button 
                  className="flex-[2] h-14 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 transition-all font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  <Wand2 className="mr-2 w-5 h-5" /> Generate Comic
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
