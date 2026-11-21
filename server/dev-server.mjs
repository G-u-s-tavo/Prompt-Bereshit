import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml'
};

http.createServer((req, res) => {
  if (!['GET','HEAD'].includes(req.method || '')) { res.writeHead(405, { Allow:'GET, HEAD' }).end('Method not allowed'); return; }
  let decoded;
  try { decoded = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const requested = decoded === '/' ? '/index.html' : decoded;
  const target = path.resolve(root, `.${requested}`);
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const info = statSync(target);
    if (!info.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type':types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length':info.size,
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'Cache-Control':'no-store'
    });
    if (req.method === 'HEAD') res.end(); else createReadStream(target).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => {
  console.log(`Prompt-Bereshit dev server: http://127.0.0.1:${port}`);
  console.log('Servidor local de desenvolvimento. Não utilizar como backend de produção.');
});
