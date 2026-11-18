/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { DeltaGroup, PairCells, Verdict } from '../copy.ts';

export interface DeltaTableProps {
  caption: string;
  pairs: { a: string; b: string; label: string }[];
  delta: string;
  groups: DeltaGroup[];
  verdicts: Record<Verdict, string>;
}

/** A Δ cell: the value, then its verdict in words, so colour isn't the only cue. */
function DeltaCell({
  cell,
  verdicts,
}: {
  cell: PairCells;
  verdicts: Record<Verdict, string>;
}): VNode {
  const d = cell[2];
  if (!d) return <td class="ui-delta" />;
  return (
    <td class="ui-delta" data-verdict={d[1]}>
      {d[0]} <span class="ui-verdict">{verdicts[d[1]]}</span>
    </td>
  );
}

/** One pair as its own table: the form shown on narrow screens. */
function PairTable({
  pair,
  index,
  delta,
  groups,
  verdicts,
}: Omit<DeltaTableProps, 'pairs' | 'caption'> & {
  pair: DeltaTableProps['pairs'][number];
  index: number;
}): VNode {
  return (
    <div class="ui-table-wrap" tabindex={0} role="region" aria-label={pair.label}>
      <table class="ui-table ui-delta-table">
        <caption>{pair.label}</caption>
        <colgroup />
        <colgroup span={3} />
        <thead>
          <tr>
            <td />
            <th scope="col">{pair.a}</th>
            <th scope="col">{pair.b}</th>
            <th scope="col">{delta}</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.heading}>
            <tr class="ui-delta-group">
              <th scope="rowgroup" colSpan={4}>
                {g.heading}
              </th>
            </tr>
            {g.rows.map((r) => {
              const c = r.cells[index];
              if (!c) return null;
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{c[0]}</td>
                  <td>{c[1]}</td>
                  <DeltaCell cell={c} verdicts={verdicts} />
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/**
 * A/B/Δ for several pairs, grouped by kind of figure. Wide screens get one
 * table with the pairs side by side; narrow screens one table per pair. Both
 * are rendered and a media query shows one, so the hidden one stays out of
 * the accessibility tree too (display: none).
 */
export function DeltaTable(props: DeltaTableProps): VNode {
  const { caption, pairs, delta, groups, verdicts } = props;
  const span = 1 + pairs.length * 3;
  return (
    <div class="ui-delta-tables">
      <div class="ui-table-wrap ui-delta-wide" tabindex={0} role="region" aria-label={caption}>
        <table class="ui-table ui-delta-table">
          <caption>{caption}</caption>
          <colgroup />
          {pairs.map((p) => (
            <colgroup span={3} key={p.label} />
          ))}
          <thead>
            <tr>
              <td />
              {pairs.map((p) => (
                <th scope="colgroup" colSpan={3} key={p.label} class="ui-delta-pair">
                  {p.label}
                </th>
              ))}
            </tr>
            <tr>
              <td />
              {pairs.flatMap((p) => [
                <th scope="col" key={`${p.label}-a`} class="ui-delta-start">
                  {p.a}
                </th>,
                <th scope="col" key={`${p.label}-b`}>
                  {p.b}
                </th>,
                <th scope="col" key={`${p.label}-d`}>
                  {delta}
                </th>,
              ])}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.heading}>
              <tr class="ui-delta-group">
                <th scope="rowgroup" colSpan={span}>
                  {g.heading}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {pairs.flatMap((p, i) => {
                    const c = r.cells[i];
                    if (!c) return [];
                    return [
                      <td key={`${p.label}-a`} class="ui-delta-start">
                        {c[0]}
                      </td>,
                      <td key={`${p.label}-b`}>{c[1]}</td>,
                      <DeltaCell key={`${p.label}-d`} cell={c} verdicts={verdicts} />,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div class="ui-delta-narrow">
        <p class="ui-delta-caption">{caption}</p>
        {pairs.map((p, i) => (
          <PairTable
            key={p.label}
            pair={p}
            index={i}
            delta={delta}
            groups={groups}
            verdicts={verdicts}
          />
        ))}
      </div>
    </div>
  );
}
