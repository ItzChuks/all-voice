/// <reference path="../pb_data/types.d.ts" />
/*
  All Voices Society — creates every collection the site needs.

  PocketBase runs this automatically the first time you start it with this
  pb_migrations folder next to the binary:   ./pocketbase serve

  Rules:
    - everyone can READ content and media (public website)
    - only signed-in records of the `admins` auth collection can write
      (PocketBase superusers can always do everything)
*/
const ADMIN = '@request.auth.collectionName = "admins"';

const stamps = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

const publicRules = {
  listRule: '',
  viewRule: '',
  createRule: ADMIN,
  updateRule: ADMIN,
  deleteRule: ADMIN,
};

migrate(
  (app) => {
    // ---- admins (auth) ----
    const admins = new Collection({
      type: 'auth',
      name: 'admins',
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: null, // only superusers create admins (Dashboard → admins → New record)
      updateRule: 'id = @request.auth.id',
      deleteRule: null,
      fields: [{ name: 'name', type: 'text', max: 120 }, ...stamps()],
    });
    app.save(admins);

    // ---- media (photos) ----
    app.save(
      new Collection({
        type: 'base',
        name: 'media',
        ...publicRules,
        updateRule: null,
        fields: [
          {
            name: 'file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 10 * 1024 * 1024,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            thumbs: ['400x400', '800x0'],
          },
          ...stamps(),
        ],
      })
    );

    // ---- board_members ----
    app.save(
      new Collection({
        type: 'base',
        name: 'board_members',
        ...publicRules,
        fields: [
          { name: 'name', type: 'text', required: true, max: 255 },
          { name: 'role', type: 'text', max: 255 },
          { name: 'bio', type: 'text', max: 5000 },
          { name: 'photoId', type: 'text', max: 255 },
          ...stamps(),
        ],
      })
    );

    // ---- events ----
    app.save(
      new Collection({
        type: 'base',
        name: 'events',
        ...publicRules,
        fields: [
          { name: 'title', type: 'text', required: true, max: 255 },
          { name: 'date', type: 'text', max: 255 },
          { name: 'description', type: 'text', max: 5000 },
          { name: 'imageIds', type: 'json', maxSize: 20000 },
          ...stamps(),
        ],
      })
    );

    // ---- stories ----
    app.save(
      new Collection({
        type: 'base',
        name: 'stories',
        ...publicRules,
        fields: [
          { name: 'youtubeUrl', type: 'text', required: true, max: 500 },
          { name: 'title', type: 'text', required: true, max: 255 },
          { name: 'description', type: 'text', max: 5000 },
          ...stamps(),
        ],
      })
    );

    // ---- podcast_episodes ----
    app.save(
      new Collection({
        type: 'base',
        name: 'podcast_episodes',
        ...publicRules,
        fields: [
          { name: 'platform', type: 'select', required: true, maxSelect: 1, values: ['youtube', 'spotify', 'apple', 'custom'] },
          { name: 'url', type: 'text', required: true, max: 1000 },
          { name: 'links', type: 'json', maxSize: 20000 },
          { name: 'title', type: 'text', required: true, max: 255 },
          { name: 'description', type: 'text', max: 5000 },
          { name: 'isPlaylist', type: 'bool' },
          { name: 'playlistId', type: 'text', max: 64 },
          ...stamps(),
        ],
      })
    );
  },
  (app) => {
    for (const name of ['podcast_episodes', 'stories', 'events', 'board_members', 'media', 'admins']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (e) {}
    }
  }
);
