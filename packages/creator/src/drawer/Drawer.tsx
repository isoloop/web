// The drawer's form (M3e decision 8): pick a topic, its operators and a view,
// see the preview follow every change, and add or save the widget. The same
// component runs in the drawer isolate (isolate.tsx) and on the native page;
// only the bus differs. It only uses what the DOM subset forwards: click,
// input and change, with host-owned inputs (isoloop ADR 0010).
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { KEY_FIELD, fieldOf, topicOf } from '../catalog';
import { validateSpec } from '../spec/validate';
import type { Size } from '../spec/types';
import type { ViewType } from '../outputs';
import { VIEW_LABELS } from '../views/kinds';
import { VIEW_SIZES } from '../views/size';
import { nextPool, poolLabel, sortPools } from '../board/pools';
import {
  UI_KEY,
  openOf,
  placementsOf,
  poolsOf,
  type AutoPlacement,
  type DoneWhat,
  type OpenCommand,
  type PoolStatus,
} from '../board/ui';
import {
  DRAFT_TOPIC,
  SPECS_TOPIC,
  TOMBSTONE,
  UI_TOPIC,
  addedOf,
  isWidgetKey,
  specOf,
  specRecord,
  type SpecRecord,
} from '../widget/records';
import type { WidgetSpec } from '../spec/types';
import type { DrawerConfig } from './config';
import {
  AGGREGATE_FNS,
  AUTO_POOL,
  COMPARE_OPS,
  emptyForm,
  fieldOfPath,
  fieldsOf,
  fitView,
  formOfSpec,
  kindOf,
  specOfForm,
  viewsFor,
  withTopic,
  type FilterRow,
  type FormState,
  type RowOp,
} from './form';

/** What the form reads and publishes through: an isolate's `ctx.bus` or the native bus. */
export interface DrawerBus {
  subscribe(
    topic: string,
    fn: (r: { readonly key?: string | undefined; readonly value: unknown }) => void,
    opts?: { readonly onReset?: () => void },
  ): () => void;
  publish(topic: string, key: string, value: unknown): Promise<void>;
}

/** The placement field's "Create new". */
const NEW_POOL = '$new';

type Held = { readonly spec: WidgetSpec; readonly added: number | undefined };

const randomId = (): string => `w-${Math.random().toString(36).slice(2, 8)}`;

function Field({
  label,
  errors,
  id,
  children,
}: {
  label: string;
  errors: ReadonlyMap<string, readonly string[]>;
  id: string;
  children: ReactNode;
}): ReactElement {
  const list = errors.get(id) ?? [];
  return (
    <div className="creator-field" data-field={id} data-invalid={list.length > 0 || undefined}>
      <label>
        <span className="creator-field-label">{label}</span>
        {children}
      </label>
      {list.map((m) => (
        <p key={m} className="creator-error" data-error-for={id}>
          {m}
        </p>
      ))}
    </div>
  );
}

export function Drawer({ bus, config }: { bus: DrawerBus; config: DrawerConfig }): ReactElement {
  const { catalog } = config;
  const [held, setHeld] = useState<ReadonlyMap<string, Held>>(new Map());
  const [pools, setPools] = useState<readonly PoolStatus[]>([]);
  const [placements, setPlacements] = useState<readonly AutoPlacement[]>([]);
  const [open, setOpen] = useState<OpenCommand | undefined>(undefined);
  const [form, setForm] = useState<FormState | undefined>(undefined);
  const applied = useRef(-1);
  const lastDraft = useRef<{ key: string; value: SpecRecord } | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const specs = new Map<string, Held>();
    const offSpecs = bus.subscribe(SPECS_TOPIC, (r) => {
      if (!isWidgetKey(r.key)) return;
      const spec = specOf(r.value);
      if (spec === null) specs.delete(r.key);
      else specs.set(r.key, { spec, added: addedOf(r.value) ?? specs.get(r.key)?.added });
      setHeld(new Map(specs));
    });
    const offUi = bus.subscribe(
      UI_TOPIC,
      (r) => {
        if (r.key === UI_KEY.pools) setPools(poolsOf(r.value) ?? []);
        else if (r.key === UI_KEY.placements) setPlacements(placementsOf(r.value) ?? []);
        else if (r.key === UI_KEY.open) {
          const cmd = openOf(r.value);
          if (cmd) setOpen(cmd);
        }
      },
      {
        // The bus restarted and lost the memory topics: the preview's draft
        // went with them, so publish it again.
        onReset: () => {
          const d = lastDraft.current;
          if (d) void bus.publish(DRAFT_TOPIC, d.key, d.value).catch(() => {});
        },
      },
    );
    return () => {
      offSpecs();
      offUi();
    };
  }, [bus]);

  // Where a new widget starts: "Automatic" when the page has a balancer or
  // runs natively (M3h decision 20), else the pool of the widget added last.
  const lastPool = useMemo(() => {
    if (config.auto || config.native) return AUTO_POOL;
    let best: Held | undefined;
    for (const h of held.values()) {
      if (h.spec.placement.mode !== 'manual') continue;
      if (!best || (h.added ?? 0) > (best.added ?? 0)) best = h;
    }
    return best?.spec.placement.mode === 'manual' ? best.spec.placement.pool : 'pool-1';
  }, [held, config.auto, config.native]);

  // A new opening: a fresh form to add, or the widget's own to edit (once its spec is here).
  useEffect(() => {
    if (!open || applied.current === open.n) return;
    if (open.mode === 'add') {
      applied.current = open.n;
      lastDraft.current = undefined;
      setForm(emptyForm(catalog, randomId(), lastPool));
      return;
    }
    const h = open.id === undefined ? undefined : held.get(open.id);
    if (!h) return;
    applied.current = open.n;
    lastDraft.current = undefined;
    setForm(formOfSpec(h.spec, catalog));
  }, [open, held, catalog, lastPool]);

  const result = useMemo(
    () =>
      form ? validateSpec(specOfForm(form, catalog), catalog, { chaos: config.chaos }) : undefined,
    [form, catalog, config.chaos],
  );

  // Every valid change goes to the draft; the preview rebuilds 300 ms after the last.
  useEffect(() => {
    if (!open || !result?.ok) return;
    const value = specRecord(result.spec);
    lastDraft.current = { key: open.draftId, value };
    void bus.publish(DRAFT_TOPIC, open.draftId, value).catch(() => {});
  }, [bus, open, result]);

  const errors = useMemo(() => {
    const by = new Map<string, string[]>();
    if (!form || !result || result.ok) return by;
    for (const e of result.errors) {
      const id = fieldOfPath(e.path, form);
      by.set(id, [...(by.get(id) ?? []), e.message]);
    }
    return by;
  }, [form, result]);

  if (!form || !open) {
    return <div className="creator-drawer-form" data-state="idle" />;
  }

  const topic = topicOf(catalog, form.topic);
  const fields = fieldsOf(topic);
  const kind = kindOf(form, catalog);
  const views = viewsFor(kind);
  const count = held.size;
  const full = open.mode === 'add' && count >= config.cap;
  const label = (name: string) =>
    name === KEY_FIELD
      ? (topic?.key?.label ?? 'Key')
      : topic
        ? (fieldOf(topic, name)?.label ?? name)
        : name;

  const set = (patch: Partial<FormState>) =>
    setForm((f) => (f ? fitView({ ...f, ...patch }, catalog) : f));
  const setRow = (i: number, patch: Partial<FilterRow>) =>
    set({ filters: form.filters.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const finish = async (what: DoneWhat, record?: SpecRecord): Promise<void> => {
    setBusy(true);
    try {
      if (record) await bus.publish(SPECS_TOPIC, form.id, record);
      await bus.publish(UI_TOPIC, UI_KEY.done, { done: { n: open.n, what, id: form.id } });
    } finally {
      setBusy(false);
    }
  };

  const poolNames = sortPools([
    ...pools.map((p) => p.pool),
    ...[...held.values()].flatMap((h) =>
      h.spec.placement.mode === 'manual' ? [h.spec.placement.pool] : [],
    ),
    ...(form.pool === AUTO_POOL ? [] : [form.pool]),
  ]);
  // "Automatic", and where the balancer has the widget being edited now.
  const autoAt = open.mode === 'edit' ? placements.find((p) => p.id === form.id) : undefined;
  const autoText = autoAt ? `Automatic · in ${autoAt.label}` : 'Automatic';
  const statusOf = (pool: string) => pools.find((p) => p.pool === pool);
  const poolText = (pool: string) => {
    const s = statusOf(pool);
    if (!s) return `${poolLabel(pool)} (new)`;
    const lag = s.lagMs === null ? '' : ` · lag ${Math.round(s.lagMs)} ms`;
    return `${s.label} · ${s.members} widget${s.members === 1 ? '' : 's'}${lag}`;
  };

  const top = errors.get('form') ?? [];

  return (
    <form
      className="creator-drawer-form"
      data-state="open"
      data-mode={open.mode}
      data-valid={result?.ok ? 'true' : 'false'}
      data-kind={kind}
      // The title as the form last rendered it: the comparison times a
      // keystroke until the drawer has handled it (M3e decision 22).
      data-title={form.title}
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="creator-drawer-title">
        {open.mode === 'add' ? 'Add a widget' : 'Edit widget'}
      </h2>
      {top.map((m) => (
        <p key={m} className="creator-error" data-error-for="form">
          {m}
        </p>
      ))}
      {open.mode === 'add' && (catalog.presets?.length ?? 0) > 0 ? (
        <div className="creator-presets">
          {catalog.presets?.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-action="preset"
              data-preset={preset.id}
              disabled={busy}
              onClick={() =>
                setForm(
                  fitView(
                    formOfSpec(
                      {
                        ...preset.spec,
                        id: form.id,
                        placement:
                          form.pool === AUTO_POOL
                            ? { mode: 'auto' }
                            : { mode: 'manual', pool: form.pool },
                      },
                      catalog,
                    ),
                    catalog,
                  ),
                )
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <fieldset>
        <legend>Source</legend>
        <Field label="Topic" id="topic" errors={errors}>
          <select
            name="topic"
            value={form.topic}
            onChange={(e) =>
              setForm(fitView(withTopic(form, catalog, e.currentTarget.value), catalog))
            }
          >
            {catalog.topics.map((t) => (
              <option key={t.name} value={t.name}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        {topic?.key ? (
          <Field label={topic.key.label} id="key" errors={errors}>
            {topic.key.values ? (
              <select
                name="key"
                value={form.key}
                onChange={(e) => set({ key: e.currentTarget.value })}
              >
                <option value="">All</option>
                {topic.key.values.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="key"
                placeholder="All"
                value={form.key}
                onChange={(e) => set({ key: e.currentTarget.value })}
              />
            )}
          </Field>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Filter</legend>
        {form.filters.length > 1 ? (
          <Field label="Keep records matching" id="join" errors={errors}>
            <select
              name="join"
              value={form.join}
              onChange={(e) => set({ join: e.currentTarget.value === 'or' ? 'or' : 'and' })}
            >
              <option value="and">all rows</option>
              <option value="or">any row</option>
            </select>
          </Field>
        ) : null}
        {form.filters.map((r, i) => (
          <div key={i} className="creator-row" data-row={i}>
            <Field label={`Row ${i + 1}`} id={`row-${i}`} errors={errors}>
              <span className="creator-row-controls">
                <select
                  name={`row-field-${i}`}
                  aria-label="Field"
                  value={r.field}
                  onChange={(e) => setRow(i, { field: e.currentTarget.value })}
                >
                  {fields.all.map((f) => (
                    <option key={f} value={f}>
                      {label(f)}
                    </option>
                  ))}
                </select>
                <select
                  name={`row-op-${i}`}
                  aria-label="Comparison"
                  value={r.op}
                  onChange={(e) => {
                    const op = COMPARE_OPS.find((o) => o === e.currentTarget.value);
                    if (op) setRow(i, { op: op satisfies RowOp });
                  }}
                >
                  {COMPARE_OPS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input
                  name={`row-value-${i}`}
                  aria-label="Value"
                  placeholder={r.op === 'in' ? 'a, b, c' : 'value'}
                  value={r.value}
                  onChange={(e) => setRow(i, { value: e.currentTarget.value })}
                />
                <label className="creator-inline">
                  <input
                    type="checkbox"
                    name={`row-not-${i}`}
                    checked={r.not}
                    onChange={(e) => setRow(i, { not: e.currentTarget.checked })}
                  />
                  not
                </label>
                <button
                  type="button"
                  data-action="remove-row"
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() => set({ filters: form.filters.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </span>
            </Field>
          </div>
        ))}
        <button
          type="button"
          data-action="add-row"
          disabled={fields.all.length === 0}
          onClick={() =>
            set({
              filters: [
                ...form.filters,
                { field: fields.all[0] ?? '', op: '==', value: '', not: false },
              ],
            })
          }
        >
          Add a condition
        </button>
      </fieldset>

      <fieldset>
        <legend>Window and aggregate</legend>
        <Field label="Window" id="window" errors={errors}>
          <span className="creator-row-controls">
            <select
              name="window-by"
              value={form.windowBy}
              onChange={(e) => {
                const v = e.currentTarget.value;
                set({ windowBy: v === 'seconds' || v === 'count' ? v : 'none' });
              }}
            >
              <option value="none">None</option>
              <option value="seconds">Last seconds</option>
              <option value="count">Last records</option>
            </select>
            {form.windowBy === 'none' ? null : (
              <input
                name="window-value"
                inputMode="decimal"
                aria-label={form.windowBy === 'seconds' ? 'Seconds' : 'Records'}
                value={form.windowValue}
                onChange={(e) => set({ windowValue: e.currentTarget.value })}
              />
            )}
          </span>
        </Field>
        <Field label="Aggregate" id="fn" errors={errors}>
          <select
            name="fn"
            value={form.fn}
            onChange={(e) => {
              const fn = AGGREGATE_FNS.find((f) => f === e.currentTarget.value);
              set({ fn: fn ?? 'none' });
            }}
          >
            <option value="none">None (the records)</option>
            {AGGREGATE_FNS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        {form.fn !== 'none' && form.fn !== 'count' ? (
          <Field label="Of" id="field" errors={errors}>
            <select
              name="field"
              value={form.field}
              onChange={(e) => set({ field: e.currentTarget.value })}
            >
              {fields.numbers.map((f) => (
                <option key={f} value={f}>
                  {label(f)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {form.fn === 'percentile' ? (
          <Field label="Percentile (p)" id="p" errors={errors}>
            <input
              name="p"
              inputMode="decimal"
              value={form.p}
              onChange={(e) => set({ p: e.currentTarget.value })}
            />
          </Field>
        ) : null}
        {form.fn === 'none' ? null : (
          <>
            <Field label="Every (seconds; empty: now only)" id="every" errors={errors}>
              <input
                name="every"
                inputMode="decimal"
                value={form.every}
                onChange={(e) => set({ every: e.currentTarget.value })}
              />
            </Field>
            <Field label="Group by" id="groupBy" errors={errors}>
              <select
                name="group-by"
                value={form.groupBy}
                onChange={(e) => set({ groupBy: e.currentTarget.value })}
              >
                <option value="">No grouping</option>
                {fields.texts.map((f) => (
                  <option key={f} value={f}>
                    {label(f)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <p className="creator-hint" data-hint="kind">
          Output: {kind}
        </p>
      </fieldset>

      <fieldset>
        <legend>View</legend>
        <Field label="View" id="view" errors={errors}>
          <select
            name="view"
            value={form.view}
            onChange={(e) => {
              const v = views.find((x) => x === e.currentTarget.value);
              if (v) set({ view: v satisfies ViewType });
            }}
          >
            {views.map((v) => (
              <option key={v} value={v}>
                {VIEW_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size" id="size" errors={errors}>
          <select
            name="size"
            value={form.size}
            onChange={(e) => {
              const s = VIEW_SIZES.find((x) => x === e.currentTarget.value);
              if (s) set({ size: s satisfies Size });
            }}
          >
            {VIEW_SIZES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        {form.view === 'table' ? (
          <Field label="Rows (empty: 50)" id="limit" errors={errors}>
            <input
              name="limit"
              inputMode="numeric"
              value={form.limit}
              onChange={(e) => set({ limit: e.currentTarget.value })}
            />
          </Field>
        ) : null}
        {form.view === 'stat' ? (
          <Field label="Gauge from, to (both or neither)" id="gauge" errors={errors}>
            <span className="creator-row-controls">
              <input
                name="gauge-min"
                aria-label="Gauge from"
                inputMode="decimal"
                value={form.gaugeMin}
                onChange={(e) => set({ gaugeMin: e.currentTarget.value })}
              />
              <input
                name="gauge-max"
                aria-label="Gauge to"
                inputMode="decimal"
                value={form.gaugeMax}
                onChange={(e) => set({ gaugeMax: e.currentTarget.value })}
              />
            </span>
          </Field>
        ) : null}
        <Field label="Title (empty: made from your choices)" id="title" errors={errors}>
          <input
            name="title"
            value={form.title}
            onChange={(e) => set({ title: e.currentTarget.value })}
          />
        </Field>
      </fieldset>

      {config.chaos ? (
        <fieldset data-chaos>
          <legend>Burn (test only)</legend>
          <Field label="Make it misbehave" id="burn" errors={errors}>
            <select
              name="burn"
              value={form.burn}
              onChange={(e) => {
                const v = e.currentTarget.value;
                set({ burn: v === 'block' || v === 'load' ? v : 'none' });
              }}
            >
              <option value="none">No</option>
              <option value="block">Block every few seconds</option>
              <option value="load">Steady load</option>
            </select>
          </Field>
          {form.burn === 'block' ? (
            <>
              <Field label="Every (s)" id="burnEvery" errors={errors}>
                <input
                  name="burnEvery"
                  value={form.burnEvery}
                  onChange={(e) => set({ burnEvery: e.currentTarget.value })}
                />
              </Field>
              <Field label="For (ms)" id="burnFor" errors={errors}>
                <input
                  name="burnFor"
                  value={form.burnFor}
                  onChange={(e) => set({ burnFor: e.currentTarget.value })}
                />
              </Field>
            </>
          ) : null}
          {form.burn === 'load' ? (
            <Field label="Load (% of a core)" id="burnLoad" errors={errors}>
              <input
                name="burnLoad"
                value={form.burnLoad}
                onChange={(e) => set({ burnLoad: e.currentTarget.value })}
              />
            </Field>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset>
        <legend>Placement</legend>
        <Field label="Runs in" id="pool" errors={errors}>
          {config.native ? (
            <select name="pool" disabled value="">
              <option value="">Not used</option>
            </select>
          ) : (
            <select
              name="pool"
              value={form.pool}
              onChange={(e) => {
                const v = e.currentTarget.value;
                set({ pool: v === NEW_POOL ? nextPool(poolNames) : v });
              }}
            >
              {config.auto ? <option value={AUTO_POOL}>{autoText}</option> : null}
              {poolNames.map((p) => (
                <option key={p} value={p}>
                  {poolText(p)}
                </option>
              ))}
              <option value={NEW_POOL}>Create new</option>
            </select>
          )}
        </Field>
      </fieldset>

      {full ? (
        <p className="creator-error" data-error-for="cap">
          A page holds at most {config.cap} widgets: delete one to add another.
        </p>
      ) : null}

      <div className="creator-actions">
        {open.mode === 'add' ? (
          <button
            type="button"
            data-action="add"
            disabled={busy || full || !result?.ok}
            onClick={() => {
              if (result?.ok) void finish('added', specRecord(result.spec, Date.now()));
            }}
          >
            Add widget
          </button>
        ) : (
          <>
            <button
              type="button"
              data-action="save"
              disabled={busy || !result?.ok}
              onClick={() => {
                if (result?.ok)
                  void finish('saved', specRecord(result.spec, held.get(form.id)?.added));
              }}
            >
              Save
            </button>
            <button
              type="button"
              data-action="delete"
              disabled={busy}
              onClick={() => void finish('deleted', TOMBSTONE)}
            >
              Delete
            </button>
          </>
        )}
        <button
          type="button"
          data-action="cancel"
          disabled={busy}
          onClick={() => void finish('cancel')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
