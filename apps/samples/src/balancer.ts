import type { Kernel } from '@isoloop/host';
import { createBalancer } from '@isoloop/balancer';

declare const kernel: Kernel;
declare const chartEl: Element;
declare const taskUrl: string;
declare const chartUrl: string;

// #region show
const balancer = createBalancer(kernel, { maxWorkers: 4 });

balancer.spawn({ id: 'task-1', src: taskUrl }); // no `pool`: the balancer picks one
balancer.spawn({ id: 'chart-1', src: chartUrl, surface: chartEl });
balancer.on('move', (e) => console.log(`${e.id}: ${e.from} → ${e.to} (${e.reason})`));
// #endregion
