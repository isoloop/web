import { contracts, topic } from '@isoloop/bus';
import { createKernel } from '@isoloop/host';
import { connectWebMCP } from '@isoloop/webmcp';
import workers from 'virtual:isoloop/workers';
import { z } from 'zod';

declare const contractsUrl: string;

// #region show
// contracts.ts: a requestable topic (it has a `reply`) that agents may call
export const quote = topic('markets.quote.v1', {
  schema: z.object({ symbol: z.string() }),
  reply: z.object({ vwap: z.number().nullable(), volume: z.number() }),
  retention: { kind: 'last-n', n: 100 },
  tool: {
    description: 'The latest VWAP and volume for one symbol.',
    readOnly: true,
  },
});

// main.ts: the kernel lists which topics agents may call
const kernel = createKernel({
  contracts: { url: contractsUrl, list: contracts(quote) },
  workers,
  agents: { expose: ['markets.quote.v1'] },
});
connectWebMCP(kernel); // a browser agent, where the browser has WebMCP
// in development, `npx isoloop mcp` serves the same tools to a coding agent
// #endregion
