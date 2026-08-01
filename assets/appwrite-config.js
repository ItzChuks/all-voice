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
  },
  bucketId: 'avs_media',
};