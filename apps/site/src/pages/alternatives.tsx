/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { Table } from 'ui/components';
import {
  MARK_COLUMNS,
  TEXT_COLUMNS,
  type Alternative,
  type Alternatives,
} from '../../build/alternatives.ts';
import { compared as c, longDate } from '../copy.ts';
import { plain, rich } from './rich.tsx';

type Mark = Alternative['ui'];

/** A mark in words ("Yes", "Partial", "No"), so it never rests on colour alone. */
function MarkWord({ mark }: { mark: Mark['mark'] }): VNode {
  return (
    <span class="alt-mark" data-mark={mark}>
      {c.marks[mark]}
    </span>
  );
}

/**
 * A mark in words that links to the page of the project's docs it was read from
 * (/features/#compared): the claim's source, without a "Source" line in every cell.
 */
function MarkLink({ cell }: { cell: Mark }): VNode {
  return (
    <a class="alt-mark" data-mark={cell.mark} href={cell.source}>
      {c.marks[cell.mark]}
    </a>
  );
}

/** The oldest date any of a row's cells was checked, so the row never claims a later check. */
function checkedOn(row: Alternative): string {
  return [...MARK_COLUMNS, ...TEXT_COLUMNS].map((k) => row[k].checked).toSorted()[0]!;
}

function rowHeading(row: Alternative, full: boolean): VNode {
  if (!full) return <>{rich(row.name)}</>;
  const date = checkedOn(row);
  return (
    <>
      {rich(row.name)}
      <span class="alt-source">
        <a href={row.url}>{c.docs}</a>, {c.checked} <time dateTime={date}>{longDate(date)}</time>
      </span>
    </>
  );
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
 * column. Under each name, its docs and the date checked; each mark links to the
 * page it was read from, and each text cell ends with that page's link. Then
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
                <MarkLink cell={row[k]} />
                <span class="alt-note">{rich(row[k].note)}</span>
              </>
            )),
            ...TEXT_COLUMNS.map((k) => (
              <span class="alt-note" key={k}>
                {rich(row[k].note)}{' '}
                <a class="alt-page" href={row[k].source}>
                  {c.page}
                </a>
              </span>
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
