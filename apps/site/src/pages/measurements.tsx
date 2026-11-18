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

/** A measured block on /examples/: its findings, then its table (or its caption alone), the other engine, the link. */
export function MeasuredBlock({ block, more }: { block: Block; more: string }): VNode {
  return (
    <div class="ex-block">
      <h4>{block.heading}</h4>
      <ul class="ex-findings">
        {block.findings.map((f) => (
          <li key={f}>{rich(f)}</li>
        ))}
      </ul>
      {block.pairs ? <BlockTable block={block} /> : <p class="ex-caption">{block.caption}</p>}
      {block.firefox ? <p>{rich(block.firefox)}</p> : null}
      <p>
        <a href={block.results}>{more}</a>
      </p>
    </div>
  );
}
