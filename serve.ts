// A tiny static server for game/ (Node 22, standard library only), so the
// game can be played locally without a build step: `node serve.ts` serves
// game/ on http://localhost:8080. Development convenience only.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const port = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = resolve(join(root, normalize(path).replace(/^(\.\.(\/|\\|$))+/, '')));
  if (!file.startsWith(root + sep) && file !== root) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  const target = file === root ? join(root, 'index.html') : file;
  let stat;
  try {
    stat = statSync(target);
  } catch {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  if (!stat.isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
  createReadStream(target).pipe(response);
}).listen(port, () => console.log(`Neon Bay Nights at http://localhost:${port}`));
