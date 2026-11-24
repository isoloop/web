/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { Table } from 'ui/components';
import {
  MARK_COLUMNS,
  TEXT_COLUMNS,
  type Alternative,
  type Alternatives,
} from '../../build/alternatives.ts';
import { compared as c } from '../copy.ts';
import { plain, rich } from './rich.tsx';

type Mark = Alternative['ui'];
type Text = Alternative['browsers'];

/** A mark in words ("Yes", "Partial", "No"), so it never rests on colour alone. */
function MarkWord({ mark }: { mark: Mark['mark'] }): VNode {
  return (
    <span class="alt-mark" data-mark={mark}>
      {c.marks[mark]}
    </span>
  );
}

/** Where a cell's claim comes from, and when it was checked. */
function Source({ cell }: { cell: Text }): VNode {
  return (
    <span class="alt-source">
      <a href={cell.source}>{c.source}</a>, {c.checked}{' '}
      <time dateTime={cell.checked}>{cell.checked}</time>
    </span>
  );
}

function rowHeading(row: Alternative, link: boolean): VNode {
  return link ? <a href={row.url}>{rich(row.name)}</a> : <>{rich(row.name)}</>;
}

/**
 * The home page's short table (ADR 0002, amended 2026-11-24): Isoloop and the
 * alternatives, with the four marked columns in words.
 */
export function AlternativesSummary({ data }: { data: Alternatives }): VNode {
  return (
    <div class="alt-summary">
      <Table
        caption={c.home.caption}
        head={[c.home.rowHead, ...MARK_COLUMNS.map((k) => data.columns[k])]}
        rows={data.rows.map((row) => [
          plain(row.name),
          ...MARK_COLUMNS.map((k) => <MarkWord mark={row[k].mark} key={k} />),
        ])}
        rowHeadings={data.rows.map((row) => rowHeading(row, false))}
      />
    </div>
  );
}

/**
 * The full table on /features/#compared (ADR 0005, amended 2026-11-24): every
 * column, each cell with its note, its source and the date it was checked; then
 * where each alternative is the better choice.
 */
export function AlternativesFull({ data }: { data: Alternatives }): VNode {
  return (
    <>
      <div class="alt-full">
        <Table
          caption={c.features.caption}
          head={[
            c.home.rowHead,
            ...MARK_COLUMNS.map((k) => data.columns[k]),
            ...TEXT_COLUMNS.map((k) => data.columns[k]),
          ]}
          rows={data.rows.map((row) => [
            plain(row.name),
            ...MARK_COLUMNS.map((k) => (
              <>
                <MarkWord mark={row[k].mark} />
                <span class="alt-note">{rich(row[k].note)}</span>
                <Source cell={row[k]} />
              </>
            )),
            ...TEXT_COLUMNS.map((k) => (
              <>
                <span class="alt-note">{rich(row[k].note)}</span>
                <Source cell={row[k]} />
              </>
            )),
          ])}
          rowHeadings={data.rows.map((row) => rowHeading(row, true))}
        />
      </div>
      <h3>{c.features.betterHeading}</h3>
      <ul class="alt-better">
        {data.rows
          .filter((row) => row.betterFor)
          .map((row) => (
            <li key={row.id}>
              <b>{rich(row.name)}:</b> {rich(row.betterFor ?? '')}
            </li>
          ))}
      </ul>
    </>
  );
}
