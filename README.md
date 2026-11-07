# Hoarder: Media Tracker

Personal media collection tracker. Books, movies, TV, anime, manga, manhwa, games, and more in one list.

## Stack

- React Native + Expo SDK 54 + TypeScript (matches App Store Expo Go)
- [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) + [Drizzle ORM](https://orm.drizzle.team/docs/connect-expo-sqlite)

## Run

```bash
npm start
```

Then open in Android emulator, iOS simulator, or Expo Go.

## Sync

Offline-first: the app reads and writes local SQLite, and a background sync reconciles it with Supabase so your library follows your account across devices. Design, conflict rules and trade-offs: [docs/sync.md](docs/sync.md).

## Tests

```bash
npm test
```

Runs the sync engine tests (Vitest) against real SQLite built from the app's migrations. Server-side SQL tests live in `supabase/tests/`; see [docs/sync.md](docs/sync.md#tests).

## Schema changes

After editing `src/lib/db/schema.ts`:

```bash
npm run db:generate
```

Migrations live in `src/drizzle/` and run automatically on app start.

## Layout

```
src/app/(tabs)/   Home, Library, Explore, Profile, Settings
src/app/          item detail and add/edit (stack over tabs)
src/lib/db/       SQLite client, schema, and CRUD
src/drizzle/      generated SQL migrations
```
