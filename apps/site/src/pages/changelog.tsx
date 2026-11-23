/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Block, PackageLog, Release } from '../../build/changelog.ts';
import { changelogPage as c } from '../copy.ts';
import { inline } from './inline.tsx';
import type { Page, SiteData } from './types.ts';

function Blocks({ blocks }: { blocks: Block[] }): VNode {
  return (
    <>
      {blocks.map((b) =>
        b.kind === 'p' ? (
          <p key={b.text}>{inline(b.text)}</p>
        ) : (
          <ul key={b.items.join('\n')}>
            {b.items.map((item) => (
              <li key={item}>{inline(item)}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

/** "CLI" after a package that ships a command. */
function CliPill({ pkg }: { pkg: PackageLog }): VNode | null {
  return pkg.cli ? <span class="ui-pill ui-pill-neutral">{c.cli}</span> : null;
}

/** One version of one package: its intro, then its changes by kind. */
function ReleaseNotes({ pkg, release }: { pkg: PackageLog; release: Release }): VNode {
  const id = `${pkg.id}-${release.version}`;
  return (
    <section class="release" aria-labelledby={id}>
      <h3 id={id}>{release.version}</h3>
      {release.intro.length > 0 ? <Blocks blocks={release.intro} /> : null}
      {release.groups.map((g) => (
        <div key={g.kind}>
          {g.kind ? <p class="change-kind">{c.kind(g.kind)}</p> : null}
          <ul class="changes">
            {g.entries.map((blocks) => (
              <li key={JSON.stringify(blocks)}>
                <Blocks blocks={blocks} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** A package: its releases open, its previews (`-next.N`) folded below them. */
function PackageSection({ pkg }: { pkg: PackageLog }): VNode {
  const releases = pkg.releases.filter((r) => !r.version.includes('-'));
  const previews = pkg.releases.filter((r) => r.version.includes('-'));
  return (
    <section class="changelog-package" id={pkg.id} aria-labelledby={`${pkg.id}-h`}>
      <h2 id={`${pkg.id}-h`}>
        {pkg.name}
        {pkg.cli ? ' ' : null}
        <CliPill pkg={pkg} />
      </h2>
      {pkg.releases.length === 0 ? <p>{c.unreleased}</p> : null}
      {releases.map((r) => (
        <ReleaseNotes key={r.version} pkg={pkg} release={r} />
      ))}
      {previews.length > 0 ? (
        <details class="docs-fold changelog-previews">
          <summary>
            {c.previews}{' '}
            <span>
              {previews.at(-1)?.version} to {previews[0]?.version}
            </span>
          </summary>
          {previews.map((r) => (
            <ReleaseNotes key={r.version} pkg={pkg} release={r} />
          ))}
        </details>
      ) : null}
    </section>
  );
}

function SideNav({ packages }: { packages: PackageLog[] }): VNode {
  return (
    <nav class="docs-side" aria-label={c.nav}>
      <div>
        <h2>{c.packages}</h2>
        <ul>
          {packages.map((p) => (
            <li key={p.id}>
              <a href={`#${p.id}`}>
                {p.name}
                {p.cli ? ' ' : null}
                <CliPill pkg={p} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Changelog({ changelog }: SiteData): VNode {
  return (
    <div class="docs-layout docs-layout-index">
      <div class="docs-only-wide">
        <SideNav packages={changelog.packages} />
      </div>
      <main class="docs-article">
        <h1>{c.heading}</h1>
        <p class="docs-lead">{c.lede}</p>
        <details class="docs-fold docs-only-narrow">
          <summary>{c.packages}</summary>
          <SideNav packages={changelog.packages} />
        </details>
        {changelog.packages.map((p) => (
          <PackageSection key={p.id} pkg={p} />
        ))}
      </main>
    </div>
  );
}

export const changelogPage: Page = {
  path: '/changelog/',
  head: { title: c.title, description: c.description },
  render: (data) => <Changelog {...data} />,
};
