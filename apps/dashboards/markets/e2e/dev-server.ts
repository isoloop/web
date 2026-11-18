// The development server the dev MCP suite uses (dev-mcp.spec.ts): the dev
// MCP is in development builds only, so this one runs `vite` itself with the
// pairing token, beside the preview the other suites use.
export const DEV_PORT = 4788;
export const DEV_URL = `http://localhost:${DEV_PORT}/`;
/** The CLI's WebSocket port, away from the default 4317 a developer may have open. */
export const DEV_MCP_PORT = 4817;
export const DEV_MCP = { token: 'markets-e2e-dev-mcp-token-0123' };
