// The interactive board (M3e decisions 4, 8 and 20), for a page to mount: a
// toolbar (Add, Reset to starter, the count), the grid of widgets in add
// order, each with Edit and Delete, and the drawer docked on the right with
// its preview and form slots. The page brings its runtime (isoloopRuntime or
// nativeRuntime), its catalog and its starter widgets.
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactElement } from 'react';
import type { Catalog } from '../catalog';
import type { WidgetSpec } from '../spec/types';
import css from '../styles.css?inline';
import { SIZE } from '../views/size';
import { BoardController, WIDGET_CAP, type BoardWidget } from './controller';
import type { BoardRuntime } from './runtime';

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
}: {
  ctl: BoardController;
  widget: BoardWidget;
  where: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const { id, spec } = widget;
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
      data-pool={spec.placement.pool}
    >
      <header className="creator-slot-head">
        <span className="creator-slot-title">{spec.title}</span>
        <span className="creator-slot-where" data-where={where}>
          {where}
        </span>
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
    </section>
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
      </div>
      <div className="creator-grid">
        {state.ready && state.widgets.length === 0 ? (
          <p className="creator-empty">No widgets: add one, or reset to the starter widgets.</p>
        ) : null}
        {state.widgets.map((w) => (
          <Slot key={w.id} ctl={ctl} widget={w} where={runtime.where(w.spec)} />
        ))}
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
