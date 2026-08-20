# Hoarder: Media Tracker

Personal media collection tracker. Books, movies, TV, anime, manga, manhwa, games, and more in one list.

## Stack

- Expo SDK 54 + TypeScript (matches App Store Expo Go)
- [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) + [Drizzle ORM](https://orm.drizzle.team/docs/connect-expo-sqlite)

## Run

```bash
npm start
```

Then open in Android emulator, iOS simulator, or Expo Go.

On first launch the app inserts a dummy item and logs it to the Metro console so you can confirm the database layer works. Remove the `seedDummyItemIfEmpty()` call in `src/app/_layout.tsx` when you no longer need that check.

## Schema changes

After editing `src/lib/db/schema.ts`:

```bash
npm run db:generate
```

Migrations live in `src/drizzle/` and run automatically on app start.

## Layout

```
src/app/          screens (list, detail, add/edit)
src/lib/db/       SQLite client, schema, and CRUD
src/drizzle/      generated SQL migrations
```
