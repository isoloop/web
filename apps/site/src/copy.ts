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
    'Event-loop isolation for web apps. Each part of your app runs on its own worker or in a shared pool, talks through a message bus that keeps its records, and is restarted when it fails. React, Preact or plain DOM.',
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

/** A use: the lead, its sentence, and optionally a link to the figures behind it. */
type Use = [lead: string, text: string, link?: { text: string; href: string }];

export const home = {
  title: 'Isoloop: event-loop isolation for web apps',
  intro: {
    heading: 'Event-loop isolation for web apps',
    text: 'Each part of your app runs on its own worker or in a shared pool, talks through a message bus that keeps its records, and is restarted when it fails. React, Preact or plain DOM.',
    primary: 'See the features',
    secondary: 'Examples',
  },
  try: 'Try it. Four isolates on three event loops: A and B have a worker each, C and D share a pool. Block or crash one, or block the main thread, and watch what keeps running. This is basic, the smallest example, running in this page on Isoloop. C and D read A’s count, so they tick when A does. When A is down they wait for its next record; their own work carries on.',
  uses: {
    heading: 'What it’s for',
    items: [
      [
        'Live dashboards and data-heavy UIs.',
        'Many widgets on fast data, and one slow widget doesn’t freeze the rest.',
      ],
      [
        'Apps built from many teams’ parts.',
        'Isolates built and deployed apart, with a version floor so an old host or an old isolate says so instead of breaking. On the markets dashboard, when one team’s part blocks for 3 s, the other team’s widgets keep 91–98% of their updates with a pool per team, against none on a native build that loads the part at run time; a crashed part is back in 1.3–1.8 s, for 61 KB more JavaScript and 34–49 MB more memory.',
        {
          text: 'The measurements',
          href: 'https://github.com/isoloop/web/tree/main/apps/dashboards/markets/comparison/federated',
        },
      ],
      [
        'Third-party or less-trusted widgets.',
        'Each isolate gets only the grants you give it, and its DOM is sanitised on the way to the page.',
      ],
      [
        'Backend-less apps.',
        'Headless pipelines over public APIs, all in the visitor’s tab, served from a static host.',
      ],
      [
        'Heavy work next to a UI.',
        'Parsing, search or simulation off the main thread, restarted if it hangs.',
      ],
    ] as Use[],
  },
  strip: { heading: 'Features', all: 'All features, with live demos' },
  gives: {
    heading: 'What it gives',
    // Source: apps/dashboards/plant/README.md, "What each build does when
    // something goes wrong" (comparison/final/, Chromium, 1 kHz).
    caption:
      'The plant dashboard: 72 widgets on 8 machines, built three ways from the same code and data. One widget blocks for 3 s. Chromium at 1 kHz on the desktop machine, measured at plant-v0.1.0, November 2026.',
    head: ['', 'Native', 'Native + workers', 'Isoloop (matched, the default)'],
    rows: <Row[]>[
      [
        'What stalls while the widget blocks',
        'The whole page',
        'The whole page',
        'The 72 widgets in its pool; the data pools keep running',
      ],
      ['Data lost during the block', '3.8 s on every machine', 'None', 'None'],
      ['Until every widget updates again', '3.2 s', '3.1 s', '2.9 s'],
      [
        'After the block',
        'The page carries on; nothing restarts',
        'The page carries on; nothing restarts',
        'The pool restarts and catches up from the retained topics',
      ],
      [
        'A widget throws while rendering',
        'It shows “crashed” until a reload',
        'The same; a data worker that errors restarts with an empty store',
        'The isolate is restarted',
      ],
      [
        'Alarms and events across a reload',
        'localStorage, written at most once a second',
        'The same',
        'Persistent topics in OPFS: every acknowledged record',
      ],
    ],
    more: 'Every build and placement, with sources',
  },
  costs: {
    heading: 'What it costs, and where it helps',
    // Sources: apps/dashboards/plant/README.md ("Responsiveness" and "What it
    // costs"); comparison/final/ (desktop, at plant-v0.1.0);
    // comparison/phone/ikko-mindone-focus156/ and galaxy-fold6-chrome157/
    // (at plant-v0.1.0-rc.3); comparison/phone/iphone-x-safari16/ (at
    // plant-v0.1.0-rc.5). All on @isoloop/*@0.0.0-next.b8ffdcf.
    caption:
      'The plant dashboard, Isoloop (one and matched) against native (alone and with workers). Measured at plant-v0.1.0, November 2026; the phones on its release candidates, with the same Isoloop packages.',
    head: ['Device', 'What was measured', 'What it costs'],
    rows: <Row[]>[
      [
        'Desktop machine, 4 cores fixed at 2.0 GHz',
        'At 1 kHz every build keeps up in Chromium. At 5 kHz the main thread is 23–27% busy against 79–84%, and the median keystroke takes 21–41 ms against 62–82 ms. Firefox drops 0–1 frames of about 600 against 89–126.',
        '+7 to +19 points of CPU across all threads, +36 to +51 MB after garbage collection, and +0.2 to +0.3 s to first data.',
      ],
      [
        'Mid-range Android phone (MediaTek MT8781V, Firefox Focus 156)',
        'One and matched draw 68–84 frames/s against 45–56, with a median keystroke of 15–23 ms against 32–64 ms. Split, with 18 workers on 8 cores, is the slowest build here.',
        'First data after 1.2–2.0 s, against 0.4–0.9 s.',
      ],
      [
        'Flagship Android phone (Snapdragon 8 Gen 3, Chrome 157)',
        'No difference. Every build holds 60 frames/s, with a median keystroke of 9–13 ms.',
        'The extra CPU and memory, for no difference in responsiveness.',
      ],
      [
        'Older iPhone (iPhone X, Safari 16.6)',
        'Native does as well or better. At 5 kHz native holds 60 frames/s, one 59.5, matched 51.9 and split 11.1: the more workers, the lower.',
        'A known limitation. The cause isn’t established yet.',
      ],
    ],
    more: 'Every recorded run, with the method',
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
    text: 'The host runs on the main thread, each isolate on its own worker or in a pool, and the bus in a worker between them. Seven diagrams are drawn from the code and checked against it.',
    link: 'All seven diagrams',
  },
  examples: {
    heading: 'Examples',
    all: 'All examples',
  },
  install: {
    heading: 'Install',
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
