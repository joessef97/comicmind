import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LogOut, Moon, Sun, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

const NAV_LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/dashboard", label: "Gallery", authOnly: true },
  { href: "/user-guide", label: "User Guide" },
  { href: "/about", label: "About" },
];

/**
 * Two chromes: public pages sit on paper, signed-in working pages invert to ink
 * so the studio reads as a tool rather than a brochure.
 */
export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const inkChrome = Boolean(user);

  const shell = inkChrome
    ? "h-[74px] bg-[#12100c] text-[#f2ede1] border-b-4 border-[#f2ede1]"
    : "h-[82px] bg-[#f2ede1] text-[#12100c] border-b-4 border-[#12100c]";
  const activeUnderline = inkChrome ? "border-[#f2b32e]" : "border-[#d8402f]";
  const linkIdle = inkChrome
    ? "text-[#a39b8b] hover:text-[#f2ede1]"
    : "text-[#4a4535] hover:text-[#12100c]";
  const logoBorder = inkChrome ? "border-[#f2ede1]" : "border-[#12100c]";

  return (
    <>
      {/* Masthead strip — home page only. */}
      {location === "/" && (
        <div className="h-[34px] bg-[#12100c] text-[#a39b8b]">
          <div className="container mx-auto flex h-full items-center justify-between gap-4 px-4 font-mono text-[11px] uppercase tracking-[0.16em]">
            <span>Issue No. 1</span>
            <span className="hidden sm:inline">Six Panels · Six Styles · One Cast</span>
            <span>Free to Start</span>
          </div>
        </div>
      )}

      <nav className={`sticky top-0 z-50 ${shell}`}>
        <div className="container mx-auto flex h-full items-center justify-between px-4">
          <Link href="/">
            <a className="flex items-center gap-3">
              <img
                src="/assets/logo.png"
                alt="ComicMind Logo"
                className={`h-9 w-9 flex-shrink-0 border-2 object-cover ${logoBorder}`}
              />
              <span className="font-display text-[27px] uppercase leading-none tracking-tight">
                ComicMind
              </span>
            </a>
          </Link>

          <div className="flex items-center gap-5 md:gap-8">
            <div className="hidden items-center gap-5 md:gap-7 sm:flex">
              {NAV_LINKS.filter((link) => !link.authOnly || user).map((link) => {
                const active = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <a
                      className={`border-b-[3px] pb-1 text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                        active ? `${activeUnderline} ${inkChrome ? "text-[#f2ede1]" : "text-[#12100c]"}` : `border-transparent ${linkIdle}`
                      }`}
                    >
                      {link.label}
                    </a>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 border-2 px-2 py-1 ${logoBorder}`}>
                <Sun className="h-3.5 w-3.5" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={() => toggleTheme()}
                  aria-label="Toggle light and dark mode"
                />
                <Moon className="h-3.5 w-3.5" />
              </div>

              {user ? (
                <>
                  <span className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] sm:flex">
                    <span className={`flex h-8 w-8 items-center justify-center border-2 ${logoBorder}`}>
                      <User className="h-4 w-4" />
                    </span>
                    {user.username}
                  </span>
                  <Link href="/editor/new">
                    <Button className="h-10 border-[3px] border-[#f2ede1] bg-[#d8402f] px-4 text-[#f2ede1] shadow-[5px_5px_0_#f2ede1]">
                      <span className="hidden xs:inline">Start Creating</span>
                      <span className="xs:hidden">Create</span>
                      <LayoutGrid className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="h-10 px-3 hover:border-[#f2ede1]"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <a className="hidden text-[13px] font-semibold uppercase tracking-[0.1em] text-[#12100c] hover:underline sm:inline">
                      Log In
                    </a>
                  </Link>
                  <Link href="/register">
                    <Button className="h-10 border-[3px] border-[#12100c] bg-[#12100c] px-4 text-[#f2ede1] shadow-none hover:brightness-125">
                      Sign Up Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
