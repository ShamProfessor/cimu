#!/usr/bin/env node
import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, normalize, resolve} from 'node:path';

function option(name, fallback) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; }
const port = Number(option('port', '4173'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be an integer from 1 to 65535.');

const skillRoot = resolve(new URL('..', import.meta.url).pathname);
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml'};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relative = pathname === '/' ? 'assets/timeline-editor.html' : pathname.replace(/^\/+/, '');
  const file = resolve(skillRoot, normalize(relative));
  if (!file.startsWith(`${skillRoot}/`) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, {'Content-Type':mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store'});
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => console.log(`Lyric timeline editor → http://127.0.0.1:${port}/`));
