// The exchanges and symbols, as plain constants: no Zod, so the native +
// workers build's workers, which import these but no schema, don't carry it.
// `schemas.ts` re-exports them.
export const EXCHANGES = ['coinbase', 'kraken', 'bitstamp', 'okx'] as const;
/** Every symbol the replay can synthesize (M3c decision 5: 20 at Normal and Heavy). */
export const SYMBOLS = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'XRP-USD',
  'ADA-USD',
  'DOGE-USD',
  'AVAX-USD',
  'DOT-USD',
  'LINK-USD',
  'LTC-USD',
  'BCH-USD',
  'UNI-USD',
  'ATOM-USD',
  'XLM-USD',
  'NEAR-USD',
  'APT-USD',
  'ARB-USD',
  'OP-USD',
  'FIL-USD',
  'AAVE-USD',
] as const;
/** The symbols the live feeds subscribe to, and the replay's first `n` at Lite. */
export const LIVE_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD'] as const;
