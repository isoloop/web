/** @jsxImportSource preact */
import type { VNode } from 'preact';

/** What a preview page says about itself (ADR 0007, decision 9). */
export interface PreviewOf {
  /** The preview's minor, e.g. `0.2`. */
  minor: string;
  /** The preview version from the docs pin, e.g. `0.2.0-next.0`; left out where a build doesn't know it. */
  version?: string;
  /** The same page on the stable site. */
  stable: string;
}

/** "Preview of 0.2 (0.2.0-next.0)", or just "Preview" where the build doesn't know the version. */
export function previewName({ minor, version }: { minor: string; version?: string }): string {
  if (!minor) return 'Preview';
  return version ? `Preview of ${minor} (${version})` : `Preview of ${minor}`;
}

/**
 * The banner on every full-header page of the preview site, above the
 * header: which preview this is, and the way back to the same page on
 * isoloop.dev.
 */
export function PreviewBanner({ minor, version, stable }: PreviewOf): VNode {
  return (
    <p class="ui-preview-banner" role="note">
      {previewName({ minor, ...(version ? { version } : {}) })}. For the current release, see{' '}
      <a href={stable}>isoloop.dev →</a>
    </p>
  );
}
