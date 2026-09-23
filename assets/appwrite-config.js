/* ==========================================================================
   All Voices Society — Appwrite configuration
   --------------------------------------------------------------------------
   Fill in the values below after you've followed SETUP.md. Every page loads
   this file before assets/store.js, so it must load first in every HTML
   file (index.html, events.html, stories.html, admin.html).

   Nothing in here is secret — the Project ID, database ID, table IDs and
   bucket ID are all meant to be public and visible in browser code. Access
   control is enforced by the permissions you set in the Appwrite Console,
   not by hiding these values.
   ========================================================================== */

window.AVS_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: '6a6a534f897f8951b70e',
  databaseId: 'avs_content',
  tables: {
    board: 'board_members',
    events: 'events',
    stories: 'stories',
    podcast: 'podcast_episodes',
  },
  bucketId: 'avs_media',

  // Longest board-member bio the admin will accept. This must not be more than
  // the size of the `bio` column in Appwrite (Databases -> avs_content ->
  // board_members -> Columns -> bio). To allow longer bios, raise the column
  // size there first, then raise this number to match.
  limits: { bioMax: 2000 },
};