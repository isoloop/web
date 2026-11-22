// Every text on the site, in one place (plan tasks 4 and 9). The wording is
// the one approved in the design prototype (concept A). Text in backticks is
// set as code.
//
// Rules for anyone editing it (ADR 0002, decision 10): Isoloop is a complete
// toolchain, not a speed fix; never "faster than native"; performance as
// measurements, with the device, the build and the tag; the cost stated
// plainly next to what it gives. Every figure names its source in the comment
// above it.

/** A table row: its heading, then one cell per column. */
type Row = [string, ...string[]];

export const site = {
  description:
    'Event-loop isolation for JavaScript apps. An open-source TypeScript library: each part of your app runs on its own worker or in a shared pool, talks over a message bus, and is restarted when it fails, while the rest keeps running.',
};

// The features themselves (their strip line, heading and section text, with
// proof links) are in content/features/<id>.json (ADR 0004, decision 5).

/** The recording on the landing page and in /features/#containment. */
export const recording = {
  heading: 'A live recording of four isolates',
  label: 'A recording of the main thread, the bus and three event loops, scrolling as tasks run.',
  tracks: {
    main: ['Main thread', 'host'],
    bus: ['Bus', 'worker'],
    A: ['A, counter', 'own worker'],
    B: ['B, ticker', 'own worker'],
    pool: ['C and D', 'one pool'],
  } as Record<string, [string, string]>,
  legend: {
    task: 'A bar is work running on that thread; time moves to the left.',
    stuck: 'Hatched: the thread is stuck, so nothing else on it can run.',
    restart: 'A line across a track: that isolate was stopped and started again.',
    reaction: 'A hollow tick is a reaction to a record; the line points to who sent it.',
    bus: 'The demo’s own measurement records aren’t drawn.',
  },
  /** On C's and D's rows while A is down: no input, not stuck. */
  waiting: 'no count from A',
  controls: {
    group: 'Try it',
    blockC: 'Block C for 3 s',
    crashA: 'Crash A',
    blockMain: 'Block the main thread',
    restart: (ids: string[]): string => `Restart ${ids.join(' and ')}`,
    used: (label: string, used: number): string => `${label} · ${used}/3`,
    // Starts with the visible text, so the two match (WCAG 2.5.3).
    usedName: (label: string, used: number): string =>
      `${label} · ${used}/3 restarts used this minute`,
  },
  guard:
    'An isolate that crashes more than 3 times within a minute is marked failed, and the kernel stops restarting it.',
  statusLabel: 'Status',
  status: {
    waiting: 'Starting basic…',
    running: 'Recording. Everything is running.',
    unsupported:
      'This browser can’t run basic, so the recording stays empty. It needs Safari 16.4 or later, or a recent Chrome, Edge or Firefox.',
    cStuck:
      'C is stuck. D shares its loop, so D waits too. The main thread, the bus, A and B carry on.',
    poolRestarted:
      'After 2 s without a heartbeat the pool was stopped and started again. C and D caught up from the bus.',
    aCrashed: 'A crashed and was started again on its own worker. Nothing else noticed.',
    mainStuck:
      'The main thread is stuck for 3 s, so this page can’t paint, the recording included. The isolates keep running in their workers.',
    mainFree:
      'The main thread is free again. The hatched gap is where it was stuck; the isolates’ tracks kept going.',
    failed: (id: string): string =>
      `${id} crashed more than 3 times within a minute, so the kernel’s crash-loop guard stopped restarting it. It stays down until it’s restarted.`,
    restarted: (id: string): string =>
      `${id} was restarted with kernel.restart(), and its restart count starts over.`,
    budget: (used: number): string => `${used} of 3 restarts used this minute.`,
  },
  open: 'Open basic on its own page',
};

/** A use: the pattern, then an example of it. */
type Use = [pattern: string, example: string];

/** Whether a Δ is better or worse for the reader; `same` for no change. */
export type Verdict = 'better' | 'worse' | 'same';
/** One pair's cells in a row: A, B, and the Δ with its verdict (none for counts). */
export type PairCells = [a: string, b: string, delta?: [string, Verdict]];
export interface DeltaRow {
  label: string;
  /** One entry per pair, in the order of `pairs`. */
  cells: PairCells[];
}
export interface DeltaGroup {
  heading: string;
  rows: DeltaRow[];
}

export const home = {
  title: 'Isoloop: event-loop isolation for JavaScript apps',
  intro: {
    heading: 'Event-loop isolation for JavaScript apps',
    text: 'An open-source TypeScript library. Each part of your app runs on its own worker or in a shared pool, talks only through a message bus that keeps its records, and is restarted by a supervisor when it fails. A block or a crash stays in its part, and the rest of the app keeps running. React, Preact or plain DOM.',
    primary: 'See the features',
    // Basic and the processor run live on /examples/ (in its panels, idle until
    // Start); the plant and markets dashboards open on their own pages.
    secondary: 'The examples: two run live on the page, the dashboards on their own pages',
  },
  try: 'Try it. This is basic, the smallest example, running in this page: four isolates on three event loops. A and B have a worker each; C and D share a pool and read A’s count. Block or crash one, or block the main thread, and watch what keeps running.',
  code: {
    summary: 'Show the code behind this demo',
    intro:
      'basic’s setup, without its recording code. A restart needs no code of its own; A catches up by reading its topic from the earliest record it keeps. Type-checked against the published packages.',
    label: 'Files',
    files: { topics: 'topics.ts', isolate: 'counter.ts', host: 'main.ts' },
    more: 'basic’s full source',
    source: 'https://github.com/isoloop/web/tree/main/apps/basic',
  },

  uses: {
    heading: 'What it’s for',
    // Patterns, not examples (2026-11-18): the core promise first, then from
    // the broadest need to the narrowest. Figures live on the examples.
    items: <Use[]>[
      ['Keeping one part’s load from stalling the rest.', 'live dashboards on heavy datasets'],
      ['Moving heavy work off the UI’s thread.', 'parsing, search, simulation'],
      ['Keeping state through a crash or a reload.', 'alarms, event logs, drafts'],
      // Unreliable, not hostile: isolates share the origin (isoloop/isoloop README, "Hostile code").
      ['Containing code you don’t control.', 'widgets from other teams, AI-generated components'],
      ['Combining parts with different owners.', 'micro-frontends from several teams'],
      [
        'Building apps with no server behind them.',
        'data pipelines over public APIs, on a static host',
      ],
    ],
  },
  strip: { heading: 'Features', all: 'All features, with live demos' },
  gives: {
    heading: 'What it gives',
    // Source: apps/dashboards/plant/README.md, "What each build does when
    // something goes wrong", and e2e/placements.spec.ts, both unchanged at
    // plant-v0.3.1 (checked 2026-11-21). Behaviour only: the figures are in
    // the costs table below.
    caption:
      'The plant dashboard: 72 widgets on 8 machines, built three ways from the same code and data. What each build does when something goes wrong, at plant-v0.3.1.',
    head: ['', 'Native', 'Native + workers', 'Isoloop'],
    rows: <Row[]>[
      [
        'One widget blocks for 3 s',
        'Whole page stalls',
        'Whole page stalls',
        'Its pool stalls; data keeps flowing',
      ],
      ['With a pool per machine (split, opt-in)', '—', '—', 'Only that machine’s 8 widgets stall'],
      [
        'After the block',
        'Nothing restarts',
        'Nothing restarts',
        'The pool restarts and catches up',
      ],
      ['A widget throws', 'Down until reload', 'Down until reload', 'Restarted'],
      [
        'Alarms and events after a reload',
        'Saved at most once a second',
        'Saved at most once a second',
        'Every acknowledged record',
      ],
    ],
    more: 'Every build and placement, with sources',
  },
  costs: {
    heading: 'What it costs, and where it helps',
    // The table, its caption and notes are plant's `desktop` block
    // (apps/dashboards/plant/example.json), shared with /examples/.
    delta: 'Δ',
    verdicts: { better: 'better', worse: 'worse', same: 'no change' } as Record<Verdict, string>,
    findings: 'Findings',
    more: 'The full results, with the method',
  },
  limits: {
    heading: 'What Isoloop can’t hide',
    // Source: isoloop/isoloop RFC 0001, "What no adapter can hide".
    items: [
      'Synchronous layout reads (getBoundingClientRect, offsetWidth) and synchronous focus and scroll. An isolate asks the host and gets a promise back.',
      'Third-party code that reaches for window, document.body or localStorage. An isolate gets a DOM subset sized to what Preact and React use.',
      'Drag and drop, text selection and canvas drawing tied to pointer timing. Canvas isolates can draw to an OffscreenCanvas instead.',
      'The cost. Every worker, the bus and the kernel take CPU, memory and start-up time, as the table above shows.',
    ],
    /** The docs' page of the same name (/docs/limits/), with the full list. */
    more: 'The full list, in the docs',
  },
  how: {
    heading: 'How it works',
    // Sources: isoloop/isoloop docs/diagrams (runtime topology, restarts),
    // ADR 0015 (pools), docs/guide/pools.md (start positions, isoloop#186),
    // docs/guide/supervision.md (the defaults: 3 restarts within 60 s, so a
    // fourth crash in a minute fails the isolate).
    text: [
      'Your app’s host runs on the page’s main thread. Each isolate runs in a worker, either one of its own or a pool it shares with others.',
      'Isolates don’t call each other. They publish records to topics and subscribe to them, through a message bus that runs in a worker of its own and keeps each topic’s records for as long as its retention says.',
      'A supervisor watches every worker’s heartbeat. When an isolate’s own code fails, it alone is restarted. When a worker stops responding, or fails in a way no single isolate can be blamed for, the worker is replaced with every isolate in it. The supervisor gives up on an isolate that crashes again after 3 restarts in a minute. A restarted isolate picks its topics up where each subscription says: only new records, everything retained, or after its last commit. In a consumer group that has committed, it resumes after the commit.',
    ],
    link: 'How it works, part by part',
  },
  install: {
    heading: 'Install',
    platform: 'Isoloop runs in the browser.',
    // The freeze: isoloop/isoloop docs/plans/m4d-release.md at the pin, task 6
    // (declared with 0.1.0-next.9; from then on, a change to the published
    // types needs the maintainer's approval).
    label:
      'Isoloop isn’t at 0.1 yet. The API is frozen for 0.1. These are prereleases from the main branch, published under the next tag.',
    command:
      'pnpm add @isoloop/host@next @isoloop/runtime@next @isoloop/bus@next\npnpm add -D @isoloop/vite@next\n# for React or Preact isolates:\npnpm add @isoloop/react@next   # or @isoloop/preact@next\n# for automatic placement (experimental):\npnpm add @isoloop/balancer@next\n# for tools a browser agent can call (experimental):\npnpm add @isoloop/webmcp@next\n# for the devtools panel (experimental):\npnpm add @isoloop/devtools@next',
    guide: 'The hosting guide',
    /** The docs' first page (/docs/getting-started/), from an empty Vite app to a running isolate. */
    start: 'Getting started',
  },
};

export const featuresPage = {
  title: 'Features',
  /** <title> and the link preview only (ADR 0006, as amended). */
  searchTitle: 'Features: fault isolation, message bus and replay',
  description:
    'What Isoloop gives you, and what it costs: containment, restart and catch-up, the message bus, retention and replay, durable history, placement, automatic placement, tools for agents, devtools, your framework, safety, and the cost.',
  heading: 'What Isoloop gives you, and what it costs',
  notes: { label: 'The features, one note each, by group' },
  tabs: {
    label: 'Features, by group',
    /** The pager under each group (src/pages/steps.tsx, Pager). */
    previous: 'Previous',
    next: 'Next',
    pager: 'Previous and next',
    names: {
      isolation: 'Isolation',
      bus: 'Bus',
      placement: 'Placement',
      tools: 'Tools and frameworks',
      safety: 'Safety',
      cost: 'Cost',
    },
    /** The groups' anchors; a feature's own id is its section's, so these differ from every one. */
    ids: {
      isolation: 'isolation',
      bus: 'messaging',
      placement: 'pools',
      tools: 'tools',
      safety: 'security',
      cost: 'costs',
    },
  },
  containment: {
    caption:
      'A bar is work on that loop, and time moves to the left. Hatched means the loop is stuck. A line across a track means that isolate was stopped and started again. C and D share one loop; placement decides that. C and D read A’s count, so they tick when A does. When A is down they wait for its next record; their own work carries on.',
  },
  restart: {
    rows: { loop: 'Loop', reads: 'Reads' },
    stuck: 'stuck: no heartbeat',
    again: 'started again',
    key: {
      commit: 'its last commit',
      again: 'read before it got stuck, and read again',
      fresh: 'arrived while it was down, read after the restart',
    },
    caption:
      'A subscription from `committed`: it had read to 4139 and committed 4137 when it got stuck.',
  },
  bus: {
    topics: [
      ['count.v1', 'from A'],
      ['primes.v1', 'from C'],
      ['note.v1', 'from D'],
    ] as [string, string][],
    status: 'Records arrive on three topics. C reads count.v1; D reads all three.',
    rejected: 'rejected: invalid',
    caption:
      'Each box is a record and its offset in that topic. The tags under a topic show the last record each reader read there. A crossed-out box is a publish the bus rejected because it failed the schema: every 11 s D sends an empty note.',
  },
  replay: {
    tape: 'note.v1, as D reads it',
    crashD: 'Crash D',
    restartD: 'Restart D',
    status: {
      reading: 'D reads each note as it arrives.',
      crashed:
        'D crashed and was started again. It subscribes from earliest, so it reads the retained notes again.',
      again: (n: number): string =>
        `D read ${n} note${n === 1 ? '' : 's'} again, from the start of what note.v1 retains. None were lost.`,
      failed:
        'D crashed more than 3 times within a minute, so the kernel’s crash-loop guard stopped restarting it. Restart D to bring it back.',
    },
    caption:
      'Each cell is a note and its offset. Shaded cells are notes D had read before the crash and read again after it.',
  },
  durable: {
    head: ['Topic', 'Before the reload', 'After the reload'],
    caption:
      'Only one tab’s bus owns the files. In a second tab, or where the browser can’t open them (some private windows), persistent topics run in memory and the kernel emits `bus:durability_degraded`.',
  },
  placement: {
    layouts: [
      ['Own workers', '4 loops', [['A'], ['B'], ['C', 'hit'], ['D']]],
      ['As in basic', '3 loops', [['A'], ['B'], ['C and D', 'hit']]],
      ['One pool', '1 loop', [['A, B, C and D', 'hit']]],
    ] as [string, string, [string, string?][]][],
    caption:
      'The same four isolates in three placements. When C blocks, everything hatched stalls with it. In the plant dashboard a small headless isolate costs about 0.2 MB in a pool, against 2.8 MB on its own worker.',
    more: 'When to pool, with the plant’s figures',
  },
  // Source: isoloop/isoloop docs/guide/balancer.md, "Moving", "The quarantine"
  // and "Packing back", at the library pin; the defaults are its options'.
  balancer: {
    caption:
      'What moves an isolate, with the defaults. The balancer decides every 500 ms over the last 3 s, and moves an isolate for load at most 3 times in 5 minutes, with its quarantine, bisect and fold moves counted among the 3. Packing while a backlog holds steady, the busy time an app reports, and leaving alone an isolate the kernel gave up on are new in 0.1.0-next.1.',
    head: ['When', 'What the balancer does'],
    rows: <Row[]>[
      [
        'An isolate blocks its pool for over 100 ms twice within 60 s, or crashes',
        'Moves it to the quarantine pool until it has been quiet for 30 s, a window that doubles with each repeat offence, up to 2 minutes. One that has used its 3 moves stays until the oldest is 5 minutes old',
      ],
      [
        'A pool lags over 50 ms for 3 s, or its members use 80 % of a core or more',
        'Moves the heaviest member to a pool with room, or to a new one within the cap',
      ],
      [
        'A pool is killed for blocking and no heartbeat names the culprit',
        'Moves half its members to quarantine; whichever half blocks again holds the culprit',
      ],
      [
        'The backlog the app reports for an isolate grows over two 10 s windows in a row',
        'Gives the isolate a pool of its own if the cap allows, else a less loaded pool. A second quarantine pool folds into the first to free a worker for it',
      ],
      [
        'Every isolate in a pool stays steady for 60 s',
        'Moves them one at a time into another pool that stays under 40 % with all of them, freeing a worker',
      ],
      [
        'The kernel gives up on an isolate',
        'Marks it failed and leaves it alone until the app restarts it',
      ],
    ],
    guide: 'The balancer guide',
    example: 'Watch it move tasks in the processor example',
  },
  // Source: isoloop/isoloop docs/guide/agents.md, at the library pin.
  agents: {
    guide: 'The Agents guide',
    example: 'The markets dashboard’s two tools',
  },
  // Source: isoloop/isoloop docs/guide/devtools.md, at the library pin.
  devtools: {
    guide: 'The devtools guide',
    example: 'The plant dashboard with the panel open',
  },
  frameworks: {
    tabs: [
      ['react', 'React'],
      ['preact', 'Preact'],
      ['vanilla', 'Plain DOM'],
    ] as [string, string][],
  },
  safety: {
    facts: [
      [
        'Grants',
        'Each isolate lists the topics it may publish and subscribe to. Anything else is rejected with `forbidden`. Isolates in one pool share a worker and can reach each other’s ports, so treat a pool as holding all its members’ grants.',
      ],
      [
        'A sanitised DOM',
        'Every tag and attribute an isolate renders passes the host’s registry first. Unknown tags become `div`, script-capable tags and `on*` attributes are never created, and URLs are limited to http(s), mailto and relative ones.',
      ],
      [
        'No inline scripts',
        "The workers are same-origin module files, so a page can run Isoloop under `script-src 'self'`. A page that shows a surface needs `style-src 'self' 'unsafe-inline'`: the `style` attributes isolates render count as inline styles.",
      ],
    ] as [string, string][],
  },
  cost: {
    more: 'Every recorded run, per device and build',
  },
};

// Sources, at the library pin (apps/site/library.lock): DEFAULT_SUPERVISOR_CONFIG
// and DEFAULT_BACKOFF (packages/host/src/supervisor), KernelConfig and
// IsolateManifest (packages/host/src/kernel.ts), SubscribeOptions and
// BusClientOptions (packages/runtime/src/bus-client.ts), DEFAULT_COMMIT_INTERVAL_MS
// (packages/protocol/src/commits.ts); ADRs 0007 (the bus crash), 0008 (isolates
// and surfaces), 0010 and 0011 (the render bridge), 0015 (visual pools);
// docs/guide/pools.md (start positions, isoloop#186).
export const howItWorks = {
  title: 'How Isoloop works',
  description:
    'A walkthrough of the Isoloop runtime: the host and its isolates, workers and pools, the message bus, rendering from a worker, the supervisor, restarts and catch-up, persistence and bus crashes, and grants.',
  heading: 'How Isoloop works',
  intro: [
    'Your app’s host runs on the page’s main thread, and its parts run as isolates in workers. Isolates don’t call each other. They publish records to topics on a message bus, which runs in a worker of its own. A supervisor in the host watches every worker and restarts what fails.',
    'Each step below covers one part, with its code and the diagram drawn from the library’s code.',
  ],
  /** Under each step, as a footnote: where the diagrams come from, then the short sha. */
  pinned:
    'The diagrams are drawn from the library’s code, and a test there checks their states, timings and counts against it. These are from isoloop/isoloop at',
  overview: {
    heading: 'The parts at a glance',
    text: [
      'Four threads: the main thread, an isolate on a worker of its own, a pool of three, and the bus worker. The main thread runs your host code and the kernel it creates: the supervisor, the compositor that applies each isolate’s DOM changes, and the bus controller.',
    ],
  },
  open: 'Open full size',
  /** The steps in the rail: one short name per step, in order. */
  nav: {
    label: 'Steps',
    names: {
      overview: 'Overview',
      host: 'Host',
      placement: 'Pools',
      bus: 'Bus',
      render: 'Rendering',
      supervisor: 'Supervisor',
      restart: 'Restarts',
      busCrash: 'Persistence',
      safety: 'Safety',
    },
    previous: 'Previous',
    next: 'Next',
    pager: 'Previous and next',
  },
  /**
   * How to read each diagram, in words. Sources: each diagram's JSON at the pin
   * (its components, connections, messages and cards), which the library's
   * drift test checks against the code.
   */
  reading: {
    heading: 'Reading the diagram',
    parts: 'What’s in it',
    steps: 'Follow the arrows',
    diagrams: {
      'runtime-topology': {
        lead: 'Each large box is one thread. Cards inside a box are the pieces that run on that thread. Solid lines carry messages; dashed lines are heartbeats, and the import of an isolate’s module.',
        parts: [
          [
            'Main thread, along the top',
            'Your host app, which calls `createKernel`, and the kernel it creates. The supervisor, which starts workers and watches their heartbeats. The compositor, which applies isolates’ DOM changes to their surfaces once per animation frame. The bus controller, which hands out bus ports and supervises the bus worker. The host connection, the host’s own port for `kernel.subscribe`.',
          ],
          [
            'Own worker, middle left',
            'One isolate, with its own JavaScript realm and document. Isolate modules, left of it, are the files the worker imports.',
          ],
          [
            'Pool worker, middle right',
            'Three isolates on one thread: a headless member and two visual members, each with a root in one shared document.',
          ],
          [
            'Bus worker, along the bottom',
            'The broker, which checks grants, schemas and duplicates; the log engine, which encodes and stores records; and the topics’ logs.',
          ],
          [
            'Below the bus worker',
            'OPFS segments, the files persistent topics are written to. Only the tab holding the `isoloop-bus` Web Lock writes them.',
          ],
        ] as [string, string][],
        steps: [
          'Isolate code never runs on the main thread. The main thread only runs the kernel and applies patches.',
          'The host app calls `spawn`. The supervisor starts a worker and sends it `init`, one per member in a pool, and the worker imports the isolate’s module.',
          'A visual isolate sends patches, its DOM changes, to the compositor, which applies them to the isolate’s surface.',
          'Each isolate has a port of its own to the broker, one per member in a pool. Records never pass through the main thread.',
          'The broker appends what it accepts through the log engine; persistent topics also go to OPFS.',
          'The dashed lines back to the main thread are heartbeats: one per worker to the supervisor, and the bus worker’s beat and metrics to the bus controller.',
        ],
      },
      placement: {
        lead: 'The same three isolates, placed two ways. Each large box is one thread.',
        parts: [
          [
            'Left: own workers',
            'Isolates A and B (visual) and C (headless), each in a worker of its own: three threads.',
          ],
          [
            'Right: one pool',
            'The same three as members of the pool `charts`: one thread, one shared document with a root for each visual member.',
          ],
          [
            'Top and bottom',
            'The kernel, where the manifest’s `pool` decides the placement, and the bus worker.',
          ],
        ] as [string, string][],
        steps: [
          'On the left the kernel starts three workers and sends each one `init`; on the right, one worker and three `init`s.',
          'Either way the bus sees three ports. Grants, subscriptions and committed offsets stay per isolate, and so do the surface, the frame budget and the restart count.',
          'What the pool members share: one event loop and its timers, the globals, the document, and their fate when the worker fails.',
        ],
      },
      'bus-publish': {
        lead: 'One record, from left to right, through five columns: Produce, Gate, Order, Log and Consume. Red lines end in a rejection.',
        parts: [
          ['Produce', 'An isolate publishing on its own port, or the host with `kernel.publish`.'],
          [
            'Gate',
            'The grants and the size limit, then the schema. Topics under `isoloop.` belong to the kernel.',
          ],
          [
            'Order',
            'On a persistent topic, the duplicate check: each publish carries its producer, instance and sequence number, so a re-sent one gets its original offset. Anything that fails a gate goes to Rejected, and nothing is appended.',
          ],
          [
            'Log',
            'The log engine encodes the record, checks the storage quota and appends it. A persistent topic’s batch is written to OPFS first, then acknowledged; records evicted from memory are read back from disk.',
          ],
          [
            'Consume',
            'Subscribers, a consumer group (experimental in 0.1) whose members each get some of the records (by key), and the committed offsets.',
          ],
        ] as [string, string][],
        steps: [
          'The publisher sends the record; the gates check it in order.',
          'An accepted record gets an offset in the topic’s log, and the publisher gets its answer: the offset, or the error.',
          'The bus delivers it to each subscription in order, while the subscription has credit. Delivery is at least once.',
          'Each subscriber commits what its handlers finished, every 100 ms by default, which also returns credit.',
        ],
      },
      rendering: {
        lead: 'One visual isolate’s frame. The top row runs left to right, from the isolate’s code to the page; the rows below carry events and host calls back to the worker.',
        parts: [
          [
            'Isolate’s worker',
            'The isolate’s UI code, React, Preact or plain DOM, changes the worker’s `document`: the isoloop-dom subset. The recorder turns every change in one microtask into one batch. `ctx.host` and event dispatch live here too.',
          ],
          [
            'Compositor',
            'One queue per surface. Each animation frame it applies queued batches round-robin across surfaces while 8 ms of work lasts; the first batch of a frame always applies, and a batch is never split.',
          ],
          [
            'Applier + registry',
            'Writes each batch into the surface. Every tag, attribute and URL passes the registry first: unknown tags become `div`, and no script-capable tag or `on*` attribute is ever created.',
          ],
          [
            'Surface shadow root',
            'The `<iso-surface>` on the page. The kernel’s `styles` and the isolate’s `ctx.styles` are adopted here and don’t leak out.',
          ],
          [
            'EventBridge and Router',
            'Delegated listeners on the shadow root. An event goes back only if the isolate listens for it on the target or an ancestor; with routing on, same-origin link clicks go to the router.',
          ],
          [
            'Host calls',
            '`measure`, `focus`, `scrollIntoView` and `requestCanvas`, run in the compositor’s frame.',
          ],
        ] as [string, string][],
        steps: [
          'The isolate renders; the subset records the changes, and at the end of the microtask they leave as one `patch`, with any new stylesheets.',
          'The compositor queues the patch and applies it in the next frame that has budget for it; the applier sanitises and writes it.',
          'A click on the surface reaches the EventBridge, which sends the worker an event naming its target and the listeners on its path. The worker dispatches it with capture and bubble.',
          '`ctx.host.measure(node)` first sends what the recorder holds. The call runs after every batch sent before it, so it measures their layout. `requestCanvas` answers with an `OffscreenCanvas` instead.',
        ],
      },
      'isolate-lifecycle': {
        lead: 'The supervisor’s states for one isolate. The main path runs along the middle; failures branch off it.',
        parts: [
          [
            'The main path',
            'Restarting (a spawn queued, after the backoff), Loading (the worker started and sent `init`; ready within 10 s), Running (a heartbeat every 100 ms), Stopped (`kernel.stop`).',
          ],
          [
            'Blocked',
            'No heartbeat for 400 ms: the loop is busy but still alive, and a busy overlay covers its surface. A heartbeat brings it back to Running.',
          ],
          ['Crashed', 'Passed through on the way to a restart. It emits `isolate:crash`.'],
          [
            'Failed',
            'The restart limit was reached: the fallback shows and the host gets `isolate:failed`.',
          ],
          [
            'Suspended',
            'Opt-in: an idle isolate’s worker is shut down and its offsets are kept. It wakes back into Loading.',
          ],
        ] as [string, string][],
        steps: [
          'An isolate crashes from Running on a fatal error or a pool crash, from Blocked after 10 s without a heartbeat, and from Loading on a timeout or a version mismatch.',
          'Under 3 restarts within 60 s it goes back to Restarting, after a backoff that starts at 250 ms and doubles each time (at most 4 s). Past the limit it’s Failed.',
          'Some crashes go straight to Failed, because a restart can’t change them: a render format or version the host doesn’t speak, or a bus that couldn’t load its contracts.',
        ],
      },
      'restart-own-worker': {
        lead: 'A sequence: time runs down the page. The columns are isolate C’s old worker, the kernel, the bus worker and C’s new worker.',
        parts: [
          ['Crash', 'C’s old worker reports a fatal error, or fails.'],
          ['Respawn', 'After the backoff, a new worker for C.'],
          ['Replay and first paint', 'C reads its topics back and draws again.'],
        ] as [string, string][],
        steps: [
          'The kernel terminates the old worker and detaches C’s port from the bus. C’s committed offsets are kept: they belong to C, not to its worker.',
          'After the backoff, the kernel attaches a new port for C, then starts the new worker with it.',
          "The new C subscribes with `from: 'committed'`, and the bus delivers from the record after its last commit; up to one commit interval of what C had handled comes back.",
          'C reports ready, sends its first paint and commits again. Every other isolate kept running throughout.',
        ],
      },
      'restart-pool': {
        lead: 'A sequence in two parts, with time running down the page. The columns are the pool’s worker with members A, B and C, the kernel, the bus worker and a new pool worker.',
        parts: [
          ['Top part', 'A member’s own error: only B restarts.'],
          ['Bottom part', 'The worker fails: every member restarts.'],
        ] as [string, string][],
        steps: [
          'B reports a fatal error of its own. The kernel shuts B down alone; A and C keep the worker and keep running.',
          'After B’s backoff, the kernel gives B a new bus port and starts it again in the same worker. B subscribes from its own commits.',
          'Later, the worker stops sending heartbeats for 10 s, or fails. Every member crashes with that reason, and the kernel terminates the worker.',
          'The kernel gives all three members new bus ports, starts a new worker and sends each member its `init`. Each one reads on from its own commits.',
        ],
      },
      'bus-crash-reattach': {
        lead: 'A sequence in three parts, with time running down the page. The columns are an isolate, the kernel’s bus controller, the old bus worker, the new one, and OPFS.',
        parts: [
          ['The bus fails', 'The isolates keep running.'],
          ['New bus, ports moved at once', 'Each isolate gets a port to the new bus.'],
          ['Restore and resume', 'Persistent topics come back from OPFS.'],
        ] as [string, string][],
        steps: [
          'An isolate publishes and gets no answer: it keeps the publish. The old bus stops beating or fails, and the kernel terminates it.',
          'The kernel starts a new bus worker and attaches every isolate’s port to it at once; the new bus holds what arrives until it’s ready. Each isolate subscribes again and re-sends its unanswered publishes.',
          'The new bus takes the storage lock (waiting up to 2 s) and restores the persistent topics’ segments. Their subscriptions resume after the last commit; memory topics send a reset instead.',
          'The new bus reports ready, and suspended headless isolates wake. If the bus crashes twice while loading, it sets the newest segment aside and starts from the one before.',
        ],
      },
    },
  },
  sections: {
    host: {
      heading: 'The host and its isolates',
      text: [
        'The host is your page’s own code. It creates one kernel with `createKernel`, giving it the topics and the worker files that `@isoloop/vite` builds, and starts each isolate with `kernel.spawn`.',
        'Importing a module with `?isolate` gives its URL: `@isoloop/vite` builds it to run in a worker, so `src` is a URL, not code the host imports. The topics module goes in twice: as a URL, for the bus worker to import, and as a list the host reads.',
        'An isolate is a module whose default export is `defineIsolate(…)`: a `start(ctx)` function, or a React or Preact component through an adapter. The object passed to `spawn` is its manifest. It names the module, the element the isolate renders into (its surface) and its grants. An isolate with no surface is headless: it gets the same supervision and bus, and its `ctx.root` is `undefined`.',
        '`start` gets a context: `ctx.bus` for topics, `ctx.root` to render into, `ctx.host` for host calls (measure, focus, scroll, navigate), and `ctx.reportError` and `ctx.onShutdown`.',
      ],
      code: { label: 'A host and the isolate it spawns', host: 'main.ts', isolate: 'counter.ts' },
    },
    // Figures: isoloop/isoloop docs/guide/pools.md, "When to pool", from the
    // plant's matched comparison (apps/dashboards/plant/comparison/matched-v2).
    placement: {
      heading: 'Workers and pools',
      text: [
        'Each isolate runs in a worker: a thread of its own, with its own event loop. By default an isolate gets a worker to itself. With `pool` in its manifest, it shares one worker with every isolate that names the same pool.',
        'A pool saves memory. In the plant dashboard’s matched comparison, a small headless isolate cost about 0.2 MB in a pool, against 2.8 MB on its own worker; in return its members stall and restart together, as the next paragraph says. Measured with `@isoloop/*@0.0.0-next.d028bc1` in Chromium, on 4 physical cores fixed at 2.0 GHz, medians of 5 rounds, memory after GC 16 s after load.',
        'Members share an event loop. One that blocks stalls them all, and a worker error restarts them all; an error a member reports as its own restarts only that member (the Restarts step has the details). They also share one document, so they can read each other’s DOM and input, and they can reach each other’s bus ports, so a pool holds all its members’ grants. Pool only isolates you trust together, and keep widgets that handle secrets on their own worker.',
        'The kernel never pools on its own. Placement is the manifest’s choice, or that of the opt-in, experimental `@isoloop/balancer`, which moves isolates between pools as their load changes.',
      ],
      link: 'The pools guide: when to pool, with the plant’s figures',
      results: 'The plant’s matched comparison',
    },
    // Sources: topic() options (packages/bus/src/topic.ts: retention kinds,
    // `reply`, `durability`, the 256 KiB size limit), the broker's group
    // assignment (packages/bus/src/broker.ts: key hash, round-robin keyless),
    // SubscribeOptions and BusClientOptions (packages/runtime/src/bus-client.ts).
    bus: {
      heading: 'Topics, records and the bus',
      text: [
        "A topic is declared once, in a contracts module that the host, the bus and every isolate import; its default export, `contracts(…)`, is the list the host passes to `createKernel`. A topic has a name (with its major version, by convention, as in `count.v1`), a schema (from any Standard Schema library; zod here) and a retention: `{ kind: 'last-n', n }` keeps the last n records, `{ kind: 'time', ms }` the records younger than `ms`, and `{ kind: 'compacted' }` the latest record per key.",
        "By default a topic lives in the bus worker’s memory. `durability: 'persistent'` also writes it to disk, so it survives a reload and a bus crash (the Persistence step). A topic with a `reply` schema also takes requests, which are experimental in 0.1: `ctx.bus.request` publishes one and waits for the first valid reply, 30 s at most by default.",
      ],
      flow: [
        'Each isolate has a direct message channel to the bus worker, so the main thread isn’t on a record’s path.',
        'A publish is checked in order: the publisher’s grants and the record’s size (256 KiB by default), then the topic’s schema, and on a persistent topic a duplicate check. Then it’s appended to the topic’s log and gets an offset, and `publish` resolves; on a persistent topic, once the record is written to disk. A rejected one rejects with a `BusError`.',
        'A subscription starts where its `from` says: `latest` (the default) for new records only, `earliest` for everything the topic retains, or `committed` to read on after its last commit. It gets the topic’s records in offset order. Subscribers that name the same `group` share the topic: each record goes to one of them, by its key (round-robin when it has none), so each key’s records stay in order.',
        'The bus sends each subscription up to 1,000 records ahead of what it has handled. The subscriber commits each record once its handler settles; the commits go out every 100 ms by default, or sooner once half the credit is used. Delivery is at least once: after a crash, up to one commit interval of records can come again, so a handler must be safe to run twice.',
      ],
    },
    // Sources: ADRs 0010, 0011 and 0015 (the render bridge, pools' portal
    // roots); packages/host/src/events.ts (forwarded events, submit, links);
    // KernelConfig `styles`, `components`, `compositor` and IsolateContext
    // `styles`, `portalRoot`, `host` (requestCanvas) at the pin.
    render: {
      heading: 'Rendering from a worker',
      text: [
        'A worker has no DOM. A visual isolate gets a small DOM subset as its `document`, enough for React, Preact and plain DOM code to run unchanged. The subset records each change (insert, move, remove, text, attribute, listener) and sends the host one batch per microtask.',
        "On the host, the compositor applies each isolate’s batches to its surface, with a budget of 8 ms of DOM work per frame. Every tag, attribute and URL passes the host’s component registry first, so an isolate can’t create a script or an `on*` handler. The same registry lets isolates render the host’s own design-system elements by name: with `components: { 'iso-button': { tag: 'ds-button', attributes: ['variant'] } }`, an isolate’s `<iso-button>` becomes a `<ds-button>` on the page.",
        'Each surface is a shadow root, so the page’s stylesheets don’t reach it; inherited properties, such as the font, still do. The kernel’s `styles` are adopted into every surface, and an isolate adds its own with `ctx.styles(css)`. Modals, tooltips and menus that libraries render into `document.body` go into `ctx.portalRoot`, inside the isolate’s own surface.',
        'Input on a surface goes back to the worker as data, and is dispatched there with capture and bubble. Functions never cross the boundary. What needs the real page, the isolate asks the host for through host calls: `ctx.host.measure`, `focus` and `scrollIntoView` for a node, and `requestCanvas`, which hands the isolate an `OffscreenCanvas` to draw on from the worker, as charts do.',
      ],
      differs: {
        heading: 'What changes for your code',
        items: [
          'Layout reads are asynchronous: `await ctx.host.measure(node)` instead of `getBoundingClientRect()`.',
          'An isolate can’t call `preventDefault` in time. The host always prevents `submit`, and same-origin link clicks go to the router.',
          'Only these events reach the worker: click, dblclick, input, change, keydown, keyup, submit, focusin, focusout, pointerdown and pointerup; pointer moves, at most one per frame; and scroll, at most one per frame for each scrolled element. There’s no wheel or drag yet.',
        ],
      },
      code: 'The Host step’s counter, as a component',
    },
    // Sources: DEFAULT_SUPERVISOR_CONFIG, DEFAULT_BACKOFF, KernelConfig
    // `heartbeat` and `supervisor`, IsolateManifest `fallback`, Kernel `stop`
    // and `restart`, the worker's heartbeat timer (packages/runtime/src/bootstrap.ts).
    supervisor: {
      heading: 'The supervisor',
      text: [
        'Every worker sends a heartbeat, by default every 100 ms. The heartbeat is a timer in the worker’s own event loop, so any long task delays it; each beat also reports how late it was (`lagMs` on `isolate:beat`), which the balancer reads. With no heartbeat for 400 ms, the worker’s isolates count as blocked: busy, not dead, and a busy overlay covers their surfaces.',
        'With no heartbeat for 10 s, the worker is terminated and its isolates are restarted. The default is long on purpose, so a slow but working loop isn’t killed; apps shorten it with `heartbeat.killAfterMs` (the landing page’s demo uses 2 s).',
        "An isolate also crashes when its code throws a fatal error, when its worker fails, or when it isn’t ready within 10 s of its spawn. Restarts back off from 250 ms, doubling up to 4 s. After 3 restarts within 60 s, the next crash leaves it failed. A visual isolate then shows its fallback, by default a message and a Retry button, or what the manifest’s `fallback` draws, and the host gets `isolate:failed`; `kernel.restart` brings it back. `supervisor: { strategy: 'never' }` turns restarts off, for tests and debugging.",
        'A subscription handler that throws isn’t a crash. The isolate keeps running and reports `isolate:error`, and that subscription stops committing, so its records come back on the next start.',
        '`kernel.stop(id)` sends shutdown: the isolate’s `onShutdown` handlers get 1 s, its last commits go out, then its worker goes.',
      ],
    },
    // Sources: SubscribeOptions `from` and `group` (packages/runtime/src/bus-client.ts),
    // the compositor's `reset` on restart (packages/host/src/compositor.ts), ADR 0015
    // decision 8; the replay cost: isoloop/isoloop docs/guide/pools.md,
    // "When to pool", the `one` row.
    restart: {
      heading: 'Restarts and catch-up',
      text: [
        'Keep what must survive a restart in a topic: anything else in the isolate’s memory is lost. A restart is a new instance, and it rebuilds its state from the bus. Meanwhile its surface is blank, and it fills again on the new instance’s first paint.',
        'Each subscription starts where its `from` says, as on the first start. A subscription in a consumer group (experimental in 0.1) that has committed resumes after the group’s commit, whatever its `from`.',
      ],
      from: [
        '`latest`, the default: live values where only the newest matters, such as a ticker or a status.',
        '`earliest`: state rebuilt from what the topic retains, as the counter does.',
        '`committed`: work done once per record, such as jobs or alerts. It reads on after its last commit, so it sees again what it had read but not yet committed: the at-least-once delivery of the Bus step.',
      ],
      cost: 'With `earliest`, every restart replays everything the topic retains, and in a pool every member replays on the pool’s one thread. So the longer a topic’s retention, the longer such a restart takes to catch up, and the pools guide measured it growing over a long run. Keep retention to what a restart needs.',
      costLink: 'The pools guide, with the plant’s figures',
      pool: 'On its own worker, a crash restarts that isolate alone. In a pool, what restarts depends on who failed. An error the runtime can pin on one member restarts that member alone: `start()` throwing, an error the member reports with `ctx.reportError`, or a render error the React or Preact adapter catches (the adapters report it that way). A block, or a plain throw from an event handler, a timer or a scheduler the members share, is the worker’s error: the worker goes down, and every member restarts in a new one.',
    },
    // Sources: ADR 0007 (durability, group commit, reattach, dedup, safe mode),
    // KernelEvents `bus:*` and IsolateManifest `bus.onReset` (packages/host/src/kernel.ts),
    // SubscribeOptions `onReset`, the broker's `quota_exceeded`.
    busCrash: {
      heading: 'Persistence and bus crashes',
      text: [
        "A topic with `durability: 'persistent'` writes its records to the origin private file system (OPFS), batched every 5 ms or 256 records, so a persistent publish resolves a few milliseconds later than a memory one. After a page reload the new bus loads them from disk, and each subscription starts where its `from` says: `committed` reads on after its last commit, `earliest` from what the topic retains. A `memory` topic, the default, starts empty after a reload.",
        'Only one tab’s bus owns the files. In a second tab, or where the browser can’t open them (some private windows), persistent topics run in memory and the kernel emits `bus:durability_degraded`. When the origin’s storage is full, publishes reject with `quota_exceeded`; the kernel reports usage with `bus:quota`.',
      ],
      crash: {
        heading: 'When the bus crashes',
        text: [
          'The bus is supervised like an isolate, with the same heartbeat and restart limit. When it crashes, a new bus worker starts and every running isolate gets a new channel to it. The isolates keep running. What they publish meanwhile waits in each isolate, up to 1,000 unanswered calls, and goes out once the new bus is there.',
          "Persistent topics come back from disk: their subscriptions resume after their last commit, whatever their `from`, with no gap, and re-sent publishes aren’t stored twice. Memory topics are gone: their subscribers get a reset. `useTopic` empties and refills, a plain `ctx.bus.subscribe` gets its `onReset` callback, and an isolate that can’t handle a reset can ask to be restarted instead, with `bus: { onReset: 'restart' }` in its manifest.",
          'If the bus crashes twice while loading, a persisted record is the likely cause. The new bus sets the newest segment of each persistent topic aside (renamed, not deleted), starts from the one before, and the kernel emits `bus:recovered` with what it set aside. After 3 bus restarts within 60 s, the kernel emits `bus:failed`: isolates keep running, and every publish rejects with `bus_unavailable`. A contracts module that fails to load fails the bus with a code, and every isolate with it, with no retry.',
        ],
      },
      code: {
        label: 'A persistent topic and a subscriber',
        topics: 'topics.ts',
        isolate: 'alarms.ts',
      },
    },
    // Sources: isoloop/isoloop README ("Hostile code") and system design §
    // security (same origin, trusted-but-unreliable, the iframe tier);
    // matchTopic (packages/protocol/src/grants.ts); ADR 0010 (isTrusted);
    // ADR 0001 amendment (frozen built-ins in pools).
    safety: {
      heading: 'Grants and safety',
      threat:
        'Isolates run on your origin, so they share its cookies and storage: an isolate can `fetch` with the origin’s cookies and read its IndexedDB. Isoloop contains unreliable code (a widget that hangs, throws or leaks), not hostile code. For code you don’t trust at all, use a cross-origin iframe.',
      text: [
        'Grants are checked by the bus, on every publish and subscription. A grant is a topic name or a pattern: `*` matches one or more characters, dots included, so `machine.3.*` covers `machine.3.temp.v1`; without `*` the match is exact. Topics under `isoloop.` belong to the kernel. An isolate also needs `navigate: true` to call `ctx.host.navigate`; plain link clicks need no grant, since the host’s router handles them.',
        'Events reach the worker with `isTrusted: false`, so code that checks it must not treat forwarded input as the user’s. A pool freezes the built-ins before its first member loads, so one member can’t patch `Array.prototype` under the others; its members still share a document and can reach each other’s ports.',
      ],
      link: 'Safety, on the features page',
    },
  },
};

export const examplesPage = {
  title: 'Examples',
  /** <title> and the link preview only (ADR 0006, as amended). */
  searchTitle: 'Live examples: dashboards, workers and pools',
  description:
    'Isoloop examples: Basic, the plant and markets dashboards, and the processor. Each one runs live, with what it shows, what to try, and its measured results.',
  heading: 'Examples',
  intro:
    'Each example runs live in your browser on the published @isoloop packages. The dashboards come as native builds and Isoloop builds of the same code, so you can compare them side by side.',
  nav: { label: 'Examples', previous: 'Previous', next: 'Next', pager: 'Previous and next' },
  links: { live: 'Open live', source: 'Source', results: 'Results', architecture: 'Architecture' },
  shows: 'What it shows',
  try: 'What to try',
  measurements: 'Measurements',
  findings: 'Findings',
  inProgress: 'Work in progress',
  more: 'The full results, with the method',
  shot: 'a screenshot',
  /**
   * The Pages gap, under the intro (ADR 0002, decision 8, amended 2026-11-21).
   * Source: the built site (only the site's own pages carry the meta CSP) and
   * isoloop()'s header on every `vite preview` response (@isoloop/vite).
   */
  policy: {
    before:
      'On this host the examples run without the security policy: GitHub Pages can’t send headers. In the tests and the comparison runs they run under it, and ',
    link: 'the hosting guide',
    after: ' covers a real deployment.',
  },
  support: 'They need Safari 16.4 or later, or a recent Chrome, Edge or Firefox.',
};

export const changelogPage = {
  title: 'Changelog',
  description:
    'What changed in the Isoloop packages and in the site and its examples, release by release.',
  heading: 'Changelog',
  lede: 'What changed, release by release. The library’s packages share one version; the site and each example have their own. Every entry is the one written with the change.',
  library: {
    heading: 'The library',
    unreleased:
      'No library version has been released with a changelog yet. The packages are published as prereleases under the next tag, and the first versioned one appears here when it ships.',
    packages: 'The packages:',
  },
  apps: {
    heading: 'The site and examples',
    unreleased: 'Earlier releases of these are listed by their tags on GitHub:',
    tags: 'release tags',
  },
};

/** /docs/ and each docs page (src/pages/doc.tsx). The guides' own text comes from the library. */
export const docsPage = {
  title: 'Docs',
  description:
    'How to build with Isoloop: getting started, the guides for each part, and the reference.',
  heading: 'Docs',
  lede: 'How to build with Isoloop, section by section.',
  docs: 'Docs',
  nav: 'Docs',
  onThisPage: 'On this page',
  previous: 'Previous',
  next: 'Next',
  /** The code blocks' button once it has copied (src/demos/copy.ts); "Copy" is in the markup (build/docs/render.ts). */
  copied: 'Copied',
  /**
   * The docs for agents, on /docs/ (build/docs/llms.ts writes /llms.txt, the
   * llmstxt.org index; /llms-full.txt, every guide in nav order; and each
   * page's /docs/<slug>.md, the guide as fetched at the pin).
   */
  agents: {
    lead: 'For AI agents: these docs as plain text,',
    index: 'llms.txt',
    indexNote: '(an index),',
    full: 'llms-full.txt',
    fullNote: '(everything) and each page as Markdown.',
  },
  /** On a guide or an API page, its own Markdown copy (/docs/<slug>.md). */
  markdown: 'View as Markdown',
  /** The search at the top of the docs' sidebar (src/demos/search.ts, /docs/search.json). */
  search: {
    label: 'Search the docs',
    placeholder: 'Search docs',
    results: 'Search results',
    /** Followed by the query in quotes. */
    empty: 'No results for',
    /** The key that focuses it, shown beside it. */
    key: '/',
  },
};

export const notFound = {
  title: 'Not found',
  description: 'This page doesn’t exist.',
  heading: 'This page doesn’t exist',
  text: 'It may have moved. Try one of these:',
};

/** Status marks next to a name (src/pages/pill.tsx). */
export const marks = {
  experimental: 'Experimental',
};
