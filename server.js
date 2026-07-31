/* Servidor estático mínimo para desenvolvimento local.
   Uso: node server.js   →   http://localhost:5180                */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 5180;
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
                '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml',
                '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png',
                '.woff2':'font/woff2', '.mp4':'video/mp4', '.json':'application/json' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('NÚCLEO em http://localhost:' + PORT));
