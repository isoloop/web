/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';

/** Where the site serves the expressive mark (docs/brand.md), light and dark (build/plugin.ts). */
export const PAGE_MARK = {
  light: '/brand/expressive.svg',
  dark: '/brand/expressive-dark.svg',
} as const;

/**
 * A page's opening: the title across; below it, the expressive mark in the
 * gutter and the text beside it, centred on the mark (src/site.css). `after`
 * runs full width below both (the features strip). Below 760px the gutter
 * folds away and the mark with it.
 */
export function PageIntro({
  title,
  id = 'title',
  children,
  after,
}: {
  title: string;
  id?: string;
  children?: ComponentChildren;
  after?: ComponentChildren;
}): VNode {
  return (
    <section class="ui-intro" aria-labelledby={id}>
      <h1 id={id}>{title}</h1>
      <div class="ui-intro-mark" aria-hidden="true">
        <img
          class="ui-mark"
          data-for="light"
          src={PAGE_MARK.light}
          alt=""
          width={160}
          height={160}
        />
        <img class="ui-mark" data-for="dark" src={PAGE_MARK.dark} alt="" width={160} height={160} />
      </div>
      <div class="ui-intro-text">{children}</div>
      {after}
    </section>
  );
}
