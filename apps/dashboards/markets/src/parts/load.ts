// The host's side (M3g decision 4): find a part in `parts/parts-manifest.json`,
// check the manifest with zod, load the part's CSS and its module by URL.
import { z } from 'zod';
import type { PartModule, PartsManifest } from './contract';

const Manifest = z.object({
  parts: z.record(z.string(), z.object({ entry: z.string(), css: z.array(z.string()).optional() })),
});

/** The manifest's parts, or a ZodError naming what's wrong with it. */
export const parseManifest = (m: unknown): PartsManifest['parts'] => Manifest.parse(m).parts;

const base = (): URL => new URL('./parts/', location.href);

let manifest: Promise<PartsManifest['parts']> | undefined;

function parts(): Promise<PartsManifest['parts']> {
  manifest ??= fetch(new URL('parts-manifest.json', base()))
    .then((r) => {
      if (!r.ok) throw new Error(`parts manifest: HTTP ${r.status}`);
      return r.json();
    })
    .then(parseManifest);
  return manifest;
}

function stylesheet(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/** The part `name`, loaded at run time from its own build. */
export async function loadPart(name: string): Promise<PartModule> {
  const entry = (await parts())[name];
  if (!entry) throw new Error(`no part "${name}" in the manifest`);
  for (const css of entry.css ?? []) stylesheet(new URL(css, base()).href);
  const mod: unknown = await import(/* @vite-ignore */ new URL(entry.entry, base()).href);
  const mount: unknown =
    typeof mod === 'object' && mod !== null ? Reflect.get(mod, 'mount') : undefined;
  if (typeof mount !== 'function') throw new Error(`part "${name}" exports no mount`);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checked to be a function above; its signature is the contract
  return { mount: mount as PartModule['mount'] };
}
