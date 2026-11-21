/* ==========================================================================
   All Voices Society — PocketBase configuration
   --------------------------------------------------------------------------
   Every page loads this before assets/store.js.

   `url` is the public address of your PocketBase server (no trailing slash),
   e.g. https://avs-pocketbase.up.railway.app  or  https://api.allvoicessociety.org
   For local testing run `./pocketbase serve` and use http://127.0.0.1:8090.

   Nothing in here is secret. Who may read/write is enforced by the API rules
   on each collection (set up by pb_migrations/ — see SETUP.md).
   ========================================================================== */

window.AVS_CONFIG = {
  url: 'https://all-voice-production.up.railway.app',

  collections: {
    board: 'board_members',
    events: 'events',
    stories: 'stories',
    podcast: 'podcast_episodes',
    shows: 'podcast_shows',
    media: 'media',
    admins: 'admins',
  },

  // Longest board-member bio the admin will accept. Must not exceed the `bio`
  // field's max in PocketBase (set to 5000 by the migration).
  limits: { bioMax: 5000 },
};
