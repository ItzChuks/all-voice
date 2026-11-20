/* ==========================================================================
   All Voices Society — shared content store (PocketBase-backed)
   --------------------------------------------------------------------------
   Board members, events, stories and podcast episodes live in PocketBase
   collections; photos live in a `media` collection (one file per record).
   Every page talks to PocketBase directly from the visitor's browser.

   Load order on every page:
     <script src="https://cdn.jsdelivr.net/npm/pocketbase@0.29.0/dist/pocketbase.umd.js"></script>
     <script src="assets/pocketbase-config.js"></script>
     <script src="assets/store.js"></script>

   The public API (AVSStore.getBoard(), addEvent(), uploadImage(), ...) is the
   same shape the pages used with Appwrite, so the HTML didn't need rewriting.

   Photo references: a stored photo id looks like  "<mediaRecordId>/<filename>"
   so a URL can be built without an extra request:
     <pbUrl>/api/files/media/<mediaRecordId>/<filename>
   ========================================================================== */

const AVS_CFG = window.AVS_CONFIG;
const pb = new PocketBase(AVS_CFG.url);
pb.autoCancellation(false); // pages fire several list requests in parallel

const C = AVS_CFG.collections;

/* ---- helpers ---- */

function avsFileUrl(ref) {
  if (!ref || typeof ref !== 'string' || ref.indexOf('/') === -1) return '';
  const [recordId, filename] = ref.split('/');
  if (!recordId || !filename) return '';
  return `${AVS_CFG.url.replace(/\/+$/, '')}/api/files/${encodeURIComponent(C.media)}/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}`;
}

async function avsUploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const rec = await pb.collection(C.media).create(fd);
  return `${rec.id}/${rec.file}`;
}

async function avsDeleteFile(ref) {
  if (!ref) return;
  const recordId = String(ref).split('/')[0];
  try {
    await pb.collection(C.media).delete(recordId);
  } catch (e) {
    // best-effort — don't block the UI if a stale file is already gone
    console.warn('Could not delete file', ref, e);
  }
}

/* PocketBase errors carry field-level details in e.response.data — surface
   them so "Could not save" messages are actually useful. */
function avsErrorMessage(e) {
  if (!e) return 'Unknown error';
  if (e.status === 0) return 'Could not reach the server. Check your internet connection and the PocketBase URL in assets/pocketbase-config.js.';
  const data = e.response && e.response.data;
  if (data && typeof data === 'object') {
    const parts = Object.entries(data).map(([k, v]) => `${k}: ${(v && v.message) || v}`);
    if (parts.length) return `${e.message} (${parts.join('; ')})`;
  }
  if (e.status === 403 || e.status === 401) return 'You are not allowed to do that. Sign in again with an admin account.';
  return e.message || String(e);
}

/* Wrap a write so thrown errors have a readable .message */
async function avsWrite(fn) {
  try {
    return await fn();
  } catch (e) {
    const err = new Error(avsErrorMessage(e));
    err.status = e && e.status;
    err.original = e;
    throw err;
  }
}

/* Resize + compress an image file before upload, so photos don't eat
   storage/bandwidth unnecessarily. Returns a File (JPEG). */
function avsCompressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Could not compress image'));
            resolve(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality || 0.82
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  return [];
}

const listAll = (col) => pb.collection(col).getFullList({ sort: 'created', batch: 500 });

const mapBoard = (r) => ({
  id: r.id,
  name: r.name || '',
  role: r.role || '',
  bio: r.bio || '',
  photoId: r.photoId || '',
  photo: avsFileUrl(r.photoId),
  createdAt: r.created || '',
});
const mapEvent = (r) => {
  const imageIds = asArray(r.imageIds).filter((x) => typeof x === 'string' && x);
  return {
    id: r.id,
    title: r.title || '',
    date: r.date || '',
    description: r.description || '',
    imageIds,
    images: imageIds.map(avsFileUrl).filter(Boolean),
    createdAt: r.created || '',
  };
};
const mapStory = (r) => ({
  id: r.id,
  youtubeUrl: r.youtubeUrl || '',
  title: r.title || '',
  description: r.description || '',
  createdAt: r.created || '',
});

const AVSStore = {
  /* ---- Board members ---- */
  async getBoard() {
    try {
      return (await listAll(C.board)).map(mapBoard);
    } catch (e) {
      console.error('AVSStore.getBoard failed', e);
      return [];
    }
  },
  async addBoardMember(m) {
    return avsWrite(() =>
      pb.collection(C.board).create({ name: m.name || '', role: m.role || '', bio: m.bio || '', photoId: m.photoId || '' })
    );
  },
  async updateBoardMember(id, updates) {
    return avsWrite(() => pb.collection(C.board).update(id, updates));
  },
  async deleteBoardMember(id, photoId) {
    if (photoId) await avsDeleteFile(photoId);
    return avsWrite(() => pb.collection(C.board).delete(id));
  },
  async getBoardMember(id) {
    try {
      return mapBoard(await pb.collection(C.board).getOne(id));
    } catch (e) {
      // 404 = this member really doesn't exist. Anything else (network,
      // permissions) is a real problem, so let the page show it.
      if (e && e.status === 404) return null;
      console.error('AVSStore.getBoardMember failed', e);
      throw new Error(avsErrorMessage(e));
    }
  },

  /* ---- Events ---- */
  async getEvents() {
    try {
      return (await listAll(C.events)).map(mapEvent);
    } catch (e) {
      console.error('AVSStore.getEvents failed', e);
      return [];
    }
  },
  async getEvent(id) {
    try {
      return mapEvent(await pb.collection(C.events).getOne(id));
    } catch (e) {
      console.error('AVSStore.getEvent failed', e);
      return null;
    }
  },
  async addEvent(e) {
    return avsWrite(() =>
      pb.collection(C.events).create({ title: e.title || '', date: e.date || '', description: e.description || '', imageIds: e.imageIds || [] })
    );
  },
  async updateEvent(id, updates) {
    return avsWrite(() => pb.collection(C.events).update(id, updates));
  },
  async deleteEvent(id, imageIds) {
    if (Array.isArray(imageIds)) await Promise.all(imageIds.map(avsDeleteFile));
    return avsWrite(() => pb.collection(C.events).delete(id));
  },

  /* ---- Stories ---- */
  async getStories() {
    try {
      return (await listAll(C.stories)).map(mapStory);
    } catch (e) {
      console.error('AVSStore.getStories failed', e);
      return [];
    }
  },
  async getStory(id) {
    try {
      return mapStory(await pb.collection(C.stories).getOne(id));
    } catch (e) {
      console.error('AVSStore.getStory failed', e);
      return null;
    }
  },
  async addStory(s) {
    return avsWrite(() =>
      pb.collection(C.stories).create({ youtubeUrl: s.youtubeUrl || '', title: s.title || '', description: s.description || '' })
    );
  },
  async updateStory(id, updates) {
    return avsWrite(() => pb.collection(C.stories).update(id, updates));
  },
  async deleteStory(id) {
    return avsWrite(() => pb.collection(C.stories).delete(id));
  },

  /* ---- Podcast ----
     Each record is either:
       - a standalone episode  (isPlaylist:false, playlistId:'')
       - a YouTube playlist "header" (isPlaylist:true) — its own url is the
         playlist URL, used to render a playlist embed + label
       - an episode tagged under a playlist (isPlaylist:false, playlistId:<header id>)

     An episode can carry several listen links, stored in the `links` JSON
     field as  [{ "platform": "youtube"|"spotify"|"apple"|"custom", "url": "..." }].
     The first link is the "primary" one and is mirrored into `platform`/`url`.
     (Older rows imported from Appwrite stored each link as a JSON *string* —
     those are still understood.) */
  _decodeLinks(r) {
    const links = asArray(r.links)
      .map((item) => {
        let obj = item;
        if (typeof item === 'string') {
          try { obj = JSON.parse(item); } catch (e) { return null; }
        }
        return obj && obj.url ? { platform: obj.platform || 'youtube', url: obj.url } : null;
      })
      .filter(Boolean);
    if (links.length === 0 && r.url) return [{ platform: r.platform || 'youtube', url: r.url }];
    return links;
  },
  _mapEpisode(r) {
    const links = AVSStore._decodeLinks(r);
    return {
      id: r.id,
      links,
      platform: (links[0] && links[0].platform) || r.platform || 'youtube',
      url: (links[0] && links[0].url) || r.url || '',
      title: r.title || '',
      description: r.description || '',
      isPlaylist: !!r.isPlaylist,
      playlistId: r.playlistId || '',
      createdAt: r.created || '',
    };
  },
  async getPodcastEpisodes() {
    try {
      return (await listAll(C.podcast)).map(AVSStore._mapEpisode);
    } catch (e) {
      console.error('AVSStore.getPodcastEpisodes failed', e);
      return [];
    }
  },
  async getPodcastEpisode(id) {
    try {
      return AVSStore._mapEpisode(await pb.collection(C.podcast).getOne(id));
    } catch (e) {
      console.error('AVSStore.getPodcastEpisode failed', e);
      return null;
    }
  },
  async addPodcastEpisode(p) {
    const links = Array.isArray(p.links) && p.links.length ? p.links : [{ platform: p.platform || 'youtube', url: p.url || '' }];
    return avsWrite(() =>
      pb.collection(C.podcast).create({
        platform: links[0].platform || 'youtube',
        url: links[0].url || '',
        links: links.map((l) => ({ platform: l.platform, url: l.url })),
        title: p.title || '',
        description: p.description || '',
        isPlaylist: !!p.isPlaylist,
        playlistId: p.playlistId || '',
      })
    );
  },
  async updatePodcastEpisode(id, updates) {
    const data = { ...updates };
    if (Array.isArray(updates.links) && updates.links.length) {
      data.platform = updates.links[0].platform || 'youtube';
      data.url = updates.links[0].url || '';
      data.links = updates.links.map((l) => ({ platform: l.platform, url: l.url }));
    }
    return avsWrite(() => pb.collection(C.podcast).update(id, data));
  },
  async deletePodcastEpisode(id) {
    return avsWrite(() => pb.collection(C.podcast).delete(id));
  },

  /* ---- Storage helpers (used by admin.html) ---- */
  async uploadImage(file) {
    return avsWrite(() => avsUploadFile(file));
  },
  deleteImage: avsDeleteFile,
  compressImage: avsCompressImage,
  fileUrl: avsFileUrl,

  /* ---- Misc helpers ---- */
  youtubeId(url) {
    if (!url) return '';
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  },
  youtubePlaylistId(url) {
    if (!url) return '';
    const m = String(url).match(/[?&]list=([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  },
  spotifyEmbedUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (!/(^|\.)spotify\.com$/.test(u.hostname)) return '';
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => ['episode', 'show', 'track', 'album', 'playlist'].includes(p));
      if (idx === -1 || !parts[idx + 1]) return '';
      return `https://open.spotify.com/embed/${parts[idx]}/${parts[idx + 1]}`;
    } catch (e) {
      return '';
    }
  },
  appleEmbedUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (!/(^|\.)podcasts\.apple\.com$/.test(u.hostname)) return '';
      return url.replace('podcasts.apple.com', 'embed.podcasts.apple.com');
    } catch (e) {
      return '';
    }
  },
  /* Generic embeddable player link — Captivate, Anchor, Buzzsprout, etc. */
  customEmbedUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return '';
      return url;
    } catch (e) {
      return '';
    }
  },
  initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  },
  /* Split a bio (or any long-text field) into paragraphs on blank lines. */
  splitParagraphs(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .trim()
      .split(/\n[ \t]*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  },
  /* Remove the **bold** / *italic* markers, leaving plain text (for previews). */
  stripFormatting(text) {
    return String(text || '')
      .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, '$1')
      .replace(/(^|[^*\w])\*([^\s*](?:[^*]*[^\s*])?)\*(?![*\w])/g, '$1$2');
  },
  /* Turn admin-typed text into safe HTML that keeps the writer's layout:
     blank line = new paragraph, Enter = <br>, leading spaces kept,
     **bold** and *italic* supported. Everything else is escaped. */
  formatRichText(text) {
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const inline = (line) =>
      esc(line)
        .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^\s*](?:[^*]*[^\s*])?)\*(?![*\w])/g, '$1<em>$2</em>');

    const paragraphs = [];
    let current = [];
    String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')
      .split('\n')
      .forEach((line) => {
        if (line.trim() === '') {
          if (current.length) paragraphs.push(current);
          current = [];
        } else {
          current.push(line.replace(/\s+$/, ''));
        }
      });
    if (current.length) paragraphs.push(current);

    return paragraphs.map((lines) => '<p>' + lines.map(inline).join('<br>') + '</p>').join('');
  },
  /* Short single-line preview for cards/lists. */
  previewText(text, maxLen) {
    const limit = maxLen || 140;
    const first = AVSStore.stripFormatting(AVSStore.splitParagraphs(text)[0] || '');
    const collapsed = first.replace(/\s+/g, ' ').trim();
    if (collapsed.length <= limit) return collapsed;
    return collapsed.slice(0, limit).replace(/\s+\S*$/, '') + '…';
  },
};

/* ---- Admin auth ----
   Admins are records in the `admins` auth collection. PocketBase superusers
   can sign in here too (handy for the very first login). The session is kept
   in localStorage by the SDK, so a refresh keeps you signed in. */
const AVSAuth = {
  async login(email, password) {
    try {
      return await pb.collection(C.admins).authWithPassword(email, password);
    } catch (e) {
      if (e && e.status === 0) throw new Error(avsErrorMessage(e));
      try {
        return await pb.collection('_superusers').authWithPassword(email, password);
      } catch (e2) {
        throw new Error('Sign-in failed. Check your email and password and try again.');
      }
    }
  },
  async logout() {
    pb.authStore.clear();
  },
  async currentUser() {
    if (!pb.authStore.isValid || !pb.authStore.record) return null;
    try {
      const col = pb.authStore.record.collectionName;
      await pb.collection(col).authRefresh();
      return pb.authStore.record;
    } catch (e) {
      pb.authStore.clear();
      return null;
    }
  },
};

window.pb = pb;
window.AVSStore = AVSStore;
window.AVSAuth = AVSAuth;
