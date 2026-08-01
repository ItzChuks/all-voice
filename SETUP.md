# Wiring All Voices Society up to Appwrite

This turns the site from "saved in one browser's localStorage" into
"saved in a real database, visible to every visitor." You'll do steps 1–6
once, in the Appwrite Console (cloud.appwrite.io). Nothing here needs a
server of your own — the static HTML files talk to Appwrite directly from
the visitor's browser.

Total time: ~20 minutes.

---

## 1. Create the project

1. Go to [cloud.appwrite.io](https://cloud.appwrite.io) and sign up / log in.
2. Click **Create project**, name it (e.g. "All Voices Society"), and open it.
3. On the project **Overview** page, note your **Project ID** and your
   **API Endpoint** (something like `https://fra.cloud.appwrite.io/v1` —
   the region prefix varies). You'll paste both into `assets/appwrite-config.js`
   at the end.

## 2. Add a Web platform (so the browser is allowed to call the API)

1. In the Console, go to **Settings → Platforms → Add platform → Web app**.
2. Give it a name and set the **Hostname** to wherever you'll host the
   site — e.g. `allvoicessociety.org`, plus a second platform entry for
   `localhost` if you want to test locally before deploying.

## 3. Create the database and tables

1. Go to **Databases → Create database**. Name it (e.g. `avs_content`) and
   note its **Database ID** (you can set a custom one, e.g. `avs_content`,
   or use the generated one).
2. Inside it, create three **Tables** (Appwrite's newer term for what used
   to be called "collections" — rows are the old "documents"):

### Table: `board_members`
| Column | Type | Required | Notes |
|---|---|---|---|
| `name` | String, size 255 | yes | |
| `role` | String, size 255 | no | |
| `bio` | String, size 2000 | no | |
| `photoId` | String, size 64 | no | Appwrite Storage file ID |

### Table: `events`
| Column | Type | Required | Notes |
|---|---|---|---|
| `title` | String, size 255 | yes | |
| `date` | String, size 255 | no | free-text, e.g. "Sat, Sept 12 · 6:00 PM" |
| `description` | String, size 2000 | no | |
| `imageIds` | String, size 64, **Array** | no | up to 5 Storage file IDs |

### Table: `stories`
| Column | Type | Required | Notes |
|---|---|---|---|
| `youtubeUrl` | String, size 500 | yes | |
| `title` | String, size 255 | yes | |
| `description` | String, size 2000 | no | |

For each table, set its **ID** to match what's in `assets/appwrite-config.js`
(`board_members`, `events`, `stories`) — or use your own IDs and update the
config file to match.

### Permissions (each of the 3 tables)
Open each table's **Settings → Permissions** and add:
- **Read** → Role: **Any** (so the public pages can display content without logging in)
- **Create / Update / Delete** → Role: **Team**, choose the `Admins` team you'll create in step 5

## 4. Create the Storage bucket (for photos)

1. Go to **Storage → Create bucket**. Name it `avs_media` (or your own ID —
   just match it in the config file).
2. **Permissions**:
   - **Read** → Role: **Any**
   - **Create / Update / Delete** → Role: **Team → Admins**
3. Optional but recommended: under **File security**, restrict **allowed
   file extensions** to `jpg, jpeg, png, webp`, and set a **max file size**
   (e.g. 10 MB — the site compresses photos before upload, so this is just
   a safety net).

## 5. Create your admin login

1. Go to **Auth → Teams → Create team**. Name it `Admins`.
2. Go to **Auth → Users → Create user**. Enter the email and password you
   (the admin) will sign in with on `admin.html`.
3. Open that user, and add them to the **Admins** team (via the team's
   **Members** tab, or the user's own page — either works).

This is the account that has permission to add/edit/delete content. Anyone
without it can view the site but the admin page will just show read-only
errors if they try to save.

> Want more than one admin? Create more users and add each to the `Admins` team.

## 6. Fill in the config file

Open `assets/appwrite-config.js` and replace the placeholders:

```js
window.AVS_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',   // your endpoint from step 1
  projectId: 'YOUR_PROJECT_ID',                    // your Project ID from step 1
  databaseId: 'avs_content',                        // your Database ID from step 3
  tables: {
    board: 'board_members',
    events: 'events',
    stories: 'stories',
  },
  bucketId: 'avs_media',                             // your bucket ID from step 4
};
```

## 7. Deploy

The site is still just static files — upload the whole folder (including
`assets/`) to whatever static host you're using (Netlify, Vercel, GitHub
Pages, S3, your existing host, etc). There's no build step and no server
process to run; Appwrite *is* the backend now.

To test locally first, just open `index.html` from a local web server
(not `file://`, since browsers block some fetches from `file://`) — e.g.
`npx serve .` — and make sure `localhost` is added as a Web platform
(step 2).

---

## What changed, for reference

- `assets/store.js` no longer touches `localStorage`. It talks to Appwrite's
  `TablesDB` (board members, events, stories) and `Storage` (photos) over
  the network, and exposes the same `AVSStore.getBoard()` /
  `addEvent()` / etc. shape as before — just `async` now.
- `admin.html` no longer has a single shared password baked into the page.
  It signs in with a real Appwrite account (`AVSAuth.login`), and only
  members of the `Admins` team can actually save changes — enforced by
  Appwrite's permissions, not by JavaScript in the browser.
- Photos are uploaded to Appwrite Storage as soon as you pick them in the
  admin forms (compressed client-side first, same as before), and the
  public pages render them via `Storage.getFileView`.
- `index.html`, `events.html`, and `stories.html` just needed their render
  functions to `await` the store calls instead of reading synchronously.

## Troubleshooting

- **"Sign-in failed" on admin.html** — double check the user exists under
  Auth → Users and the password is right. A 401 in the browser console
  with `user_invalid_credentials` means email/password mismatch.
- **Content saves but public pages don't show it** — check the table's
  **Read** permission includes Role: Any.
- **"Could not save" as a non-error-looking team member** — check that
  user is actually a member of the `Admins` team, and that Create/Update/
  Delete permissions on the table/bucket reference that exact team.
- **CORS-looking errors / requests silently failing** — the site's
  hostname isn't registered as a Web platform (step 2). `localhost` and
  your production domain need separate entries.
