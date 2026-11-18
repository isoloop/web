// /how-it-works/, "Workers and pools": one isolate on a worker of its own, two in a pool.
import type { Kernel } from '@isoloop/host';

declare const kernel: Kernel;
declare const surfaces: Record<'a' | 'c' | 'd', Element>;
declare const counterUrl: string;
declare const primesUrl: string;
declare const messagesUrl: string;

// #region show
// No `pool`: a worker of its own.
kernel.spawn({ id: 'a', src: counterUrl, surface: surfaces.a });

// The same `pool`: one worker, one event loop, for both.
kernel.spawn({ id: 'c', src: primesUrl, surface: surfaces.c, pool: 'shared' });
kernel.spawn({ id: 'd', src: messagesUrl, surface: surfaces.d, pool: 'shared' });
// #endregion
