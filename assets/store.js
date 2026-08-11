/* ==========================================================================
   All Voices Society — shared content store (Appwrite-backed)
   --------------------------------------------------------------------------
   This replaces the old localStorage-only store. Board members, events, and
   stories now live in an Appwrite database, and photos live in an Appwrite
   Storage bucket, so content added on the Admin page shows up for every
   visitor, on any device, immediately.

   Requires assets/appwrite-config.js to be loaded first, and the Appwrite
   Web SDK to be loaded before this file:
     <script src="https://cdn.jsdelivr.net/npm/appwrite@26"></script>
     <script src="assets/appwrite-config.js"></script>
     <script src="assets/store.js"></script>
   ========================================================================== */

const { Client, TablesDB, Storage, Account, ID, Query, Permission, Role } = Appwrite;

const avsClient = new Client()
  .setEndpoint(window.AVS_CONFIG.endpoint)
  .setProject(window.AVS_CONFIG.projectId);

const avsTables = new TablesDB(avsClient);
const avsStorage = new Storage(avsClient);
const avsAccount = new Account(avsClient);

const AVS_DB = window.AVS_CONFIG.databaseId;
const AVS_TABLES = window.AVS_CONFIG.tables;
const AVS_BUCKET = window.AVS_CONFIG.bucketId;

/* ---- helpers ---- */

function avsFileUrl(fileId) {
  if (!fileId) return '';
  try {
    return avsStorage.getFileView({ bucketId: AVS_BUCKET, fileId }).toString();
  } catch (e) {
    return '';
  }
}

async function avsUploadFile(file) {
  const created = await avsStorage.createFile({
    bucketId: AVS_BUCKET,
    fileId: ID.unique(),
    file,
  });
  return created.$id;
}

async function avsDeleteFile(fileId) {
  if (!fileId) return;
  try {
    await avsStorage.deleteFile({ bucketId: AVS_BUCKET, fileId });
  } catch (e) {
    // best-effort — don't block the UI if a stale file is already gone
    console.warn('Could not delete file', fileId, e);
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

const AVSStore = {
  /* ---- Board members ---- */
  async getBoard() {
    try {
      const res = await avsTables.listRows({
        databaseId: AVS_DB,
        tableId: AVS_TABLES.board,
        queries: [Query.orderAsc('$createdAt'), Query.limit(200)],
      });
      return res.rows.map((r) => ({
        id: r.$id,
        name: r.name || '',
        role: r.role || '',
        bio: r.bio || '',
        photoId: r.photoId || '',
        photo: avsFileUrl(r.photoId),
      }));
    } catch (e) {
      console.error('AVSStore.getBoard failed', e);
      return [];
    }
  },
  async addBoardMember(m) {
    return avsTables.createRow({
      databaseId: AVS_DB,
      tableId: AVS_TABLES.board,
      rowId: ID.unique(),
      data: { name: m.name || '', role: m.role || '', bio: m.bio || '', photoId: m.photoId || '' },
    });
  },
  async updateBoardMember(id, updates) {
    return avsTables.updateRow({ databaseId: AVS_DB, tableId: AVS_TABLES.board, rowId: id, data: updates });
  },
  async deleteBoardMember(id, photoId) {
    if (photoId) await avsDeleteFile(photoId);
    return avsTables.deleteRow({ databaseId: AVS_DB, tableId: AVS_TABLES.board, rowId: id });
  },

  /* ---- Events ---- */
  async getEvents() {
    try {
      const res = await avsTables.listRows({
        databaseId: AVS_DB,
        tableId: AVS_TABLES.events,
        queries: [Query.orderAsc('$createdAt'), Query.limit(200)],
      });
      return res.rows.map((r) => ({
        id: r.$id,
        title: r.title || '',
        date: r.date || '',
        description: r.description || '',
        imageIds: Array.isArray(r.imageIds) ? r.imageIds : [],
        images: (Array.isArray(r.imageIds) ? r.imageIds : []).map(avsFileUrl).filter(Boolean),
      }));
    } catch (e) {
      console.error('AVSStore.getEvents failed', e);
      return [];
    }
  },
  async getEvent(id) {
    try {
      const r = await avsTables.getRow({ databaseId: AVS_DB, tableId: AVS_TABLES.events, rowId: id });
      const imageIds = Array.isArray(r.imageIds) ? r.imageIds : [];
      return {
        id: r.$id,
        title: r.title || '',
        date: r.date || '',
        description: r.description || '',
        imageIds,
        images: imageIds.map(avsFileUrl).filter(Boolean),
      };
    } catch (e) {
      console.error('AVSStore.getEvent failed', e);
      return null;
    }
  },
  async addEvent(e) {
    return avsTables.createRow({
      databaseId: AVS_DB,
      tableId: AVS_TABLES.events,
      rowId: ID.unique(),
      data: { title: e.title || '', date: e.date || '', description: e.description || '', imageIds: e.imageIds || [] },
    });
  },
  async updateEvent(id, updates) {
    return avsTables.updateRow({ databaseId: AVS_DB, tableId: AVS_TABLES.events, rowId: id, data: updates });
  },
  async deleteEvent(id, imageIds) {
    if (Array.isArray(imageIds)) await Promise.all(imageIds.map(avsDeleteFile));
    return avsTables.deleteRow({ databaseId: AVS_DB, tableId: AVS_TABLES.events, rowId: id });
  },

  /* ---- Stories ---- */
  async getStories() {
    try {
      const res = await avsTables.listRows({
        databaseId: AVS_DB,
        tableId: AVS_TABLES.stories,
        queries: [Query.orderAsc('$createdAt'), Query.limit(200)],
      });
      return res.rows.map((r) => ({
        id: r.$id,
        youtubeUrl: r.youtubeUrl || '',
        title: r.title || '',
        description: r.description || '',
      }));
    } catch (e) {
      console.error('AVSStore.getStories failed', e);
      return [];
    }
  },
  async getStory(id) {
    try {
      const r = await avsTables.getRow({ databaseId: AVS_DB, tableId: AVS_TABLES.stories, rowId: id });
      return {
        id: r.$id,
        youtubeUrl: r.youtubeUrl || '',
        title: r.title || '',
        description: r.description || '',
      };
    } catch (e) {
      console.error('AVSStore.getStory failed', e);
      return null;
    }
  },
  async addStory(s) {
    return avsTables.createRow({
      databaseId: AVS_DB,
      tableId: AVS_TABLES.stories,
      rowId: ID.unique(),
      data: { youtubeUrl: s.youtubeUrl || '', title: s.title || '', description: s.description || '' },
    });
  },
  async updateStory(id, updates) {
    return avsTables.updateRow({ databaseId: AVS_DB, tableId: AVS_TABLES.stories, rowId: id, data: updates });
  },
  async deleteStory(id) {
    return avsTables.deleteRow({ databaseId: AVS_DB, tableId: AVS_TABLES.stories, rowId: id });
  },

  /* ---- Podcast ----
     Each row is either:
       - a standalone episode  (isPlaylist:false, playlistId:'')
       - a YouTube playlist "header" (isPlaylist:true) — its own url is the
         playlist URL, used to render a playlist embed + label
       - an episode tagged under a playlist (isPlaylist:false, playlistId:<header row id>)
     platform is one of 'youtube' | 'spotify' | 'apple'. Playlists only apply
     to the youtube platform. */
  async getPodcastEpisodes() {
    try {
      const res = await avsTables.listRows({
        databaseId: AVS_DB,
        tableId: AVS_TABLES.podcast,
        queries: [Query.orderAsc('$createdAt'), Query.limit(500)],
      });
      return res.rows.map((r) => ({
        id: r.$id,
        platform: r.platform || 'youtube',
        url: r.url || '',
        title: r.title || '',
        description: r.description || '',
        isPlaylist: !!r.isPlaylist,
        playlistId: r.playlistId || '',
      }));
    } catch (e) {
      console.error('AVSStore.getPodcastEpisodes failed', e);
      return [];
    }
  },
  async getPodcastEpisode(id) {
    try {
      const r = await avsTables.getRow({ databaseId: AVS_DB, tableId: AVS_TABLES.podcast, rowId: id });
      return {
        id: r.$id,
        platform: r.platform || 'youtube',
        url: r.url || '',
        title: r.title || '',
        description: r.description || '',
        isPlaylist: !!r.isPlaylist,
        playlistId: r.playlistId || '',
      };
    } catch (e) {
      console.error('AVSStore.getPodcastEpisode failed', e);
      return null;
    }
  },
  async addPodcastEpisode(p) {
    return avsTables.createRow({
      databaseId: AVS_DB,
      tableId: AVS_TABLES.podcast,
      rowId: ID.unique(),
      data: {
        platform: p.platform || 'youtube',
        url: p.url || '',
        title: p.title || '',
        description: p.description || '',
        isPlaylist: !!p.isPlaylist,
        playlistId: p.playlistId || '',
      },
    });
  },
  async updatePodcastEpisode(id, updates) {
    return avsTables.updateRow({ databaseId: AVS_DB, tableId: AVS_TABLES.podcast, rowId: id, data: updates });
  },
  async deletePodcastEpisode(id) {
    return avsTables.deleteRow({ databaseId: AVS_DB, tableId: AVS_TABLES.podcast, rowId: id });
  },

  /* ---- Storage helpers (used by admin.html) ---- */
  uploadImage: avsUploadFile,
  deleteImage: avsDeleteFile,
  compressImage: avsCompressImage,
  fileUrl: avsFileUrl,

  /* ---- Misc helpers ---- */
  youtubeId(url) {
    if (!url) return '';
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
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
  initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  },
};

/* ---- Admin auth (real Appwrite accounts, not a shared password) ---- */
const AVSAuth = {
  async login(email, password) {
    return avsAccount.createEmailPasswordSession({ email, password });
  },
  async logout() {
    try {
      await avsAccount.deleteSession({ sessionId: 'current' });
    } catch (e) {
      /* no active session — fine */
    }
  },
  async currentUser() {
    try {
      return await avsAccount.get();
    } catch (e) {
      return null;
    }
  },
};

window.AVSStore = AVSStore;
window.AVSAuth = AVSAuth;
