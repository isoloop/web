// The playground page: tasks with a CPU dial, the worker each runs on, and
// the balancer's moves. It redraws from `playground.snapshot()` ten times a
// second; every action goes back through the model.
import type { ReactElement } from 'react';
import { LagChart, MoveLog, REASONS, SPIKE_MS, SUSTAINED_MS, useSnapshot } from '../ui';
import { MAX_TASKS, type ColumnView, type Mode, type Playground, type TaskView } from './model';

const LIGHT = [5, 8, 10, 12, 15];
const CHUNKS = [10, 25, 50, 100];

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'balancer', label: 'Balancer', hint: 'the balancer picks each task’s pool' },
  { mode: 'own', label: 'Own', hint: 'every task on a worker of its own' },
  { mode: 'one', label: 'One pool', hint: 'every task in a single pool' },
];

export function PlaygroundPage({ playground }: { playground: Playground }): ReactElement {
  const [snap, refresh] = useSnapshot(playground);
  const full = snap.count >= MAX_TASKS;
  return (
    <>
      <nav className="tabs" aria-label="Processor pages">
        <a href="./" aria-current="page">
          Playground
        </a>
        <a href="./files/">File processor</a>
      </nav>
      <section className="intro">
        <h1>Balancer playground</h1>
        <p>
          Each task is a headless isolate that keeps a share of one core busy. Add some, turn a dial
          up, and watch the balancer. It reads every worker’s heartbeat and moves the heaviest task
          out of a pool that is full (its tasks add up to 80 % of a core) or stays over{' '}
          {SUSTAINED_MS} ms of lag for 3 s. A task that blocks its loop past {SPIKE_MS} ms goes to
          quarantine, and comes back once it has been quiet for 30 s.
        </p>
      </section>

      <section className="controls" aria-label="Controls">
        <div className="group">
          <button
            type="button"
            className="ui-button"
            data-primary=""
            disabled={full}
            onClick={() => playground.add(10)}
          >
            Add task
          </button>
          <button
            type="button"
            className="ui-button"
            disabled={snap.count + LIGHT.length > MAX_TASKS}
            onClick={() => {
              for (const load of LIGHT) playground.add(load);
            }}
          >
            Add 5 light tasks
          </button>
          <span className="chip mono" data-testid="count">
            {snap.count}/{MAX_TASKS} tasks
          </span>
        </div>
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
                  void playground.setMode(m.mode);
                  refresh();
                }}
              />
              {m.label}
            </label>
          ))}
        </fieldset>
        <label className="group">
          Work chunk
          <select
            value={snap.chunkMs}
            onChange={(e) => playground.setChunk(Number(e.currentTarget.value))}
          >
            {CHUNKS.map((c) => (
              <option key={c} value={c}>
                {c} ms
              </option>
            ))}
          </select>
        </label>
        <span
          className="chip mono"
          data-testid="workers"
          title="Workers on the page (bus included); the balancer's pools against its allowance (the first quarantine is on top)"
        >
          workers {snap.workers} · balancer pools {snap.balancerPools}/{snap.maxWorkers}
        </span>
      </section>

      <section className="columns" aria-label="Workers">
        {snap.columns.length === 0 ? (
          <p className="empty">No tasks yet. Add one, or five light ones.</p>
        ) : (
          snap.columns.map((c) => <Column key={c.key} column={c} playground={playground} />)
        )}
      </section>

      <MoveLog log={snap.log} />
    </>
  );
}

function Column({ column, playground }: { column: ColumnView; playground: Playground }) {
  const total = column.tasks.reduce((s, t) => s + (t.measured ?? 0), 0);
  return (
    <section className="column" data-kind={column.kind} data-pool={column.key}>
      <header>
        <h2>{column.label}</h2>
        <span className="mono muted">{Math.round(total)} % of a core</span>
      </header>
      <LagChart lags={column.lags} />
      <ul className="cards">
        {column.tasks.map((t) => (
          <TaskCard key={`${column.key}/${t.id}`} task={t} playground={playground} />
        ))}
      </ul>
    </section>
  );
}

function TaskCard({ task, playground }: { task: TaskView; playground: Playground }) {
  const measured = task.measured === undefined ? undefined : Math.round(task.measured);
  return (
    <li
      className="card"
      data-task={task.id}
      data-state={task.state}
      data-moved={task.moved ? '' : undefined}
    >
      <div className="card-head">
        <strong>{task.name}</strong>
        <span className="mono muted state">{task.state}</span>
        {task.moved && (
          <span className="badge" data-reason={task.moved.reason}>
            {REASONS[task.moved.reason] ?? task.moved.reason} · from {task.moved.from}
          </span>
        )}
        {task.placement?.atCap && <span className="badge cap">at cap</span>}
      </div>
      <label className="dial">
        <span className="mono">CPU {task.load} %</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={task.load}
          aria-label={`${task.name} CPU`}
          onChange={(e) => playground.setLoad(task.id, Number(e.currentTarget.value))}
        />
      </label>
      <div className="meter" aria-label={`${task.name} measured load`}>
        <span className="set" style={{ width: `${task.load}%` }} />
        <span className="got" style={{ width: `${measured ?? 0}%` }} />
      </div>
      <div className="card-foot">
        <span className="mono muted" data-testid="measured">
          measured {measured === undefined ? '--' : `${measured} %`}
        </span>
        <span className="actions">
          <button type="button" className="ui-button" onClick={() => playground.block(task.id)}>
            Block 2 s
          </button>
          <button type="button" className="ui-button" onClick={() => playground.crash(task.id)}>
            Crash
          </button>
          <button
            type="button"
            className="ui-button"
            aria-label={`Remove ${task.name}`}
            onClick={() => void playground.remove(task.id)}
          >
            Remove
          </button>
        </span>
      </div>
    </li>
  );
}
