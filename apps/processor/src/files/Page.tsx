// The File processor page (M3h decision 29): the generator's dials, what
// came out (queue, jobs per second, latency), the processors on their
// workers, the latest results with a filter, and the balancer's moves.
import { useState, type ReactElement } from 'react';
import {
  DevtoolsToggle,
  Intro,
  LagChart,
  MoveLog,
  REASONS,
  RestartsControl,
  useSnapshot,
} from '../ui';
import { KIND_LABELS } from './kinds';
import type { FileProcessor, Mode, ProcessorView, Result, WorkerView } from './model';

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'balancer', label: 'Balancer', hint: 'the balancer picks each processor’s pool' },
  { mode: 'own', label: 'Own', hint: 'every processor on a worker of its own' },
  { mode: 'one', label: 'One pool', hint: 'every processor in a single pool' },
];

const ms = (v: number | undefined): string => (v === undefined ? '--' : `${Math.round(v)} ms`);

/** The page's tabs and intro: all of it that needs no kernel (drawn before Start with ?start=manual). */
export function FilesIntro(): ReactElement {
  return (
    <>
      <nav className="tabs" aria-label="Processor pages">
        <a href="../">Playground</a>
        <a href="./" aria-current="page">
          File processor
        </a>
      </nav>
      <section className="intro">
        <h1>File processor</h1>
        <Intro id="processor-files" />
      </section>
    </>
  );
}

export function FilesPage({ model }: { model: FileProcessor }): ReactElement {
  const [snap, refresh] = useSnapshot(model);
  const d = snap.dials;
  return (
    <>
      <FilesIntro />

      <section className="controls" aria-label="Generator">
        <div className="group">
          <button
            type="button"
            className="ui-button"
            data-primary=""
            onClick={() => {
              model.setDials({ running: !d.running });
              refresh();
            }}
          >
            {d.running ? 'Stop' : 'Start'}
          </button>
          <button
            type="button"
            className="ui-button"
            onClick={() => {
              model.newRun();
              refresh();
            }}
          >
            New run
          </button>
          <span className="chip mono">run {d.run}</span>
        </div>
        <Dial
          label="Files/s"
          value={d.rate}
          max={200}
          step={5}
          onChange={(rate) => model.setDials({ rate })}
        />
        <Dial
          label="Poison %"
          value={d.poison}
          max={20}
          step={1}
          onChange={(poison) => model.setDials({ poison })}
        />
        <Dial
          label="Heavy %"
          value={d.heavy}
          max={50}
          step={1}
          onChange={(heavy) => model.setDials({ heavy })}
        />
        <Dial
          label="Corrupt %"
          value={d.corrupt}
          max={20}
          step={1}
          onChange={(corrupt) => model.setDials({ corrupt })}
        />
        <fieldset className="group modes">
          <legend>Placement</legend>
          {MODES.map((m) => (
            <label key={m.mode} title={m.hint}>
              <input
                type="radio"
                name="mode"
                value={m.mode}
                checked={snap.mode === m.mode}
                onChange={() => {
                  void model.setMode(m.mode);
                  refresh();
                }}
              />
              {m.label}
            </label>
          ))}
        </fieldset>
        <span
          className="chip mono"
          data-testid="workers"
          title="Workers on the page (bus and generator included); the balancer's pools against its allowance"
        >
          workers {snap.workerCount} · balancer pools {snap.balancerPools}/{snap.maxWorkers}
        </span>
        <RestartsControl />
        <DevtoolsToggle />
      </section>

      <section className="stats" aria-label="Figures">
        <Stat label="Queue" value={snap.queue} testid="queue" />
        <Stat label="Jobs/s" value={snap.jobsPerSec.toFixed(1)} testid="rate" />
        <Stat label="Latency p50" value={ms(snap.p50)} testid="p50" />
        <Stat label="Latency p95" value={ms(snap.p95)} testid="p95" />
        <Stat label="Done" value={`${snap.done}/${snap.produced}`} testid="done" />
        <Stat label="Corrupt" value={snap.corrupt} testid="corrupt" />
        <Stat label="Duplicates" value={snap.duplicates} testid="duplicates" />
      </section>

      <table className="kinds">
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Made</th>
            <th scope="col">Done</th>
            <th scope="col">Queue</th>
            <th scope="col">p95</th>
          </tr>
        </thead>
        <tbody>
          {snap.kinds.map((k) => (
            <tr key={k.kind} data-kind={k.kind}>
              <th scope="row">{KIND_LABELS[k.kind]}</th>
              <td className="mono">{k.produced}</td>
              <td className="mono">{k.done}</td>
              <td className="mono">{k.queue}</td>
              <td className="mono">{ms(k.p95)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="columns" aria-label="Workers">
        {snap.workers.map((w) => (
          <Worker key={w.key} worker={w} model={model} />
        ))}
      </section>

      <Recent results={snap.recent} />
      <MoveLog log={snap.log} />
    </>
  );
}

function Dial(props: {
  label: string;
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): ReactElement {
  return (
    <label className="group dial-control">
      <span>{props.label}</span>
      <input
        type="range"
        min="0"
        max={props.max}
        step={props.step}
        value={props.value}
        aria-label={props.label}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      <span className="mono">{props.value}</span>
    </label>
  );
}

function Stat(props: { label: string; value: string | number; testid: string }): ReactElement {
  return (
    <div className="stat">
      <span className="muted">{props.label}</span>
      <strong className="mono" data-testid={props.testid}>
        {props.value}
      </strong>
    </div>
  );
}

function Worker({ worker, model }: { worker: WorkerView; model: FileProcessor }): ReactElement {
  const total = worker.processors.reduce((s, p) => s + (p.load ?? 0), 0);
  return (
    <section className="column" data-kind={worker.kind} data-pool={worker.key}>
      <header>
        <h2>{worker.label}</h2>
        <span className="mono muted">{Math.round(total)} % of a core</span>
      </header>
      <LagChart lags={worker.lags} />
      <ul className="cards">
        {worker.processors.map((p) => (
          <Processor key={`${worker.key}/${p.id}`} p={p} model={model} />
        ))}
      </ul>
    </section>
  );
}

function Processor({ p, model }: { p: ProcessorView; model: FileProcessor }): ReactElement {
  const load = p.load === undefined ? undefined : Math.round(p.load);
  return (
    <li
      className="card"
      data-processor={p.id}
      data-state={p.state}
      data-moved={p.moved ? '' : undefined}
    >
      <div className="card-head">
        <strong>{p.id}</strong>
        <span className="mono muted state">{p.state}</span>
        {p.measuring && (
          <span
            className="badge"
            data-reason="measuring"
            title="In quarantine only to be measured, not for an offence; it leaves once measured"
          >
            measuring
          </span>
        )}
        {p.moved && (
          <span className="badge" data-reason={p.moved.reason}>
            {REASONS[p.moved.reason] ?? p.moved.reason} · from {p.moved.from}
          </span>
        )}
      </div>
      <div className="meter" aria-label={`${p.id} load`}>
        <span className="got" style={{ width: `${load ?? 0}%` }} />
      </div>
      <div className="card-foot">
        <span className="mono muted">load {load === undefined ? '--' : `${load} %`}</span>
        <span className="mono muted">{p.done} done</span>
      </div>
      {p.gaveUp && (
        <div className="gave-up" data-testid="gave-up">
          <span className="mono">{p.gaveUp}</span>
          <button type="button" className="ui-button" onClick={() => model.restart(p.id)}>
            Restart
          </button>
        </div>
      )}
    </li>
  );
}

function Recent({ results }: { results: Result[] }): ReactElement {
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const shown = (
    f
      ? results.filter(
          (r) => r.id.includes(f) || r.kind.includes(f) || r.by.includes(f) || r.status.includes(f),
        )
      : results
  ).slice(0, 30);
  return (
    <section className="recent" aria-label="Latest results">
      <header>
        <h2>Latest results</h2>
        <input
          type="search"
          placeholder="Filter: id, kind, processor, corrupt"
          aria-label="Filter results"
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
        />
      </header>
      {/* `data-filter`: the filter this table was drawn with, for the comparison's typing latency. */}
      <table data-filter={f}>
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Kind</th>
            <th scope="col">By</th>
            <th scope="col">Work</th>
            <th scope="col">Latency</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} data-status={r.status}>
              <td className="mono">{r.id}</td>
              <td>{KIND_LABELS[r.kind]}</td>
              <td className="mono">{r.by}</td>
              <td className="mono">{ms(r.ms)}</td>
              <td className="mono">{ms(r.latency)}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
