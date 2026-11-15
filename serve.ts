// Serves game/ for local play (Node 22, standard library only): `node serve.ts [--port 8080]`.
// Static files with the MIME types a module game needs; paths outside game/ are refused.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const flag = process.argv.indexOf('--port');
const port = flag > 0 ? Number(process.argv[flag + 1]) || 8080 : 8080;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer((req, res) => {
  let path = '/';
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, normalize(path)));
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const size = statSync(file).size;
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-length': size, 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`SALTGLASS on http://localhost:${port}`));
