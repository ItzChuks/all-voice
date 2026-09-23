(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const loading = document.getElementById('member-loading');
    const notfound = document.getElementById('member-notfound');
    const content = document.getElementById('member-content');

    if (!id || !window.AVSStore) {
      loading.classList.add('hidden');
      notfound.classList.remove('hidden');
      return;
    }

    let member;
    try {
      member = await AVSStore.getBoardMember(id);
    } catch (err) {
      loading.classList.add('hidden');
      notfound.querySelector('p.font-display').textContent = "Couldn't load this profile";
      const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      notfound.querySelector('p.text-muted').textContent = isLocal
        ? (err && err.message ? err.message : 'Network error') +
          ' — open the site at http://localhost (not 127.0.0.1) and make sure "localhost" is added as a Web platform in Appwrite.'
        : 'Something went wrong while loading this page. Please try again in a moment.';
      notfound.classList.remove('hidden');
      return;
    }
    loading.classList.add('hidden');

    if (!member) {
      notfound.classList.remove('hidden');
      return;
    }

    document.title = `${member.name} | All Voices Society`;
    document.getElementById('member-name').textContent = member.name;
    document.getElementById('member-role').textContent = member.role || '';

    const avatarWrap = document.getElementById('member-avatar-wrap');
    avatarWrap.innerHTML = member.photo
      ? `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}" class="w-32 h-32 sm:w-full sm:h-auto sm:aspect-square rounded-full object-cover mx-auto sm:mx-0 ring-4 ring-white shadow-xl" />`
      : `<div class="w-32 h-32 sm:w-full sm:h-auto sm:aspect-square rounded-full flex items-center justify-center font-display font-bold text-3xl text-white mx-auto sm:mx-0 ring-4 ring-white shadow-xl" style="background:linear-gradient(135deg,#1E7BFF,#29B6F6);">${escapeHtml(AVSStore.initials(member.name))}</div>`;

    // Keeps the admin's paragraphs, line breaks and indentation (see AVSStore.formatRichText).
    const bioEl = document.getElementById('member-bio');
    bioEl.innerHTML = AVSStore.formatRichText(member.bio) || `<p class="text-muted">Full biography coming soon.</p>`;

    content.classList.remove('hidden');
  }

  init();
})();
