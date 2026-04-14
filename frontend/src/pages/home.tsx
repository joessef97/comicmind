import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import { HeroCardStack } from "@/components/hero/hero-card-stack";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { user } = useAuth();
  const createLink = user ? "/editor/new" : "/register";
  const galleryLink = user ? "/dashboard" : "/login";

  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="relative pt-20 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-8 text-center lg:text-left">
              <h1 className="text-5xl lg:text-7xl font-display font-bold leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/60 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                Create Consistent <br />
                <span className="text-primary">Comic Books</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                Turn your scripts into professional 6-panel comics. 
                Maintain character consistency, edit speech bubbles, and export in high resolution.
                No drawing skills required.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <Link href={createLink}>
                  <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:scale-105">
                    Start Creating <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href={galleryLink}>
                  <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full border-border/80 hover:bg-muted/80 backdrop-blur-sm">
                    View Gallery
                  </Button>
                </Link>
                <Link href="/browse">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full border-border/80 hover:bg-muted/80 backdrop-blur-sm">
                    Browse Comics
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full max-w-[600px] lg:max-w-none animate-in fade-in zoom-in-95 duration-1000 delay-300 overflow-visible">
              <HeroCardStack />
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}