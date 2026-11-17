#!/usr/bin/env node
/* ==========================================================================
   One-time copy of All Voices Society content: Appwrite  ->  PocketBase
   --------------------------------------------------------------------------
   Copies board members, events, stories, podcast episodes AND every photo
   they reference. Safe to run on an empty PocketBase; running it twice will
   create duplicates.

   Needs Node 18+ (no npm install). Set these, then run:
     APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1 \
     APPWRITE_PROJECT=6a6a534f897f8951b70e \
     APPWRITE_KEY=<API key with rows.read + files.read scopes> \
     PB_URL=http://127.0.0.1:8090 \
     PB_EMAIL=<superuser email> PB_PASSWORD=<superuser password> \
     node scripts/migrate-from-appwrite.mjs

   Optional: APPWRITE_DB (default avs_content), APPWRITE_BUCKET (default avs_media)
   ========================================================================== */
const env = (k, d) => process.env[k] || d || (() => { console.error(`Missing ${k}`); process.exit(1); })();

const AW = env('APPWRITE_ENDPOINT').replace(/\/+$/, '');
const AW_PROJECT = env('APPWRITE_PROJECT');
const AW_KEY = env('APPWRITE_KEY');
const AW_DB = env('APPWRITE_DB', 'avs_content');
const AW_BUCKET = env('APPWRITE_BUCKET', 'avs_media');
const PB = env('PB_URL').replace(/\/+$/, '');
const PB_EMAIL = env('PB_EMAIL');
const PB_PASSWORD = env('PB_PASSWORD');

const awHeaders = { 'X-Appwrite-Project': AW_PROJECT, 'X-Appwrite-Key': AW_KEY };

async function awListRows(table) {
  const out = [];
  let cursor = null;
  for (;;) {
    const q = [JSON.stringify({ method: 'limit', values: [100] }), JSON.stringify({ method: 'orderAsc', attribute: '$createdAt' })];
    if (cursor) q.push(JSON.stringify({ method: 'cursorAfter', values: [cursor] }));
    const url = `${AW}/tablesdb/${AW_DB}/tables/${table}/rows?` + q.map((x) => 'queries[]=' + encodeURIComponent(x)).join('&');
    const res = await fetch(url, { headers: awHeaders });
    if (!res.ok) throw new Error(`Appwrite ${table}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    out.push(...body.rows);
    if (body.rows.length < 100) return out;
    cursor = body.rows[body.rows.length - 1].$id;
  }
}

async function awDownload(fileId) {
  const meta = await fetch(`${AW}/storage/buckets/${AW_BUCKET}/files/${fileId}`, { headers: awHeaders });
  const name = meta.ok ? (await meta.json()).name : `${fileId}.jpg`;
  const res = await fetch(`${AW}/storage/buckets/${AW_BUCKET}/files/${fileId}/download`, { headers: awHeaders });
  if (!res.ok) throw new Error(`download ${fileId}: ${res.status}`);
  return { blob: await res.blob(), name };
}

let token = '';
async function pbAuth() {
  const res = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  });
  if (!res.ok) throw new Error(`PocketBase sign-in failed: ${res.status} ${await res.text()}`);
  token = (await res.json()).token;
}
async function pbCreate(col, data) {
  const isForm = data instanceof FormData;
  const res = await fetch(`${PB}/api/collections/${col}/records`, {
    method: 'POST',
    headers: isForm ? { Authorization: token } : { Authorization: token, 'Content-Type': 'application/json' },
    body: isForm ? data : JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PocketBase ${col}: ${res.status} ${await res.text()}`);
  return res.json();
}

const fileMap = new Map(); // appwrite fileId -> "recordId/filename"
async function copyFile(fileId) {
  if (!fileId) return '';
  if (fileMap.has(fileId)) return fileMap.get(fileId);
  try {
    const { blob, name } = await awDownload(fileId);
    const fd = new FormData();
    fd.append('file', blob, name);
    const rec = await pbCreate('media', fd);
    const ref = `${rec.id}/${rec.file}`;
    fileMap.set(fileId, ref);
    return ref;
  } catch (e) {
    console.warn(`  ! skipped photo ${fileId}: ${e.message}`);
    return '';
  }
}

const parseLinks = (links) =>
  (Array.isArray(links) ? links : [])
    .map((s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } })
    .filter((l) => l && l.url)
    .map((l) => ({ platform: l.platform || 'youtube', url: l.url }));

(async () => {
  await pbAuth();
  console.log('Signed in to PocketBase.');

  const board = await awListRows('board_members');
  for (const r of board) {
    await pbCreate('board_members', { name: r.name || '', role: r.role || '', bio: r.bio || '', photoId: await copyFile(r.photoId) });
  }
  console.log(`Board members: ${board.length}`);

  const events = await awListRows('events');
  for (const r of events) {
    const imageIds = [];
    for (const id of r.imageIds || []) { const ref = await copyFile(id); if (ref) imageIds.push(ref); }
    await pbCreate('events', { title: r.title || '', date: r.date || '', description: r.description || '', imageIds });
  }
  console.log(`Events: ${events.length}`);

  const stories = await awListRows('stories');
  for (const r of stories) await pbCreate('stories', { youtubeUrl: r.youtubeUrl || '', title: r.title || '', description: r.description || '' });
  console.log(`Stories: ${stories.length}`);

  // Playlists first, so episodes can point at their new PocketBase ids.
  const eps = await awListRows('podcast_episodes');
  const idMap = new Map();
  const ordered = [...eps.filter((e) => e.isPlaylist), ...eps.filter((e) => !e.isPlaylist)];
  for (const r of ordered) {
    let links = parseLinks(r.links);
    if (!links.length && r.url) links = [{ platform: r.platform || 'youtube', url: r.url }];
    const rec = await pbCreate('podcast_episodes', {
      platform: (links[0] && links[0].platform) || r.platform || 'youtube',
      url: (links[0] && links[0].url) || r.url || '',
      links,
      title: r.title || '',
      description: r.description || '',
      isPlaylist: !!r.isPlaylist,
      playlistId: r.playlistId ? idMap.get(r.playlistId) || '' : '',
    });
    idMap.set(r.$id, rec.id);
  }
  console.log(`Podcast items: ${eps.length}`);
  console.log(`Photos copied: ${fileMap.size}\nDone.`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
