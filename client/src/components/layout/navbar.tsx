import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutGrid, Library } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <a className="flex items-center gap-2 group">
            <img 
              src="/assets/logo.png" 
              alt="ComicMind Logo" 
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover flex-shrink-0"
            />
            <span className="font-display font-bold text-lg md:text-xl tracking-tight">ComicMind</span>
          </a>
        </Link>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex items-center gap-4 md:gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/dashboard">
              <a className={`hover:text-foreground transition-colors ${location === "/dashboard" ? "text-foreground" : ""}`}>
                Gallery
              </a>
            </Link>
            <Link href="/features">
              <a className={`hover:text-foreground transition-colors ${location === "/features" ? "text-foreground" : ""}`}>
                Features
              </a>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
             <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden xs:flex h-9 px-3 md:px-4">
                Log In
              </Button>
            </Link>
            <Link href="/editor/new">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] h-9 px-3 md:px-4 text-xs md:text-sm">
                <span className="hidden xs:inline">Start Creating</span>
                <span className="xs:hidden">Create</span>
                <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}