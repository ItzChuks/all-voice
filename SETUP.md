# Wiring All Voices Society up to PocketBase

The site is still plain static HTML. All content (board members, events,
stories, podcast episodes, photos) lives in a PocketBase server that the
browser talks to directly. Setup takes ~15 minutes.

---

## 1. Run PocketBase locally (to test)

1. Download PocketBase **v0.30 or newer** for your OS from
   <https://pocketbase.io/docs/> and unzip it into a folder.
2. Copy this repo's `pb_migrations/` folder next to the `pocketbase` binary.
3. Start it:
   ```bash
   ./pocketbase serve
   ```
   The migration runs automatically and creates every collection with the
   right fields and access rules.
4. Open <http://127.0.0.1:8090/_/> and create your **superuser** account.

## 2. Create an admin login for the website

In the dashboard open **Collections → admins → + New record**, enter an email
and password (tick *Verified*), and save. That's the account you use on
`/admin`. Add as many admins as you need.

> Superuser accounts can also sign in on `/admin`, but day-to-day editors
> should use `admins` records.

## 3. Point the site at PocketBase

Open `assets/pocketbase-config.js` and set `url`:

```js
url: 'http://127.0.0.1:8090',           // local
// url: 'https://your-app.up.railway.app', // production
```

Run the site with `npm run dev` and open <http://localhost:5500>.

## 4. Move your existing Appwrite content (one time)

`scripts/migrate-from-appwrite.mjs` copies every board member, event, story,
podcast item **and their photos** from Appwrite into PocketBase.

1. In the Appwrite Console create an **API key** with the `rows.read`,
   `tables.read` and `files.read` scopes.
2. Run (Node 18+, nothing to install):
   ```bash
   APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1 \
   APPWRITE_PROJECT=6a6a534f897f8951b70e \
   APPWRITE_KEY=your_api_key \
   PB_URL=http://127.0.0.1:8090 \
   PB_EMAIL=your_superuser_email PB_PASSWORD=your_superuser_password \
   node scripts/migrate-from-appwrite.mjs
   ```
Run it once against an empty PocketBase — running it twice creates duplicates.

## 5. Deploy PocketBase

Any host that runs a binary with a persistent disk works (Railway, Fly.io,
PocketHost, a VPS). On **Railway**:

1. Deploy a PocketBase template (or a Dockerfile running `pocketbase serve
   --http=0.0.0.0:8080`) and attach a **volume** mounted at `/pb/pb_data`
   (otherwise data is wiped on every redeploy).
2. Upload/copy `pb_migrations/` into the container next to the binary.
3. Create the superuser at `https://<your-app>/_/`, then repeat steps 2 and 4
   against the live URL.
4. Put the live URL in `assets/pocketbase-config.js`.

Recommended in the dashboard: **Settings → Application → Allowed origins**
(if present) / CORS — restrict to your site's domain once everything works.

## 6. Deploy the website

Unchanged: upload the folder to Netlify / Vercel / any static host.
`_redirects` and `vercel.json` already handle clean URLs.

---

## What's in PocketBase

| Collection | Fields | Who can write |
|---|---|---|
| `board_members` | name, role, bio (5000), photoId | admins |
| `events` | title, date (free text), description, imageIds (JSON list) | admins |
| `stories` | youtubeUrl, title, description | admins |
| `podcast_episodes` | platform, url, links (JSON), title, description, isPlaylist, playlistId | admins |
| `media` | file (image, 10 MB max) | admins |
| `admins` | auth collection — the website's editors | superusers |

Everyone can **read** content and photos (it's a public site). Writes need an
`admins` login — enforced by PocketBase's API rules, not by the page's JS.

Photo references are stored as `<mediaRecordId>/<filename>`; the public URL is
`<pb url>/api/files/media/<mediaRecordId>/<filename>`.

## Troubleshooting

- **Lists are empty / "Could not reach the server"** — PocketBase isn't
  running, or `url` in `assets/pocketbase-config.js` is wrong (no trailing
  slash, include `https://`).
- **"Sign-in failed"** — the email must be a record in the `admins`
  collection (or a superuser). Check *Verified* is ticked.
- **"You are not allowed to do that"** — you're signed in with a non-admin
  account, or your session expired: sign out and back in.
- **Photos won't upload** — must be JPG/PNG/WebP/GIF under 10 MB (the admin
  compresses photos before upload, so this is rare).
