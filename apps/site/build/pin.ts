// The pin is a published version (ADR 0006; isoloop/isoloop M4c, decision 3):
// every package the library publishes at the pin is on npm at the version the
// pin gives it, and npm's provenance says it was built from the pin itself.
// So the site never describes an API that the published packages don't have.
// Until 0.1 that commit is a `chore: version 0.1.0-next.N` PR's squash commit;
// from 0.1 on, the commit a `v*` tag points at.
//
// The lookups are injected, so the decision is tested without the network;
// scripts/check-pin.ts gives it npm's registry.
import { z } from 'zod';
import type { LibraryReader } from './library.ts';

/** A package the library publishes, as its package.json at the pin says. */
export interface PinnedPackage {
  name: string;
  version: string;
}

/** What npm knows about one published version. */
export interface Registry {
  /** Is `name@version` on npm? */
  exists(name: string, version: string): Promise<boolean>;
  /**
   * The commit npm's provenance attestation says the version was built from,
   * or undefined when it has no provenance.
   */
  gitCommit(name: string, version: string): Promise<string | undefined>;
}

const PackageJson = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  private: z.boolean().optional(),
});

/** The packages under `packages/*` at the pin that aren't private. */
export function pinnedPackages(lib: LibraryReader): PinnedPackage[] {
  const out: PinnedPackage[] = [];
  for (const path of lib.list('packages')) {
    if (!/^packages\/[^/]+\/package\.json$/.test(path)) continue;
    const pkg = PackageJson.parse(JSON.parse(lib.read(path) ?? '{}'));
    if (pkg.private || !pkg.name || !pkg.version) continue;
    out.push({ name: pkg.name, version: pkg.version });
  }
  return out.toSorted((a, b) => a.name.localeCompare(b.name));
}

type Finding = { problem: string } | { commit: string | undefined };

/**
 * The problems with `pin` as a published version, empty when there are none.
 * Each package must be on npm at its version. Every provenance commit found
 * must be the pin, and at least one must be found, so a pin on any other
 * commit of main fails even when its versions happen to be published.
 */
export async function checkPublished(
  pin: string,
  packages: readonly PinnedPackage[],
  registry: Registry,
): Promise<string[]> {
  if (packages.length === 0) return [`no published packages under packages/* at ${pin}`];
  const findings = await Promise.all(
    packages.map(async ({ name, version }): Promise<Finding> => {
      if (!(await registry.exists(name, version))) {
        return { problem: `${name}@${version} isn't on npm` };
      }
      const commit = await registry.gitCommit(name, version);
      if (commit !== undefined && commit !== pin) {
        return {
          problem: `${name}@${version} was published from ${commit.slice(0, 7)}, not the pin`,
        };
      }
      return { commit };
    }),
  );
  const problems = findings.flatMap((f) => ('problem' in f ? [f.problem] : []));
  const attested = findings.some((f) => 'commit' in f && f.commit !== undefined);
  if (!attested && problems.length === 0) {
    problems.push(`no package at ${pin.slice(0, 7)} has npm provenance naming its commit`);
  }
  return problems;
}

/** The part of `fetch` the registry uses. */
export type Fetch = (url: string) => Promise<Response>;

/** A scoped name as the registry's URLs take it. */
const enc = (name: string): string => name.replace('/', '%2f');

/** The npm registry over `fetch`. */
export function npmRegistry(
  fetchFn: Fetch = (url) => fetch(url),
  base = 'https://registry.npmjs.org',
): Registry {
  return {
    async exists(name, version) {
      const res = await fetchFn(`${base}/${enc(name)}/${encodeURIComponent(version)}`);
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`npm: ${name}@${version}: HTTP ${res.status}`);
      return true;
    },
    async gitCommit(name, version) {
      const res = await fetchFn(`${base}/-/npm/v1/attestations/${enc(name)}@${version}`);
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`npm attestations: ${name}@${version}: HTTP ${res.status}`);
      return provenanceCommit(await res.json());
    },
  };
}

const Attestations = z.object({
  attestations: z.array(
    z.object({
      bundle: z.object({ dsseEnvelope: z.object({ payload: z.string() }).optional() }).optional(),
    }),
  ),
});

const Statement = z.object({
  predicate: z.object({
    buildDefinition: z.object({
      resolvedDependencies: z.array(
        z.object({ digest: z.object({ gitCommit: z.string().optional() }).optional() }),
      ),
    }),
  }),
});

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The `gitCommit` in an attestations response's SLSA provenance, if any. */
export function provenanceCommit(body: unknown): string | undefined {
  const list = Attestations.safeParse(body);
  if (!list.success) return undefined;
  for (const a of list.data.attestations) {
    const payload = a.bundle?.dsseEnvelope?.payload;
    if (payload === undefined) continue;
    const statement = Statement.safeParse(
      parseJson(Buffer.from(payload, 'base64').toString('utf8')),
    );
    if (!statement.success) continue;
    for (const d of statement.data.predicate.buildDefinition.resolvedDependencies) {
      const commit = d.digest?.gitCommit;
      if (commit !== undefined && /^[0-9a-f]{40}$/.test(commit)) return commit;
    }
  }
  return undefined;
}
