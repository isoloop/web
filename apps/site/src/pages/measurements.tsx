/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Block, Example } from '../../build/examples.ts';
import { home } from '../copy.ts';
import { DeltaTable } from './delta.tsx';
import { rich } from './rich.tsx';

/** One example's measured block by id, for pages that show it elsewhere (the landing's costs). */
export function findBlock(examples: Example[], exampleId: string, blockId: string): Block {
  const e = examples.find((x) => x.id === exampleId);
  const m = e?.measurements;
  const b = m?.status === 'measured' ? m.blocks.find((x) => x.id === blockId) : undefined;
  if (!b) throw new Error(`apps/${exampleId}/example.json has no measured block "${blockId}"`);
  return b;
}

/** The A/B/Δ table of a block, with its notes: the landing's and the features page's costs. */
export function BlockTable({ block }: { block: Block }): VNode | null {
  if (!block.pairs || !block.groups) return null;
  return (
    <>
      <DeltaTable
        caption={block.caption}
        pairs={block.pairs}
        delta={home.costs.delta}
        groups={block.groups}
        verdicts={home.costs.verdicts}
      />
      {block.notes ? (
        <ul class="ui-notes">
          {block.notes.map((n) => (
            <li key={n}>{rich(n)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * A measured block on /examples/, as a panel like how it works' "Reading the
 * diagram": its name and what it was measured on, the findings under a label
 * with a rule between them, the table (none for a run recorded by hand), and
 * the other engine and the link in its footer.
 */
export function MeasuredBlock({
  block,
  findings,
  more,
  level = 4,
}: {
  block: Block;
  findings: string;
  more: string;
  /** Its heading's level, so the page's outline stays in order (3 under a section's h2). */
  level?: 3 | 4;
}): VNode {
  const H = level === 3 ? 'h3' : 'h4';
  const L = level === 3 ? 'h4' : 'h5';
  return (
    <div class="ex-block">
      <header class="ex-block-head">
        <H>{block.heading}</H>
        <p class="ex-caption">{rich(block.caption)}</p>
      </header>
      <L class="ex-label">{findings}</L>
      <ul class="ex-findings">
        {block.findings.map((f) => (
          <li key={f}>{rich(f)}</li>
        ))}
      </ul>
      {block.pairs ? <BlockTable block={block} /> : null}
      <footer class="ex-block-foot">
        {block.firefox ? <p>{rich(block.firefox)}</p> : null}
        <p>
          <a href={block.results}>{more}</a>
        </p>
      </footer>
    </div>
  );
}
