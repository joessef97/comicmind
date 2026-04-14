import { Link } from "wouter";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <p>ComicMind © {year}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy">
              <a className="transition-colors hover:text-foreground">Privacy</a>
            </Link>
            <Link href="/terms">
              <a className="transition-colors hover:text-foreground">Terms</a>
            </Link>
            <Link href="/about">
              <a className="transition-colors hover:text-foreground">About</a>
            </Link>
            <Link href="/user-guide">
              <a className="transition-colors hover:text-foreground">User Guide</a>
            </Link>
            <a
              href="mailto:support@comicmind.app"
              className="transition-colors hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
