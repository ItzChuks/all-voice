(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function renderBoard() {
    const grid = document.getElementById('board-grid');
    if (!grid || !window.AVSStore) return;
    const members = await AVSStore.getBoard();
    if (members.length === 0) {
      grid.innerHTML = '<p class="text-muted">Board member profiles will appear here soon.</p>';
      return;
    }
    const grads = ['135deg,#1E7BFF,#29B6F6', '135deg,#29B6F6,#1E7BFF', '135deg,#0B0E13,#1E7BFF', '135deg,#1E7BFF,#0B0E13', '135deg,#29B6F6,#0B0E13', '135deg,#1E7BFF,#29B6F6'];
    grid.innerHTML = members
      .map((m, i) => {
        const avatar = m.photo
          ? `<img src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.name)}" class="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full object-cover shrink-0 ring-4 ring-white shadow-xl" />`
          : `<div class="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full flex items-center justify-center font-display font-bold text-2xl sm:text-3xl text-white shrink-0 ring-4 ring-white shadow-xl" style="background:linear-gradient(${grads[i % grads.length]});">${escapeHtml(AVSStore.initials(m.name))}</div>`;
        const preview = m.bio ? escapeHtml(AVSStore.previewText(m.bio, 130)) : 'Full biography coming soon.';
        return `
        <div class="tilt-card bg-alt rounded-2xl p-6 sm:p-8 border border-line flex flex-col items-center text-center">
          ${avatar}
          <div class="mt-5 flex flex-col items-center flex-1">
            <h3 class="font-display font-semibold text-lg">${escapeHtml(m.name)}</h3>
            <p class="text-cyan text-sm mb-2">${escapeHtml(m.role || '')}</p>
            <p class="text-muted text-sm mb-5">${preview}</p>
            <a href="/member?id=${encodeURIComponent(m.id)}" class="btn btn-dark-ghost px-5 py-2 rounded-full text-sm mt-auto">View bio</a>
          </div>
        </div>`;
      })
      .join('');
  }

  renderBoard();
})();
