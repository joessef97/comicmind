import { Link } from "wouter";

const LINK_CLASS = "transition-colors hover:text-[#f2ede1]";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="dark border-t-4 border-[#12100c] bg-[#12100c] text-[#a39b8b]">
      <div className="container mx-auto px-4 py-7">
        <div className="flex flex-col items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.08em] md:flex-row">
          <p>ComicMind © {year}. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link href="/privacy">
              <a className={LINK_CLASS}>Privacy</a>
            </Link>
            <Link href="/terms">
              <a className={LINK_CLASS}>Terms</a>
            </Link>
            <Link href="/about">
              <a className={LINK_CLASS}>About</a>
            </Link>
            <Link href="/user-guide">
              <a className={LINK_CLASS}>User Guide</a>
            </Link>
            <a href="mailto:support@comicmind.app" className={LINK_CLASS}>
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
