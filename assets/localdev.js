/* ==========================================================================
   Local-dev helper: clean links on servers that don't support them
   --------------------------------------------------------------------------
   The site links to /board, /about, /member?id=... (no ".html"). Real hosts
   and `npm run dev` understand that. VS Code's Live Server does not, so
   clicking a link there gives "Cannot GET /board".

   This file checks (only on localhost / a LAN address) whether /about
   loads. If it doesn't, it quietly rewrites every internal link to its
   .html twin so the whole site still works — including links the pages
   create later, like "View bio" on the board. On a real host, or on
   `npm run dev`, it does nothing.

   Note: it can only fix links you click. Typing /board into the address
   bar under Live Server still can't work; use `npm run dev` for that.
   ========================================================================== */
(function () {
  var h = location.hostname;
  var local =
    h === 'localhost' || h === '127.0.0.1' || h === '[::1]' ||
    /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (!local || location.protocol === 'file:') return;

  function fix(a) {
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) !== '/' || raw.charAt(1) === '/') return;
    var u;
    try { u = new URL(raw, location.origin); } catch (e) { return; }
    var p = u.pathname;
    if (p === '/' || p.slice(-1) === '/' || /\.[a-z0-9]+$/i.test(p)) return;
    a.setAttribute('href', p + '.html' + u.search + u.hash);
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches('a[href^="/"]')) fix(root);
    if (root.querySelectorAll) root.querySelectorAll('a[href^="/"]').forEach(fix);
  }

  function enable() {
    scan(document.documentElement);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(scan); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  fetch('/about', { method: 'HEAD', cache: 'no-store' })
    .then(function (res) { if (res.status === 404) enable(); })
    .catch(function () { /* offline or blocked — leave links alone */ });
})();
