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

/**
 * A mark as an icon: a tick for yes, a half-filled circle for partial, a cross for
 * no. The shapes differ, so the mark never rests on colour, and the word is read
 * by screen readers and shown as a tooltip.
 */
function MarkIcon({ mark }: { mark: Mark['mark'] }): VNode {
  const label = c.marks[mark];
  return (
    <span class="alt-mark" data-mark={mark} title={label}>
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
        {mark === 'yes' && (
          <path
            d="M3.2 8.4l3.1 3.1 6.5-7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        )}
        {mark === 'partial' && (
          <>
            <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" />
          </>
        )}
        {mark === 'no' && (
          <path
            d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        )}
      </svg>
      <span class="ui-sr-only">{label}</span>
    </span>
  );
}

/** The key under a table: each icon next to its word, so a sighted reader needn't hover. */
function MarkKey(): VNode {
  return (
    <ul class="alt-key" aria-hidden="true">
      {(['yes', 'partial', 'no'] as const).map((m) => (
        <li key={m}>
          <MarkIcon mark={m} /> {c.marks[m]}
        </li>
      ))}
    </ul>
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
          ...MARK_COLUMNS.map((k) => <MarkIcon mark={row[k].mark} key={k} />),
        ])}
        rowHeadings={data.rows.map((row) => rowHeading(row, false))}
      />
      <MarkKey />
    </div>
  );
}

/**
 * The full table on /features/#compared (ADR 0005, amended 2026-11-24): every
 * column, each mark as an icon with its note. Under each name, its docs and the
 * date checked (each cell's own page stays in content/alternatives.json). Then
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
                <MarkIcon mark={row[k].mark} />
                <span class="alt-note">{rich(row[k].note)}</span>
              </>
            )),
            ...TEXT_COLUMNS.map((k) => (
              <span class="alt-note" key={k}>
                {rich(row[k].note)}
              </span>
            )),
          ])}
          rowHeadings={data.rows.map((row) => rowHeading(row, true))}
        />
        <MarkKey />
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
