/* Shared on every public page: marks the current page in the header. */
(function () {
  /* Highlight the link for the page you're on */
  var path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var section = { '/member': '/board', '/event': '/events', '/story': '/stories', '/episode': '/podcasts', '/podcast': '/podcasts' }[path] || path;
  document.querySelectorAll('#site-nav a.nav-link, #mobile-menu a.m-link').forEach(function (a) {
    var href = (a.getAttribute('href') || '').replace(/\.html$/, '').replace(/\/+$/, '');
    if (href && href === section) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
  });

})();
