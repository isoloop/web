// The interactive board (M3e decisions 4, 8 and 20), for a page to mount: a
// toolbar (Add, Reset to starter, the count), the grid of widgets in add
// order, each with Edit and Delete, and the drawer docked on the right with
// its preview and form slots. The page brings its runtime (isoloopRuntime or
// nativeRuntime), its catalog and its starter widgets. With a balancer
// (M3h decision 20), an `auto` widget's header says where it runs, a moved
// widget shows a badge and "Moving…" until it draws again, and the toolbar
// opens the placement log.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type RefObject,
} from 'react';
import type { Catalog } from '../catalog';
import type { WidgetSpec } from '../spec/types';
import css from '../styles.css?inline';
import { SIZE } from '../views/size';
import { moveText, type AutoMove } from './auto';
import { BoardController, WIDGET_CAP, type BoardWidget } from './controller';
import type { BoardRuntime } from './runtime';
import type { AutoPlacement } from './ui';

/** The longest a moved widget shows "Moving…" if it never draws again. */
export const MOVING_MAX_MS = 10_000;

/**
 * Whether the widget in `body` drew after `since`: a canvas view stamps
 * `data-drawn-at` on each draw; a table or a stat has no stamp, so any
 * rendered view counts once the old one is gone.
 */
function drewSince(body: Element, since: number): boolean {
  const stamped = body.querySelectorAll('[data-drawn-at]');
  if (stamped.length > 0) {
    return [...stamped].some((el) => Number(el.getAttribute('data-drawn-at')) > since);
  }
  return body.querySelector('[data-view]') !== null;
}

/** "Moving…" from a move until the widget draws in its new place (decision 17). */
function useMoving(body: RefObject<HTMLDivElement | null>, move: AutoMove | undefined): boolean {
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (!move) return undefined;
    setMoving(true);
    let gone = false;
    const timer = setInterval(() => {
      const el = body.current;
      const old = Date.now() - move.at;
      // The old isolate's view goes with it; wait a moment before looking.
      if (old >= MOVING_MAX_MS || (old > 300 && el && drewSince(el, move.at))) {
        clearInterval(timer);
        if (!gone) setMoving(false);
      }
    }, 100);
    return () => {
      gone = true;
      clearInterval(timer);
    };
  }, [body, move]);
  return moving;
}

/** What an `auto` widget's header says: "Auto 2", "Quarantine · kept apart: repeated blocking". */
function autoWhere(p: AutoPlacement | undefined): string {
  if (!p) return 'Automatic';
  if (p.state === 'kept-apart') return `${p.label} · kept apart: repeated blocking`;
  if (p.state === 'failed') return `${p.label} · stopped: crashed too often`;
  if (p.atCap) return `${p.label} · over budget, at worker cap`;
  return p.label;
}

/** Adds the creator's stylesheet to the document once (every rule is under `.creator-*`). */
function useCreatorStyles(): void {
  useEffect(() => {
    if (document.querySelector('style[data-creator-styles]')) return;
    const el = document.createElement('style');
    el.dataset['creatorStyles'] = '';
    el.textContent = css;
    document.head.append(el);
  }, []);
}

function Slot({
  ctl,
  widget,
  where,
  placement,
  move,
}: {
  ctl: BoardController;
  widget: BoardWidget;
  where: string;
  placement: AutoPlacement | undefined;
  move: AutoMove | undefined;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const { id, spec } = widget;
  const moving = useMoving(ref, move);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    ctl.attach(id, el);
    return () => ctl.detach(id);
  }, [ctl, id]);
  return (
    <section
      className="creator-slot"
      data-widget={id}
      data-cols={SIZE[spec.view.size].columns}
      data-pool={spec.placement.mode === 'manual' ? spec.placement.pool : undefined}
      data-placement={spec.placement.mode}
      data-auto-pool={placement?.pool}
      data-auto-state={placement?.state}
      data-moving={moving || undefined}
    >
      <header className="creator-slot-head">
        <span className="creator-slot-title">{spec.title}</span>
        <span className="creator-slot-where" data-where={where}>
          {where}
        </span>
        {move ? (
          <span className="creator-slot-badge" data-reason={move.reason} role="status">
            {moveText(move)}
          </span>
        ) : null}
        <span className="creator-slot-tools">
          <button type="button" data-action="edit" onClick={() => ctl.openEdit(id)}>
            Edit
          </button>
          <button type="button" data-action="delete" onClick={() => void ctl.remove(id)}>
            Delete
          </button>
        </span>
      </header>
      <div className="creator-slot-body" ref={ref} />
      {moving ? (
        <div className="creator-slot-moving" aria-live="polite">
          Moving…
        </div>
      ) : null}
    </section>
  );
}

/** Every move the balancer made, newest first (M3h decision 20). */
function PlacementLog({ log }: { log: readonly AutoMove[] }): ReactElement {
  return (
    <details className="creator-placement-log" data-moves={log.length}>
      <summary>Placement log ({log.length})</summary>
      {log.length === 0 ? (
        <p>No moves yet. Automatic widgets are moved when their pool falls behind.</p>
      ) : (
        <ol>
          {log.map((m) => (
            <li key={`${m.at}-${m.id}`} data-widget={m.id} data-reason={m.reason}>
              <time dateTime={new Date(m.at).toISOString()}>
                {new Date(m.at).toLocaleTimeString()}
              </time>{' '}
              {m.id}: {m.from} → {m.to} ({m.reason})
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

export type CreatorBoardProps = {
  readonly runtime: BoardRuntime;
  readonly catalog: Catalog;
  readonly starters: readonly WidgetSpec[];
  /** Default 24 (decision 20). */
  readonly cap?: number;
  /** The controller, for the page's own use (and tests); called once. */
  readonly onController?: (ctl: BoardController) => void;
};

export function CreatorBoard({
  runtime,
  catalog,
  starters,
  cap = WIDGET_CAP,
  onController,
}: CreatorBoardProps): ReactElement {
  useCreatorStyles();
  const ctl = useMemo(
    () => new BoardController({ runtime, catalog, starters, cap }),
    [runtime, catalog, starters, cap],
  );
  const state = useSyncExternalStore(
    (fn) => ctl.subscribe(fn),
    () => ctl.state,
  );
  const form = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (form.current && preview.current) ctl.attachDrawer(form.current, preview.current);
    onController?.(ctl);
    ctl.start();
    return () => ctl.stop();
  }, [ctl, onController]);

  const { drawer } = state;
  return (
    <div
      className="creator-board"
      data-runtime={runtime.kind}
      data-ready={state.ready || undefined}
      data-drawer={drawer.open ? 'open' : 'closed'}
    >
      <div className="creator-toolbar">
        <button
          type="button"
          data-action="add"
          disabled={!state.ready || state.full}
          onClick={() => ctl.openAdd()}
        >
          Add widget
        </button>
        <button
          type="button"
          data-action="reset"
          disabled={!state.ready}
          onClick={() => void ctl.reset()}
        >
          Reset to starter
        </button>
        <span className="creator-count" data-count={state.widgets.length}>
          {state.widgets.length} / {cap} widgets
        </span>
        {runtime.auto ? <PlacementLog log={state.log} /> : null}
      </div>
      <div className="creator-grid">
        {state.ready && state.widgets.length === 0 ? (
          <p className="creator-empty">No widgets: add one, or reset to the starter widgets.</p>
        ) : null}
        {state.widgets.map((w) => {
          const placement = state.placements.get(w.id);
          const auto = runtime.auto !== undefined && w.spec.placement.mode === 'auto';
          return (
            <Slot
              key={w.id}
              ctl={ctl}
              widget={w}
              where={auto ? autoWhere(placement) : runtime.where(w.spec)}
              placement={auto ? placement : undefined}
              move={state.moved.get(w.id)}
            />
          );
        })}
      </div>
      <aside
        className="creator-drawer"
        hidden={!drawer.open}
        data-mode={drawer.open ? drawer.mode : undefined}
        aria-label="Widget drawer"
      >
        <div className="creator-drawer-head">
          <span>Preview</span>
          <button type="button" data-action="close" onClick={() => ctl.closeDrawer()}>
            Close
          </button>
        </div>
        <div
          className="creator-drawer-preview"
          ref={preview}
          data-draft={drawer.open ? drawer.draftId : undefined}
        />
        <div className="creator-drawer-body" ref={form} />
      </aside>
    </div>
  );
}
