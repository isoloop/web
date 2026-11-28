/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { ThemeToggle } from './ThemeToggle.tsx';

/** The site's sections, for `aria-current`. */
export type Current = 'home' | 'features' | 'how-it-works' | 'examples' | 'benchmarks' | 'docs';

const LINKS: { id: Current; href: string; label: string }[] = [
  { id: 'home', href: '/', label: 'Home' },
  // ADR 0005, amended 2026-11-20: the docs right after Home.
  { id: 'docs', href: '/docs/', label: 'Docs' },
  { id: 'features', href: '/features/', label: 'Features' },
  { id: 'how-it-works', href: '/how-it-works/', label: 'How it works' },
  { id: 'examples', href: '/examples/', label: 'Examples' },
  // ADR 0005, amended 2026-11-24: the figures last, after what Isoloop does.
  { id: 'benchmarks', href: '/benchmarks/', label: 'Benchmarks' },
];

const GITHUB = 'https://github.com/isoloop/isoloop';

/** GitHub's mark, from Octicons (mark-github, MIT). */
const GITHUB_MARK =
  'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

/**
 * The full header (ADR 0003, decision 7, as amended): sticky, the logo, the
 * site's pages, then at the far end the links that aren't pages of the site
 * (GitHub, ADR 0005) beside the theme switch. The logo is the everyday mark (docs/brand.md)
 * beside "isoloop" set in Archivo; ui/vite passes the mark's files, light and
 * dark, and CSS shows the one for the theme. Links are root-absolute:
 * everything is served from the root of isoloop.dev.
 */
export function Header({
  current,
  mark,
  version,
  preview,
}: {
  current?: Current;
  mark?: { light: string; dark: string };
  /** The library version the site is built from, as a pill before GitHub, linking to its changelog; a release (no `-next.N`) has a green outline. */
  version?: { label: string; href: string };
  /** On the stable site, the same page on the preview site (ADR 0007, decision 9): a small "Preview" link before the version. */
  preview?: string;
}): VNode {
  return (
    <header class="ui-header">
      <a class="ui-wordmark" href="/" aria-label="Isoloop, home">
        {mark ? (
          <>
            <img class="ui-mark" data-for="light" src={mark.light} alt="" width={30} height={30} />
            <img class="ui-mark" data-for="dark" src={mark.dark} alt="" width={30} height={30} />
          </>
        ) : null}
        isoloop
      </a>
      <nav class="ui-nav" aria-label="Site">
        {LINKS.map((l) => (
          <a key={l.id} href={l.href} aria-current={l.id === current ? 'page' : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
      <div class="ui-header-end">
        {preview ? (
          <a class="ui-preview-link" href={preview}>
            Preview
          </a>
        ) : null}
        {version ? (
          <a
            class="ui-version"
            href={version.href}
            data-release={version.label.includes('-') ? 'preview' : 'stable'}
            aria-label={`Version ${version.label}, changelog`}
          >
            {version.label}
          </a>
        ) : null}
        <a class="ui-github" href={GITHUB} aria-label="Isoloop on GitHub">
          <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" focusable="false">
            <path fill="currentColor" d={GITHUB_MARK} />
          </svg>
          <span>GitHub</span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
