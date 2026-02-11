import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { ArrowRight, Wand2, Layers, Users, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-8 text-center lg:text-left">
              <h1 className="text-5xl lg:text-7xl font-display font-bold leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                Create Consistent <br />
                <span className="text-primary">Comic Books</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                Turn your scripts into professional 6-panel comics. 
                Maintain character consistency, edit speech bubbles, and export in high resolution.
                No drawing skills required.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <Link href="/editor/new">
                  <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:scale-105">
                    Start Creating <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full border-white/10 hover:bg-white/5 backdrop-blur-sm">
                    View Gallery
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full max-w-[600px] lg:max-w-none animate-in fade-in zoom-in-95 duration-1000 delay-300">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-card">
                  <img 
                    src="/hero-visual.png" 
                    alt="ComicMind Interface" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-card/30 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">Why ComicMind?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We solve the biggest problem in AI image generation: consistency and storytelling.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Users className="w-8 h-8 text-secondary" />}
              title="Character Consistency"
              description="Define your characters once. Our engine ensures they look the same in every single panel, from any angle."
            />
            <FeatureCard 
              icon={<Layers className="w-8 h-8 text-primary" />}
              title="Editable Text Layers"
              description="Speech bubbles are SVG-based, not baked pixels. Edit dialogue, translate, and resize instantly."
            />
            <FeatureCard 
              icon={<Wand2 className="w-8 h-8 text-accent" />}
              title="Intelligent Story Beats"
              description="Input a premise, and we'll break it down into a logical 6-panel narrative structure for you."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-card border border-white/5 hover:border-primary/30 transition-colors group">
      <div className="mb-6 bg-background/50 w-16 h-16 rounded-xl flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}