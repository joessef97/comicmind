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
              src="/attached_assets/ComicMind_logo_with_futuristic_robot_1770804922159.png" 
              alt="ComicMind Logo" 
              className="w-10 h-10 rounded-lg object-cover"
            />
            <span className="font-display font-bold text-xl tracking-tight">ComicMind</span>
          </a>
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/dashboard">
              <a className={`hover:text-foreground transition-colors ${location === "/dashboard" ? "text-foreground" : ""}`}>
                Gallery
              </a>
            </Link>
            <Link href="/features">
              <a className="hover:text-foreground transition-colors">Features</a>
            </Link>
          </div>

          <div className="flex items-center gap-3">
             <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                Log In
              </Button>
            </Link>
            <Link href="/editor/new">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                Start Creating <LayoutGrid className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}