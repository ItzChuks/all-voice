# all-voice

## Running it locally

The site uses clean URLs (`/board`, `/member?id=...`, not `/board.html`).
Real hosts (Netlify via `_redirects`, Vercel via `vercel.json`) handle that.
Locally, `dev-server.js` does the same thing.

**Start it (pick one):**

- VS Code: press `Ctrl+Shift+B` (`Cmd+Shift+B` on Mac). It also starts by
  itself when you open the folder — click **Allow** the first time VS Code asks
  about automatic tasks.
- Terminal: `npm run dev` (or `npm run dev:open` to also open the browser).

Then open **http://localhost:5500** in Chrome/Firefox/Edge. Every page works
without `.html`, `/about.html` redirects to `/about`, and open tabs reload
when you save a file. If port 5500 is busy it picks the next free one and
prints the address.

**Use `localhost`, not `127.0.0.1`.** Appwrite only accepts the hostnames
registered under Settings -> Platforms. If you see "Failed to fetch" or empty
lists, this is the first thing to check.

**Live Server extension:** links still work (`assets/localdev.js` rewrites
them to `.html` when it detects a server without clean URLs), but typing
`/board` in the address bar can't work there. Use `npm run dev` for that.

**VS Code's Simple Browser / Live Preview panel** blocks the page's scripts.
Use a real browser tab.

See `SETUP.md` for wiring the site up to Appwrite (board members, events,
stories, podcasts all live there, not in this repo).