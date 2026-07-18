import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LogOut, Moon, Sun, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
            <Link href="/browse">
              <a className={`hover:text-foreground transition-colors ${location === "/browse" ? "text-foreground" : ""}`}>
                Browse
              </a>
            </Link>
            {user && (
              <Link href="/dashboard">
                <a className={`hover:text-foreground transition-colors ${location === "/dashboard" ? "text-foreground" : ""}`}>
                  Gallery
                </a>
              </Link>
            )}
            <Link href="/user-guide">
              <a className={`hover:text-foreground transition-colors ${location === "/user-guide" ? "text-foreground" : ""}`}>
                User Guide
              </a>
            </Link>
            <Link href="/pricing">
              <a className={`hover:text-foreground transition-colors ${location === "/pricing" ? "text-foreground" : ""}`}>
                Pricing
              </a>
            </Link>
            <Link href="/about">
              <a className={`hover:text-foreground transition-colors ${location === "/about" ? "text-foreground" : ""}`}>
                About
              </a>
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-border/60 bg-muted/40">
              <Sun className="w-3.5 h-3.5 text-muted-foreground" />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={() => toggleTheme()}
                aria-label="Toggle light and dark mode"
              />
              <Moon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {user ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  {user.username}
                </span>
                <Link href="/editor/new">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] h-9 px-3 md:px-4 text-xs md:text-sm">
                    <span className="hidden xs:inline">Start Creating</span>
                    <span className="xs:hidden">Create</span>
                    <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="h-9 px-3 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="h-9 px-3 md:px-4">
                    Log In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] h-9 px-3 md:px-4 text-xs md:text-sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
