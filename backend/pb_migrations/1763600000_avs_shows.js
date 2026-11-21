/// <reference path="../pb_data/types.d.ts" />
/*
  Podcast Network → Shows → Episodes
  - new collection `podcast_shows`
  - new field `showId` on `podcast_episodes` (which show an episode belongs to)
  Runs automatically on the next deploy. Existing episodes are kept; they
  simply have no show until you pick one in the admin.
*/
const ADMIN = '@request.auth.collectionName = "admins"';

migrate(
  (app) => {
    app.save(
      new Collection({
        type: 'base',
        name: 'podcast_shows',
        listRule: '',
        viewRule: '',
        createRule: ADMIN,
        updateRule: ADMIN,
        deleteRule: ADMIN,
        fields: [
          { name: 'title', type: 'text', required: true, max: 255 },
          { name: 'host', type: 'text', max: 255 },
          { name: 'description', type: 'text', max: 5000 },
          { name: 'coverId', type: 'text', max: 255 },
          { name: 'sortOrder', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
    );

    const eps = app.findCollectionByNameOrId('podcast_episodes');
    eps.fields.add(new TextField({ name: 'showId', max: 64 }));
    app.save(eps);
  },
  (app) => {
    try {
      const eps = app.findCollectionByNameOrId('podcast_episodes');
      eps.fields.removeByName('showId');
      app.save(eps);
    } catch (e) {}
    try { app.delete(app.findCollectionByNameOrId('podcast_shows')); } catch (e) {}
  }
);
