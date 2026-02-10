import { Navbar } from "@/components/layout/navbar";
import { Sparkles, Layers, Users, Wand2, Shield, Globe } from "lucide-react";

export default function Features() {
  return (
    <div className="min-h-screen bg-[#0f1115] text-foreground font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <h1 className="text-5xl font-display font-bold tracking-tight">Powerful Comic Creation</h1>
          <p className="text-xl text-muted-foreground">Everything you need to turn your ideas into visual masterpieces with AI consistency.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Users className="w-6 h-6 text-primary" />}
            title="Character Consistency"
            description="Our deterministic character control system ensures your protagonists look the same in every panel, maintaining narrative immersion."
          />
          <FeatureCard 
            icon={<Layers className="w-6 h-6 text-secondary" />}
            title="SVG Speech Bubbles"
            description="Dialogue isn't baked into images. Speech bubbles are editable SVG layers, allowing for instant text changes and translations."
          />
          <FeatureCard 
            icon={<Wand2 className="w-6 h-6 text-accent" />}
            title="AI Story Generation"
            description="Input a simple premise, and our AI constructs a coherent 6-panel storyboard with beginning, conflict, and resolution."
          />
          <FeatureCard 
            icon={<Globe className="w-6 h-6 text-emerald-500" />}
            title="Localization Ready"
            description="Since text is separate from artwork, you can translate your comics into multiple languages with a single click."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6 text-rose-500" />}
            title="Content Safety"
            description="Built-in filters ensure all generated content remains family-friendly and follows safety guidelines."
          />
          <FeatureCard 
            icon={<Sparkles className="w-6 h-6 text-amber-500" />}
            title="Style Control"
            description="Choose from a wide variety of art styles, from Japanese Anime to Noir and Watercolor."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-[#161920] border border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1 group">
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
