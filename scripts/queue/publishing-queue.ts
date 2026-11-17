// The Publishing queue workflow (isoloop/web ADR 0004, decision 7): scans the
// PRs merged in isoloop/isoloop and isoloop/web since the ADR, and keeps one
// issue in isoloop/web listing those whose Site impact is "update needed".
// Runs on the runner's Node with the workflow's GITHUB_TOKEN: reading public
// repos and writing this repo's issues and labels need nothing more.
import { appendFileSync } from 'node:fs';
import {
  MARKER,
  TITLE,
  mergeQueue,
  parseQueue,
  renderQueue,
  type MergedPr,
} from './queue-model.ts';

/** The ADR's date: earlier work is covered by the catch-up (ADR 0004, step 8). */
export const SINCE = '2026-11-17';
const HOME = 'isoloop/web';
const SOURCES = ['isoloop/isoloop', 'isoloop/web'];
const LABEL = 'site-impact';

const token = process.env['GITHUB_TOKEN'] ?? '';
const dryRun = process.env['QUEUE_DRY_RUN'] === '1';

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;
  return fetch(url, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
}

async function json(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await api(path, init);
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const str = (o: unknown, k: string): string => {
  const v: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined;
  return typeof v === 'string' ? v : '';
};
const num = (o: unknown, k: string): number => {
  const v: unknown = typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined;
  return typeof v === 'number' ? v : 0;
};
const obj = (o: unknown, k: string): unknown =>
  typeof o === 'object' && o !== null ? Reflect.get(o, k) : undefined;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);

/** PRs merged since `since`, newest updates first; stops once updates predate it. */
export async function mergedSince(repo: string, since: string): Promise<MergedPr[]> {
  const out: MergedPr[] = [];
  for (let page = 1; page <= 20; page++) {
    const prs = list(
      // Pages in order: each one decides whether the scan has passed SINCE.
      // oxlint-disable-next-line no-await-in-loop
      await json(
        `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
      ),
    );
    for (const pr of prs) {
      const mergedAt = str(pr, 'merged_at');
      if (mergedAt && mergedAt >= since) {
        out.push({
          repo,
          number: num(pr, 'number'),
          title: str(pr, 'title'),
          mergedAt,
          author: str(obj(pr, 'user'), 'login'),
          body: str(pr, 'body'),
        });
      }
    }
    const last = prs.at(-1);
    if (prs.length < 100 || (last !== undefined && str(last, 'updated_at') < since)) break;
  }
  return out;
}

/** The open queue issue, found by its marker; `undefined` before the first run. */
async function findIssue(): Promise<{ number: number; body: string; nodeId: string } | undefined> {
  for (let page = 1; page <= 10; page++) {
    // Pages in order, stopping at the first one that holds the queue.
    // oxlint-disable-next-line no-await-in-loop
    const issues = list(await json(`/repos/${HOME}/issues?state=open&per_page=100&page=${page}`));
    for (const issue of issues) {
      if (obj(issue, 'pull_request') !== undefined) continue;
      const body = str(issue, 'body');
      if (body.includes(MARKER)) {
        return { number: num(issue, 'number'), body, nodeId: str(issue, 'node_id') };
      }
    }
    if (issues.length < 100) break;
  }
  return undefined;
}

/** Pins the issue; GITHUB_TOKEN may lack the right, which only costs a note. */
async function pin(nodeId: string): Promise<boolean> {
  const res = await api('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: 'mutation($id: ID!) { pinIssue(input: { issueId: $id }) { issue { number } } }',
      variables: { id: nodeId },
    }),
  });
  if (!res.ok) return false;
  const body: unknown = await res.json();
  return obj(body, 'errors') === undefined;
}

/** Labels this repo's open-queue PRs; library PRs can't be labelled from here. */
async function label(numbers: number[]): Promise<number> {
  if (!numbers.length) return 0;
  const existing = await api(`/repos/${HOME}/labels/${LABEL}`);
  if (existing.status === 404) {
    await json(`/repos/${HOME}/labels`, {
      method: 'POST',
      body: JSON.stringify({
        name: LABEL,
        color: 'a62f68',
        description: 'Site impact: update needed (ADR 0004)',
      }),
    });
  }
  const results = await Promise.all(
    numbers.map((n) =>
      api(`/repos/${HOME}/issues/${n}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels: [LABEL] }),
      }),
    ),
  );
  return results.filter((res) => res.ok).length;
}

function summary(text: string): void {
  const file = process.env['GITHUB_STEP_SUMMARY'];
  if (file) appendFileSync(file, `${text}\n`);
}

async function main(): Promise<void> {
  const scanned = (await Promise.all(SOURCES.map((r) => mergedSince(r, SINCE)))).flat();
  const issue = await findIssue();
  const items = mergeQueue(parseQueue(issue?.body ?? ''), scanned);
  const open = items.filter((i) => !i.done);
  const footer = [
    `The \`${LABEL}\` label is added to open items from \`${HOME}\`. The workflow's token can't label PRs in \`isoloop/isoloop\`, so library items are listed here only.`,
  ];
  const body = renderQueue(items, { since: SINCE, footer });
  console.log(
    `scanned ${scanned.length} merged PRs; ${open.length} open, ${items.length - open.length} done`,
  );
  if (dryRun) {
    console.log(body);
    return;
  }
  let number = issue?.number;
  let pinned = true;
  if (!issue) {
    const created = await json(`/repos/${HOME}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title: TITLE, body }),
    });
    number = num(created, 'number');
    pinned = await pin(str(created, 'node_id'));
  } else if (issue.body !== body) {
    await json(`/repos/${HOME}/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
  }
  const labelled = await label(open.filter((i) => i.repo === HOME).map((i) => i.number));
  summary(
    `**Publishing queue** #${number}: ${open.length} open, ${items.length - open.length} done; ${labelled} PRs labelled \`${LABEL}\`.${pinned ? '' : ' The issue could not be pinned with this token: pin it by hand.'}`,
  );
  if (!pinned)
    console.log('The queue issue could not be pinned with GITHUB_TOKEN; pin it by hand.');
}

if (import.meta.main) {
  await main();
}
