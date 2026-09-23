// Local dev server for All Voices Society.
//
//   npm run dev        (or Ctrl+Shift+B in VS Code — see .vscode/tasks.json)
//   -> http://localhost:5500
//
// What it does:
//   * Clean URLs, same as your live host: /board, /about, /member?id=...
//     all work with no ".html". Typing /about.html redirects to /about.
//   * Live reload: save a file in VS Code and open tabs refresh themselves.
//   * Custom 404 page (404.html) with a real 404 status.
//   * If port 5500 is busy (e.g. Live Server is running), it uses the next free one.
//
// Options:  PORT=3000 node dev-server.js     --open  (opens your browser)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const START_PORT = Number(process.env.PORT) || 5500;
const MAX_PORT_TRIES = 15;
const OPEN_BROWSER = process.argv.includes('--open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

/* ---------- live reload (polling, so there is no connection limit) ---------- */
let version = Date.now();
let bumpTimer = null;
function bump() {
  clearTimeout(bumpTimer);
  bumpTimer = setTimeout(() => { version = Date.now(); }, 120);
}
try {
  fs.watch(ROOT, { recursive: true }, (_evt, name) => {
    if (name && /(^|[\\/])(node_modules|\.git|\.vscode)([\\/]|$)/.test(name)) return;
    bump();
  });
} catch (e) {
  console.log('(live reload disabled — this Node/OS does not support recursive fs.watch)');
}
const RELOAD_SNIPPET =
  '<script>(function(){var v=null,down=false;function tick(){fetch("/__v",{cache:"no-store"})' +
  '.then(function(r){return r.text()}).then(function(t){if(down){location.reload();return}' +
  'if(v===null)v=t;else if(t!==v)location.reload()}).catch(function(){down=true})}' +
  'setInterval(tick,900);tick()})();</script>';

/* ---------- helpers ---------- */
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}
function safeJoin(urlPath) {
  const full = path.normalize(path.join(ROOT, urlPath));
  return full === ROOT || full.startsWith(ROOT + path.sep) ? full : null;
}
function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}
function sendFile(req, res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };

  if (ext === '.html') {
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) { res.writeHead(500); return res.end('Could not read file'); }
      const out = /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, RELOAD_SNIPPET + '</body>')
        : html + RELOAD_SNIPPET;
      headers['Content-Length'] = Buffer.byteLength(out);
      res.writeHead(status, headers);
      res.end(req.method === 'HEAD' ? undefined : out);
    });
    return;
  }

  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).on('error', () => res.end()).pipe(res);
}

/* ---------- server ---------- */
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  const [rawPath, query] = req.url.split('?');
  const search = query ? '?' + query : '';

  if (rawPath === '/__v') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    return res.end(String(version));
  }

  let urlPath;
  try { urlPath = decodeURIComponent(rawPath); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (urlPath.includes('\0')) { res.writeHead(400); return res.end('Bad request'); }

  // /index.html -> /   and   /about.html -> /about   (like Vercel's cleanUrls)
  if (/\.html$/i.test(urlPath) && urlPath !== '/404.html') {
    const target = safeJoin(urlPath);
    if (target && isFile(target)) {
      const clean = urlPath.replace(/\.html$/i, '').replace(/\/index$/i, '') || '/';
      return redirect(res, clean + search);
    }
  }

  // /board/ -> /board  (relative asset paths break under a trailing slash)
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    const stripped = urlPath.replace(/\/+$/, '');
    const t = safeJoin(stripped + '.html');
    if (t && isFile(t)) return redirect(res, stripped + search);
  }

  const base = safeJoin(urlPath);
  if (!base) { res.writeHead(403); return res.end('Forbidden'); }

  const candidates = [
    base,                                   // exact file: css, js, images...
    base + '.html',                         // clean URL: /board -> board.html
    path.join(base, 'index.html'),          // "/" and folders
  ];
  for (const c of candidates) {
    if (isFile(c)) return sendFile(req, res, 200, c);
  }

  const notFound = path.join(ROOT, '404.html');
  if (isFile(notFound)) return sendFile(req, res, 404, notFound);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

function listen(port, attempt) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_TRIES) {
      console.log(`Port ${port} is busy, trying ${port + 1}…`);
      return listen(port + 1, attempt + 1);
    }
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n  All Voices Society dev server\n  ${url}\n`);
    console.log('  Use "localhost" (not 127.0.0.1) — Appwrite only allows the hostnames you registered as Web platforms.\n');
    if (OPEN_BROWSER) {
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd);
    }
  });
}
listen(START_PORT, 0);
