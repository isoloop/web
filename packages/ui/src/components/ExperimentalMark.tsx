/** @jsxImportSource preact */
import type { VNode } from 'preact';

/**
 * The compact experimental mark for navigation lists (ADR 0005, amended
 * 2026-11-20): a round "!" in --ui-experimental. The label is read by screen
 * readers and shown as a tooltip, so the mark never relies on colour alone.
 * The label starts with a space, so a word before the mark and the label read
 * apart in the text ("Devtools Experimental", not "DevtoolsExperimental").
 * The full pill (.ui-pill) stays on headings and the docs index.
 */
export function ExperimentalMark({ label = 'Experimental' }: { label?: string }): VNode {
  return (
    <span class="ui-experimental-mark" title={label}>
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.9" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M8 4.3v4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <circle cx="8" cy="11.4" r="1.05" fill="currentColor" />
      </svg>
      <span class="ui-sr-only">{` ${label}`}</span>
    </span>
  );
}
