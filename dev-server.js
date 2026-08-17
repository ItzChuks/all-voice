// Local dev server that mimics the clean-URL behavior your live host
// (Netlify/Vercel/.htaccess) will apply — so you can test /board, /about,
// etc. locally, exactly as they'll work once deployed.
//
// Usage:
//   node dev-server.js
// Then open http://localhost:5500

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 5500;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function send(res, status, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(status, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  // 1. Exact file exists (css, js, images, or someone typed the .html directly)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return send(res, 200, filePath);
  }

  // 2. Clean URL -> try appending .html (mirrors _redirects / vercel.json / .htaccess)
  const withHtml = filePath + '.html';
  if (fs.existsSync(withHtml)) {
    return send(res, 200, withHtml);
  }

  // 3. Nothing matched -> custom 404
  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) {
    return send(res, 404, notFound);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
});
