/** @jsxImportSource preact */
import type { VNode } from 'preact';

export const ORIGIN = 'https://isoloop.dev';

interface Indexed {
  /** The whole title, suffix included. */
  title: string;
  description: string;
  /** The page's own path: its canonical and og:url. */
  path: string;
  origin?: string;
  /** A 1200×630 preview image, root-absolute. */
  image?: string;
  robots?: undefined;
}

interface Unindexed {
  title: string;
  description?: string;
  /** e.g. `noindex`. Such a page has no canonical and no preview tags. */
  robots: string;
}

export type PageMetaProps = Indexed | Unindexed;

/**
 * What search engines and link previews read (ADR 0002, decision 9, as
 * amended): either a page to index, with its canonical and preview tags, or
 * one that says it isn't.
 */
export function PageMeta(props: PageMetaProps): VNode {
  if (props.robots !== undefined) {
    return (
      <>
        <title>{props.title}</title>
        {props.description ? <meta name="description" content={props.description} /> : null}
        <meta name="robots" content={props.robots} />
      </>
    );
  }
  const { title, description, path, origin = ORIGIN, image } = props;
  const url = origin + path;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Isoloop" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image ? <meta property="og:image" content={origin + image} /> : null}
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image ? <meta name="twitter:image" content={origin + image} /> : null}
    </>
  );
}
