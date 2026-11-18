/// <reference types="vite/client" />
/// <reference types="@isoloop/vite/client" />

interface ImportMetaEnv {
  /** Which of the seven builds this is (vite.config.ts). */
  readonly MARKETS_BUILD:
    | 'isoloop'
    | 'native'
    | 'native-workers'
    | 'native-mixed'
    | 'isoloop-preact'
    | 'native-preact'
    | 'mixed';
  /** The dev MCP's token (`ISOLOOP_MCP_TOKEN`, M4a); dev only. Without it the page doesn't pair. */
  readonly VITE_ISOLOOP_MCP_TOKEN?: string;
  /** The CLI's WebSocket when not the default `ws://127.0.0.1:4317` (`isoloop mcp --port`); dev only. */
  readonly VITE_ISOLOOP_MCP_URL?: string;
}
