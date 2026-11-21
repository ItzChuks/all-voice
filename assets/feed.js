/* ==========================================================================
   All Voices Society — social feed components
   --------------------------------------------------------------------------
   Renders events, stories and podcast episodes as social-style posts:
   author header with relative time, swipeable photo carousels, inline video,
   Like (saved on this device), Share (native share sheet / copy link).

   Needs assets/store.js first. Usage:
     el.innerHTML = list.map((ev) => AVSFeed.eventPost(ev)).join('');
     AVSFeed.hydrate(el);   // wires carousels, likes, share, video play
   ========================================================================== */
(function () {
  const LOGO = 'assets/img/logo.png';
  const AUTHOR = 'All Voices Society';
  const HANDLE = '@allvoicessociety';
  const GRADS = ['150deg,#1E7BFF,#0B0E13', '150deg,#29B6F6,#0B0E13', '150deg,#1E7BFF,#29B6F6', '150deg,#0B0E13,#1E7BFF'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const I = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>',
  };

  /* ---- time ---- */
  function parseDate(v) {
    if (!v) return null;
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d) ? null : d;
  }
  function timeAgo(v) {
    const d = parseDate(v);
    if (!d) return '';
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'Just now';
    const m = s / 60, h = m / 60, day = h / 24;
    if (m < 60) return Math.floor(m) + 'm ago';
    if (h < 24) return Math.floor(h) + 'h ago';
    if (day < 7) return Math.floor(day) + 'd ago';
    if (day < 30) return Math.floor(day / 7) + 'w ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  /* ---- likes & saves (this device only — no fake public counts) ---- */
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } },
    set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} },
    has(key, id) { return store.get(key).indexOf(id) !== -1; },
    toggle(key, id) {
      const list = store.get(key);
      const i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      store.set(key, list);
      return i === -1;
    },
  };

  /* ---- toast ---- */
  function toast(msg) {
    let host = document.getElementById('feed-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'feed-toast';
      host.setAttribute('role', 'status');
      document.body.appendChild(host);
    }
    host.textContent = msg;
    host.classList.add('show');
    clearTimeout(host._t);
    host._t = setTimeout(() => host.classList.remove('show'), 2200);
  }

  const absUrl = (path) => new URL(path, location.origin).href;

  /* ---- building blocks ---- */
  function head(kind, createdAt, opts) {
    opts = opts || {};
    const when = timeAgo(createdAt);
    return `
      <header class="post-head">
        <span class="post-avatar${opts.avatar ? ' photo' : ''}"><img src="${esc(opts.avatar || LOGO)}" alt="" /></span>
        <div class="min-w-0 flex-1">
          <p class="post-author">${esc(opts.author || AUTHOR)}</p>
          <p class="post-meta">${esc(kind)}${when ? ` <span aria-hidden="true">·</span> <time datetime="${esc(createdAt)}">${esc(when)}</time>` : ''}</p>
        </div>
        <button type="button" class="post-icon-btn" data-copy="${esc(opts.url || '')}" aria-label="Copy link">${I.more}</button>
      </header>`;
  }

  function actions(id, url, title, cta) {
    const liked = store.has('avs_likes', id);
    const saved = store.has('avs_saved', id);
    return `
      <div class="post-actions">
        <button type="button" class="post-act like${liked ? ' on' : ''}" data-like="${esc(id)}" aria-pressed="${liked}" aria-label="Like">${I.heart}</button>
        <button type="button" class="post-act" data-share="${esc(url)}" data-title="${esc(title)}" aria-label="Share">${I.share}</button>
        <button type="button" class="post-act" data-copy="${esc(url)}" aria-label="Copy link">${I.link}</button>
        <span class="flex-1"></span>
        ${cta ? `<a href="${esc(cta.href)}" class="post-cta">${esc(cta.label)} ${I.arrow}</a>` : ''}
        <button type="button" class="post-act save${saved ? ' on' : ''}" data-save="${esc(id)}" aria-pressed="${saved}" aria-label="Save">${I.save}</button>
      </div>`;
  }

  function caption(title, text, max) {
    const plain = String(text || '').trim();
    const limit = max || 180;
    const long = plain.length > limit;
    const short = long ? plain.slice(0, limit).replace(/\s+\S*$/, '') + '…' : plain;
    return `
      <div class="post-body">
        <h3 class="post-title">${esc(title)}</h3>
        ${plain ? `<p class="post-text" data-full="${esc(plain)}">${esc(short)}${long ? ' <button type="button" class="post-more-text">more</button>' : ''}</p>` : ''}
      </div>`;
  }

  function carousel(images, idx, overlay) {
    if (!images.length) return '';
    const slides = images.map((src, i) => `<div class="car-slide"><img src="${esc(src)}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}" /></div>`).join('');
    const multi = images.length > 1;
    return `
      <div class="post-media car" data-car style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
        <div class="car-track">${slides}</div>
        ${overlay || ''}
        ${multi ? `
          <span class="car-count">1/${images.length}</span>
          <button type="button" class="car-btn prev" aria-label="Previous photo" hidden>${I.prev}</button>
          <button type="button" class="car-btn next" aria-label="Next photo">${I.next}</button>
          <div class="car-dots">${images.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      </div>`;
  }

  function dateChip(date) {
    return date ? `<span class="post-chip">${I.cal}<span>${esc(date)}</span></span>` : '';
  }

  /* ---- public renderers ---- */
  function eventPost(ev, idx, opts) {
    opts = opts || {};
    idx = idx || 0;
    const url = `/event?id=${encodeURIComponent(ev.id)}`;
    const images = (ev.images || []).filter(Boolean);
    const media = images.length
      ? carousel(images, idx, dateChip(ev.date))
      : `<div class="post-media post-cardart" style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
           <span class="cardart-eyebrow">Event</span>
           <span class="cardart-title">${esc(ev.title)}</span>
           ${ev.date ? `<span class="cardart-date">${I.cal}${esc(ev.date)}</span>` : ''}
         </div>`;
    return `
      <article class="post${opts.compact ? ' compact' : ''}" id="post-${esc(ev.id)}">
        ${head('Event', ev.createdAt, { url })}
        ${media}
        ${actions(ev.id, url, ev.title, { href: url, label: 'Details' })}
        ${caption(ev.title, AVSStore.stripFormatting(ev.description), opts.compact ? 110 : 220)}
      </article>`;
  }

  function storyPost(s, idx, opts) {
    opts = opts || {};
    idx = idx || 0;
    const url = `/story?id=${encodeURIComponent(s.id)}`;
    const yid = AVSStore.youtubeId(s.youtubeUrl);
    const media = `
      <div class="post-media post-video" ${yid ? `data-yt="${esc(yid)}"` : ''} style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
        ${yid ? `<img src="https://img.youtube.com/vi/${esc(yid)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()" />` : ''}
        <span class="video-shade"></span>
        <button type="button" class="video-play" aria-label="Play ${esc(s.title)}">${I.play}</button>
        <span class="video-tag">${I.play} Story</span>
      </div>`;
    return `
      <article class="post${opts.compact ? ' compact' : ''}" id="post-${esc(s.id)}">
        ${head('Story', s.createdAt, { url })}
        ${media}
        ${actions(s.id, url, s.title, { href: url, label: 'Open' })}
        ${caption(s.title, s.description, opts.compact ? 110 : 220)}
      </article>`;
  }

  const PLATFORM = { youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Podcasts', custom: 'Listen' };

  function episodePost(ep, idx, opts) {
    opts = opts || {};
    idx = idx || 0;
    const url = `/episode?id=${encodeURIComponent(ep.id)}`;
    const vid = opts.thumbVideoId || (ep.platform === 'youtube' ? AVSStore.youtubeId(ep.url) : '');
    const kind = opts.eyebrow || (ep.platform === 'youtube' ? 'Video episode' : 'Episode');
    const media = vid
      ? `<a href="${url}" class="post-media post-video is-link" style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
           <img src="https://img.youtube.com/vi/${esc(vid)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()" />
           <span class="video-shade"></span>
           <span class="video-play">${I.play}</span>
           <span class="video-tag">${ep.isPlaylist ? 'Playlist' : I.play + ' Watch'}</span>
           ${opts.badgeText ? `<span class="post-chip br">${esc(opts.badgeText)}</span>` : ''}
         </a>`
      : `<a href="${url}" class="post-media post-audio" style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
           <span class="audio-art"><img src="${LOGO}" alt="" /></span>
           <span class="audio-wave" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="height:${20 + ((i * 37) % 70)}%"></i>`).join('')}</span>
           <span class="video-tag">${I.headphones} ${esc(PLATFORM[ep.platform] || 'Listen')}</span>
           ${opts.badgeText ? `<span class="post-chip br">${esc(opts.badgeText)}</span>` : ''}
         </a>`;
    const platforms = (ep.links || []).map((l) => PLATFORM[l.platform] || 'Listen').filter((v, i, a) => a.indexOf(v) === i);
    return `
      <article class="post dark" id="post-${esc(ep.id)}">
        ${head(kind, ep.createdAt, { url, author: opts.author || 'All Voices Podcast Network', avatar: opts.avatar })}
        ${media}
        ${actions(ep.id, url, ep.title, { href: url, label: ep.isPlaylist ? 'Open playlist' : 'Listen' })}
        ${caption(ep.title || 'Untitled episode', ep.description, 200)}
        ${platforms.length > 1 ? `<div class="post-tags">${platforms.map((p) => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
      </article>`;
  }


  /* Show card for the Podcast Network page */
  function showCard(sh, count, latestAt, idx) {
    idx = idx || 0;
    const url = `/show?id=${encodeURIComponent(sh.id)}`;
    const when = timeAgo(latestAt);
    return `
      <a href="${url}" class="show-card group">
        <span class="show-art" style="background:linear-gradient(${GRADS[idx % GRADS.length]})">
          ${sh.cover ? `<img src="${esc(sh.cover)}" alt="" loading="lazy" />` : `<img src="${LOGO}" alt="" class="logo" />`}
          <span class="show-count">${count} episode${count === 1 ? '' : 's'}</span>
        </span>
        <span class="show-info">
          <span class="show-title">${esc(sh.title)}</span>
          ${sh.host ? `<span class="show-host">${esc(sh.host)}</span>` : ''}
          ${sh.description ? `<span class="show-desc">${esc(AVSStore.previewText(sh.description, 120))}</span>` : ''}
          <span class="show-foot">
            <span>${when ? 'Latest · ' + esc(when) : 'Coming soon'}</span>
            <span class="show-go">View show ${I.arrow}</span>
          </span>
        </span>
      </a>`;
  }

  /* Instagram-style highlight rings */
  function rings(items) {
    return items
      .map((it) => `
        <a href="${esc(it.href)}" class="hl" ${it.target ? `data-target="${esc(it.target)}"` : ''}>
          <span class="hl-outer"><span class="hl-inner">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.className='logo';this.src='${LOGO}'" />` : `<img src="${LOGO}" alt="" class="logo" />`}</span></span>
          <span class="hl-label">${esc(it.label)}</span>
        </a>`)
      .join('');
  }

  /* Profile card for the sidebar (counts are real, from the database) */
  async function profileCard(el) {
    if (!el) return;
    const [events, stories, eps] = await Promise.all([AVSStore.getEvents(), AVSStore.getStories(), AVSStore.getPodcastEpisodes()]);
    const episodes = eps.filter((e) => !e.isPlaylist).length;
    el.innerHTML = `
      <div class="profile-cover"></div>
      <div class="px-6 pb-6">
        <span class="profile-avatar"><img src="${LOGO}" alt="" /></span>
        <p class="font-display font-semibold text-lg mt-3 leading-tight">${AUTHOR}</p>
        <p class="text-muted text-sm">${HANDLE}</p>
        <p class="text-[15px] mt-3 leading-relaxed text-ink/80">Unity, diversity and social inclusion through media and storytelling. Halifax, Nova Scotia.</p>
        <div class="profile-stats">
          <a href="/events"><b>${events.length}</b><span>Events</span></a>
          <a href="/stories"><b>${stories.length}</b><span>Stories</span></a>
          <a href="/podcasts"><b>${episodes}</b><span>Episodes</span></a>
        </div>
        <div class="flex gap-2 mt-5">
          <a href="https://www.instagram.com/allvoicessociety" target="_blank" rel="noopener" class="profile-btn primary">Follow</a>
          <a href="https://paypal.me/allvoicessociety" target="_blank" rel="noopener" class="profile-btn">Donate</a>
          <a href="/contact" class="profile-btn">Message</a>
        </div>
      </div>`;
  }


  /* Sidebar: profile card + explore links */
  function sidebar(el, active) {
    if (!el) return;
    const link = (href, label, icon) => `<a href="${href}" class="side-link"${active === href ? ' aria-current="page" style="color:#1E7BFF"' : ''}><span class="ic">${icon}</span>${label}</a>`;
    el.innerHTML = `
      <div class="profile-card" id="feed-profile"><div class="profile-cover"></div><div class="px-6 pb-6"><span class="profile-avatar"><img src="${LOGO}" alt="" /></span><div class="skel h-5 w-2/3 mt-4"></div><div class="skel h-3 w-1/3 mt-2"></div><div class="skel h-16 w-full mt-4"></div></div></div>
      <div class="side-card">
        <h4>Explore</h4>
        ${link('/events', 'Events', I.cal)}
        ${link('/stories', 'Stories', I.play)}
        ${link('/podcasts', 'Podcasts', I.headphones)}
        ${link('/get-involved', 'Get involved', I.heart)}
      </div>
      <p class="side-foot">© ${new Date().getFullYear()} All Voices Society · Halifax, Nova Scotia · Nova Scotia Registry ID 4739049</p>`;
    profileCard(document.getElementById('feed-profile'));
  }

  function skeletonPosts(n) {
    return Array.from({ length: n || 2 }, () => `
      <div class="post post-skel" aria-hidden="true">
        <div class="post-head"><span class="skel" style="width:42px;height:42px;border-radius:999px"></span><div class="flex-1"><div class="skel h-3 w-1/3"></div><div class="skel h-3 w-1/5 mt-2"></div></div></div>
        <div class="post-media skel" style="border-radius:0"></div>
        <div class="post-body" style="padding-top:16px"><div class="skel h-4 w-2/3"></div><div class="skel h-3 w-full mt-3"></div><div class="skel h-3 w-4/5 mt-2"></div></div>
      </div>`).join('');
  }


  /* Author header + action bar for a single event/story page */
  function detail(headEl, actEl, item) {
    if (headEl) headEl.innerHTML = head(item.kind, item.createdAt, { url: item.url, author: item.author }).replace('class="post-head"', 'class="post-head flat"');
    if (actEl) actEl.innerHTML = actions(item.id, item.url, item.title, null).replace('class="post-actions"', 'class="post-actions flat"');
    hydrate();
  }

  /* ---- interactivity ---- */
  function playYoutube(media) {
    const id = media.getAttribute('data-yt');
    if (!id || media.querySelector('iframe')) return;
    media.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }

  function setupCarousel(car) {
    if (car._ready) return;
    car._ready = true;
    const track = car.querySelector('.car-track');
    const slides = track.children.length;
    if (slides < 2) return;
    const prev = car.querySelector('.prev'), next = car.querySelector('.next');
    const dots = car.querySelectorAll('.car-dots i'), count = car.querySelector('.car-count');
    const go = (i) => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    const cur = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    prev.addEventListener('click', (e) => { e.preventDefault(); go(cur() - 1); });
    next.addEventListener('click', (e) => { e.preventDefault(); go(cur() + 1); });
    let raf;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = cur();
        dots.forEach((d, k) => d.classList.toggle('on', k === i));
        if (count) count.textContent = `${i + 1}/${slides}`;
        prev.hidden = i === 0;
        next.hidden = i === slides - 1;
      });
    }, { passive: true });
  }

  async function share(url, title) {
    const full = absUrl(url);
    if (navigator.share) {
      try { await navigator.share({ title: title || AUTHOR, url: full }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copy(full);
  }
  async function copy(text) {
    const full = text.startsWith('http') ? text : absUrl(text);
    try { await navigator.clipboard.writeText(full); toast('Link copied'); }
    catch (e) { window.prompt('Copy this link:', full); }
  }

  let bound = false;
  function hydrate(root) {
    (root || document).querySelectorAll('[data-car]').forEach(setupCarousel);
    if (bound) return;
    bound = true;
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-like],[data-save],[data-share],[data-copy],.post-more-text,.video-play,.post-video[data-yt],.hl[data-target]');
      if (!t) return;
      if (t.matches('[data-like]')) {
        const on = store.toggle('avs_likes', t.dataset.like);
        t.classList.toggle('on', on); t.setAttribute('aria-pressed', on);
        if (on) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); }
      } else if (t.matches('[data-save]')) {
        const on = store.toggle('avs_saved', t.dataset.save);
        t.classList.toggle('on', on); t.setAttribute('aria-pressed', on);
        toast(on ? 'Saved on this device' : 'Removed from saved');
      } else if (t.matches('[data-share]')) {
        share(t.dataset.share, t.dataset.title);
      } else if (t.matches('[data-copy]')) {
        if (t.dataset.copy) copy(t.dataset.copy);
      } else if (t.matches('.post-more-text')) {
        const p = t.closest('.post-text');
        p.textContent = p.dataset.full;
      } else if (t.matches('.hl[data-target]')) {
        const post = document.getElementById(t.dataset.target);
        if (post) { e.preventDefault(); post.scrollIntoView({ behavior: 'smooth', block: 'center' }); post.classList.add('flash'); setTimeout(() => post.classList.remove('flash'), 1400); }
      } else {
        const media = t.closest('.post-video[data-yt]');
        if (media) { e.preventDefault(); playYoutube(media); }
      }
    });
    // double-tap / double-click a photo to like, like you'd expect on social apps
    document.addEventListener('dblclick', (e) => {
      const media = e.target.closest('.post .car, .post .post-cardart');
      if (!media) return;
      e.preventDefault();
      const btn = media.closest('.post').querySelector('[data-like]');
      if (btn && !btn.classList.contains('on')) btn.click();
      const burst = document.createElement('span');
      burst.className = 'like-burst';
      burst.innerHTML = I.heart;
      media.appendChild(burst);
      setTimeout(() => burst.remove(), 900);
    });
  }

  document.querySelectorAll('[data-sidebar]').forEach((el) => sidebar(el, el.dataset.sidebar));

  window.AVSFeed = { showCard, detail, eventPost, storyPost, episodePost, rings, profileCard, sidebar, skeletonPosts, hydrate, timeAgo, toast };
})();
