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
    'Event-loop isolation for JavaScript apps. An open-source TypeScript library that lets you run the parts of your app in isolated workers, connected by a message bus and kept running by a supervisor. Framework-agnostic, with React and Preact adapters.',
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
      `${id} crashed 3 times within a minute, so the kernel’s crash-loop guard stopped restarting it. It stays down until it’s restarted.`,
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
    text: 'An open-source TypeScript library that lets you run the parts of your app in isolated workers, connected by a message bus and kept running by a supervisor. Framework-agnostic, with React and Preact adapters.',
    primary: 'See the features',
    secondary: 'Examples',
  },
  try: 'Try it. Four isolates on three event loops: A and B have a worker each, C and D share a pool. Block or crash one, or block the main thread, and watch what keeps running. This is basic, the smallest example, running in this page on Isoloop. C and D read A’s count, so they tick when A does. When A is down they wait for its next record; their own work carries on.',
  uses: {
    heading: 'What it’s for',
    // Patterns, not examples (2026-11-18): the core promise first, then from
    // the broadest need to the narrowest. Figures live on the examples.
    items: <Use[]>[
      ['Keeping one part’s load from stalling the rest.', 'live dashboards on heavy datasets'],
      ['Moving heavy work off the UI’s thread.', 'parsing, search, simulation'],
      ['Keeping state through a crash or a reload.', 'alarms, event logs, drafts'],
      ['Running code you don’t fully trust.', 'third-party widgets, plugins'],
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
    // something goes wrong", and e2e/placements.spec.ts. Behaviour only: the
    // figures are in the costs table below.
    caption:
      'The plant dashboard: 72 widgets on 8 machines, built three ways from the same code and data. What each build does when something goes wrong, at plant-v0.1.0.',
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
    // Source: apps/dashboards/plant/comparison/final/responsiveness/summary.md,
    // Chromium 5 kHz, at plant-v0.1.0 (@isoloop/*@0.0.0-next.b8ffdcf). Δ is the
    // median of the per-round gaps, so it isn't always B − A of the medians.
    // Phones: comparison/phone/ikko-mindone-focus156/, galaxy-fold6-chrome157/,
    // iphone-x-safari16/.
    caption:
      'The plant dashboard on the desktop machine (4 cores fixed at 2.0 GHz), Chromium at 5 kHz, 5 interleaved rounds, measured at plant-v0.1.0, November 2026. Each native build is measured against the Isoloop placement shaped like it.',
    pairs: [
      { a: 'Native', b: 'Isoloop one', label: 'Native against Isoloop one (one pool)' },
      {
        a: 'Native + workers',
        b: 'Isoloop matched',
        label: 'Native + workers against Isoloop matched (the default)',
      },
    ],
    delta: 'Δ',
    groups: <DeltaGroup[]>[
      {
        heading: 'Responsiveness',
        rows: [
          {
            label: 'Main thread busy',
            cells: [
              ['84%', '23%', ['−60 pts', 'better']],
              ['79%', '27%', ['−53 pts', 'better']],
            ],
          },
          {
            label: 'Typing, median',
            cells: [
              ['82 ms', '21 ms', ['−55 ms', 'better']],
              ['62 ms', '41 ms', ['−28 ms', 'better']],
            ],
          },
        ],
      },
      {
        heading: 'Faults and start-up',
        rows: [
          {
            label: 'Data lost on the other machines during a 3 s block',
            cells: [
              ['3.0 s', '2.6 s', ['−0.5 s', 'better']],
              ['0 s', '0 s', ['0', 'same']],
            ],
          },
          {
            label: 'Back to normal after the block',
            cells: [
              ['3.2 s', '3.5 s', ['+0.3 s', 'worse']],
              ['3.2 s', '2.9 s', ['−0.2 s', 'better']],
            ],
          },
          {
            label: 'All 72 widgets with data',
            cells: [
              ['1.2 s', '2.4 s', ['+1.2 s', 'worse']],
              ['2.3 s', '1.5 s', ['−0.7 s', 'better']],
            ],
          },
          {
            label: 'First data',
            cells: [
              ['0.29 s', '0.47 s', ['+0.19 s', 'worse']],
              ['0.35 s', '0.68 s', ['+0.29 s', 'worse']],
            ],
          },
        ],
      },
      {
        heading: 'Cost',
        rows: [
          {
            label: 'CPU, all threads',
            cells: [
              ['95%', '107%', ['+11 pts', 'worse']],
              ['97%', '116%', ['+19 pts', 'worse']],
            ],
          },
          {
            label: 'Memory after GC, at 16 s',
            cells: [
              ['164 MB', '203 MB', ['+40 MB', 'worse']],
              ['222 MB', '275 MB', ['+51 MB', 'worse']],
            ],
          },
          {
            label: 'Workers',
            cells: [
              ['0', '1 + bus'],
              ['9', '10 + bus'],
            ],
          },
        ],
      },
    ],
    verdicts: { better: 'better', worse: 'worse', same: 'no change' } as Record<Verdict, string>,
    notes: [
      'Δ is the median of the gaps measured in each round, so it can differ from the difference of the two medians.',
      'The native builds keep their data in a small store written for this app, with no message bus. They don’t contain a blocked widget, restart a crashed one, replay data to it, check grants or schemas, or keep acknowledged history. The extra CPU and memory pay for those features.',
      'On a faster machine the main-thread differences shrink. Phones vary: a mid-range Android phone gains the most, a flagship shows no difference, and an older iPhone draws fewer frames with Isoloop.',
    ],
    more: 'Every recorded run, on every device, with the method',
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
  },
  how: {
    heading: 'How it works',
    // Sources: isoloop/isoloop docs/diagrams (runtime topology, restarts),
    // ADR 0015 (pools), docs/guide/pools.md (start positions, isoloop#186).
    text: [
      'Your app’s host runs on the page’s main thread. Each isolate runs in a worker, either one of its own or a pool it shares with others.',
      'Isolates don’t call each other. They publish records to topics and subscribe to them, through a message bus that runs in a worker of its own and keeps each topic’s records for as long as its retention says.',
      'A supervisor watches every worker’s heartbeat. When an isolate’s own code fails, it alone is restarted. When a worker stops responding, or fails in a way no single isolate can be blamed for, the worker is replaced with every isolate in it. A restarted isolate picks its topics up where each subscription says: only new records, everything retained, or after its last commit. In a consumer group that has committed, it resumes after the commit.',
    ],
    link: 'How it works, in seven diagrams drawn from the code',
  },
  install: {
    heading: 'Install',
    platform: 'Isoloop runs in the browser.',
    label:
      'Isoloop isn’t at 0.1 yet, and the API may change. These are prereleases from the main branch, published under the next tag.',
    command:
      'pnpm add @isoloop/host@next @isoloop/runtime@next @isoloop/bus@next\npnpm add -D @isoloop/vite@next\n# for React or Preact isolates:\npnpm add @isoloop/react@next   # or @isoloop/preact@next\n# for automatic placement (experimental):\npnpm add @isoloop/balancer@next',
    guide: 'The hosting guide',
  },
};

export const featuresPage = {
  title: 'Features',
  description:
    'What Isoloop gives you, and what it costs: containment, restart and catch-up, the message bus, retention and replay, durable history, placement, automatic placement, your framework, safety, and the cost.',
  heading: 'What Isoloop gives you, and what it costs',
  lede: 'Code that shares data shouldn’t share an event loop. That idea runs through ten parts of one toolchain. Three run live below, on basic, the smallest example, running in this page; the rest are shown as code or as a still.',
  changelog: 'What changed, release by release',
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
        'D crashed 3 times within a minute, so the kernel’s crash-loop guard stopped restarting it. Restart D to bring it back.',
    },
    caption:
      'Each cell is a note and its offset. Shaded cells are notes D had read before the crash and read again after it.',
  },
  durable: {
    head: ['Topic', 'Before the reload', 'After the reload'],
    caption:
      'Only one tab’s bus owns the files. In a second tab, or where the browser can’t open them (some private windows), persistent topics run in memory and the kernel emits `bus:durability-degraded`.',
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
      'What moves an isolate, with the defaults. The balancer decides every 500 ms over the last 3 s, and moves an isolate for load at most 3 times in 5 minutes. Packing while a backlog holds steady, the busy time an app reports, and leaving alone an isolate the kernel gave up on are new in 0.1.0-next.1.',
    head: ['When', 'What the balancer does'],
    rows: <Row[]>[
      [
        'An isolate blocks its pool for over 100 ms twice within 60 s, or crashes',
        'Moves it to the quarantine pool until it has been quiet for 30 s, a window that doubles with each repeat offence, up to 2 minutes',
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
        'The backlog the app reports for an isolate grows over 10 s',
        'Gives the isolate a pool of its own if the cap allows, else a less loaded pool',
      ],
      [
        'An isolate alone in its pool stays steady for 60 s',
        'Packs it into another pool that stays under 40 % with it, freeing a worker',
      ],
      [
        'The kernel gives up on an isolate',
        'Marks it failed and leaves it alone until the app restarts it',
      ],
    ],
    guide: 'The balancer guide',
    example: 'Watch it move tasks in the processor example',
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
        'No inline code',
        "The workers are same-origin module files and stylesheets are adopted, so a page can run Isoloop under `script-src 'self'` with no `'unsafe-inline'`.",
      ],
    ] as [string, string][],
  },
  cost: {
    more: 'The full results, per device and build',
  },
};

export const howItWorks = {
  title: 'How Isoloop works',
  description:
    'Seven diagrams of the Isoloop runtime, drawn from the code: the topology, placement, a publish through the bus, the isolate lifecycle, restarts, and a bus crash.',
  heading: 'How Isoloop works',
  intro:
    'Each diagram is drawn from the library’s code, and a test in the library checks its states, timings and counts against that code. Each one opens full size, with the source files it cites.',
  pinned: 'Drawn from isoloop/isoloop at',
  open: 'Open full size',
  /** One paragraph per diagram, in reading order. */
  diagrams: {
    'runtime-topology':
      'The host runs on the main thread: the supervisor, the compositor that applies each isolate’s DOM changes, and the bus controller. Each isolate runs on its own worker or in a pool, and the bus has a worker of its own. Isolates and the bus talk over direct message channels, not through the main thread.',
    placement:
      'The same isolates, each on its own worker or together in one pool. A pool saves memory and start-up time. Its members share an event loop, so they also share a fate.',
    'bus-publish':
      'One record through the bus. It passes the publisher’s grants and a size limit, its topic’s schema and a duplicate check, then goes into the log. A persistent record is acknowledged once it’s flushed to OPFS. Subscribers get it within their credit and commit their offsets, every 100 ms by default.',
    'isolate-lifecycle':
      'The supervisor’s states, with the default timings. An isolate with no heartbeat for 400 ms counts as blocked, and after 10 s it’s stopped and restarted. Restarts back off, up to 3 within 60 s; a crash after that leaves it failed.',
    'restart-own-worker':
      'An isolate on its own worker crashes and a new worker starts. Each subscription starts where its `from` says; the diagram shows `committed`, which reads on after the last commit, so the isolate sees again what it had read but not committed.',
    'restart-pool':
      'In a pool, a member’s own error restarts that member alone. A pool worker that stops responding, or throws from a timer, takes every member down, and the pool restarts in a new worker.',
    'bus-crash-reattach':
      'The bus worker crashes. A new one starts, every isolate reattaches, and persistent topics come back from OPFS.',
  } as Record<string, string>,
  policy: {
    heading: 'These pages and their security policy',
    text: "Every page on this site, the diagrams included, runs under the Content-Security-Policy default-src 'self'. GitHub Pages can’t send headers, so here the policy is a meta tag, and a meta tag doesn’t reach workers: basic’s workers run without a policy on this host. In a real deployment the policy goes in the response headers, which cover the workers too.",
    link: 'The hosting guide',
  },
};

export const examplesPage = {
  // Shown where an example has no measured result yet (its example.json `note`).
  title: 'Examples',
  description:
    'Isoloop examples: basic, the processor, and the plant and markets dashboards. Each one runs live, with its measured results.',
  heading: 'Examples',
  intro:
    'Each example runs live in your browser on the published @isoloop packages. The dashboards come as a native build and an Isoloop build of the same code, so you can compare them side by side.',
  measuredAt: 'measured at',
  links: { live: 'Open live', source: 'Source', results: 'Results', architecture: 'Architecture' },
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

export const notFound = {
  title: 'Not found',
  description: 'This page doesn’t exist.',
  heading: 'This page doesn’t exist',
  text: 'It may have moved. Try one of these:',
};
