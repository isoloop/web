// Serves the three builds on three origins: the host on 5180 with the CSP as a
// header (a worker gets its policy from its own response, not the page's meta),
// the remotes on 5181 and 5182 with CORS.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const here = import.meta.dirname;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
const remotes = 'http://localhost:5181 http://localhost:5182 http://localhost:5183';
const csp =
  process.env.CSP === 'off'
    ? null
    : `default-src 'self'; worker-src 'self'${process.env.WORKER_SRC_REMOTES ? ' ' + remotes : ''}; script-src 'self' ${remotes}; connect-src 'self' ${remotes}; style-src 'self'`;
const sites = [
  [5180, 'host/dist', true],
  [5181, 'remote-vite/dist', false],
  [5183, 'cross', false],
  [5182, 'remote-rsbuild/dist', false],
];
export const log = [];
for (const [port, dir, isHost] of sites) {
  createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    let file = join(here, dir, path === '/' ? 'index.html' : path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' };
    if (isHost && csp) headers['content-security-policy'] = csp;
    if (!isHost) headers['access-control-allow-origin'] = '*';
    if (process.env.COI) {
      if (isHost) Object.assign(headers, { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' });
      else headers['cross-origin-resource-policy'] = 'cross-origin';
    }
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
    if (process.env.LOG) console.log(port, path, size);
  }).listen(port);
}
console.log('serving 5180 5181 5182', csp ? 'with CSP' : 'without CSP');
