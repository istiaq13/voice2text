'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// The mark: a small "trace" glyph — a filled dot (the source moment) linked by
// a line to a hollow dot (the story it produced). Same idea as the amber
// source-mark used throughout the product, just distilled into a logotype.
function VeraMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <line x1="5" y1="16" x2="17" y2="6" stroke="hsl(var(--highlight))" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="16" r="3.5" fill="hsl(var(--primary))" />
      <circle cx="17" cy="6" r="3.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
    </svg>
  );
}

export function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const inStudio = pathname?.startsWith('/studio');

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <VeraMark />
          <span className="font-display text-lg font-semibold tracking-tight">VERA</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {inStudio ? (
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-md hover:bg-accent transition-colors"
            >
              Overview
            </Link>
          ) : (
            <Link
              href="#how-it-works"
              className="hidden sm:inline-block text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-md hover:bg-accent transition-colors"
            >
              How it works
            </Link>
          )}

          <Link
            href="/studio"
            className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
              inStudio
                ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {inStudio ? 'Studio' : 'Open Studio'}
          </Link>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
