# Offline-first sync

Hoarder works fully offline. Each device keeps the account's library, profile, settings and saved filters in local SQLite, and the app reads and writes only that local copy. A background sync reconciles it with Supabase (Postgres), so the data follows the account across devices.

This doc covers how sync works, how conflicts are resolved, the failure cases it handles, and the trade-offs it makes.

## At a glance

```
 Device (SQLite)                                     Supabase (Postgres)
 ───────────────                                     ───────────────────
 App write ─► row.updated_at = device time
              (bumped past the previous value if
               the clock is behind)
              row.sync_seq   = ++device counter

 Push   rows WHERE sync_seq > last pushed ── upsert ─► BEFORE trigger:
                                                       skip unless updated_at is newer
                                                       server_updated_at := now()

 Pull   rows WHERE server_updated_at ◄────────────── RLS: only the account's rows
          >= last pulled − 60s
        apply if newer than local
        (exact tie: the server's copy wins)
```

Two clocks are involved, and each has one job:

| Column | Set by | Used for |
| --- | --- | --- |
| `updated_at` | the device that made the edit | deciding conflicts (last write wins) |
| `server_updated_at` | Postgres, on every accepted write | knowing what to download |
| `sync_seq` (local only) | SQLite triggers, on every local write | knowing what to upload |

Conflicts are decided by when the user made the edit. What to upload and download is decided by counters the device's clock can't skew.

## Data model

Synced tables: `items`, `saved_filters` (keyed by a client-generated UUID, `sync_id`) and `profiles`, `app_settings` (one row per account, keyed by `user_id`). Column names match on both sides. A few columns exist on one side only:

- `id`: local autoincrement, never leaves the device.
- `sync_seq`: local upload counter ([migration 0031](../src/drizzle/0031_sync_change_seq.sql)).
- `server_updated_at`: server only ([sync migration](../supabase/migrations/20261105000000_sync.sql)).
- `deleted_at`: soft delete. Deleting sets it instead of removing the row, so the deletion syncs like any other edit.

## When sync runs

On sign-in, when the app returns to the foreground, and 2 seconds after the last local write (debounced). One pass at a time. A request made mid-pass queues exactly one more pass, for the latest account. Failures (offline, timeouts) are logged and retried on the next trigger, while the app keeps working from local data. Wiring: [`sync.ts`](../src/lib/sync.ts). Engine: [`sync-engine.ts`](../src/lib/sync-engine.ts).

Each pass handles each table in turn: push, then pull.

## Push

1. Select the account's rows with `sync_seq` above the last value pushed for that table, in `sync_seq` order.
2. Upsert them in chunks of 500. Each chunk is one request, and so one Postgres transaction.
3. After each successful chunk, save the chunk's last `sync_seq` as the cursor.

`sync_seq` comes from a device-wide counter that triggers bump on every app insert or update. It's strictly increasing and unique, which matters in three ways:

- **Changing the device clock can't hide an edit.** Under the original design, which selected `updated_at > last pushed`, an edit made after the clock was set back was never uploaded.
- **Rows sharing a millisecond can't be skipped** at a chunk boundary or a failed upload.
- **A failed chunk is simply retried.** Rows the server already has are no-ops (see conflicts below), so nothing is lost or duplicated.

Rows written *by sync* (downloads) set `sync_seq` to 0 or −1. The triggers ignore those writes and they're never uploaded, so downloads don't bounce back to the server.

## Pull

1. Request the account's rows with `server_updated_at >= cursor − 60s`, ordered by (`server_updated_at`, key), 1000 per page.
2. Apply each row if it wins against the local copy (below).
3. Advance the cursor to the last row's `server_updated_at`, then page on from exactly there.

Two details:

- **`>=`, not `>`.** One push transaction's rows share a `server_updated_at`. If a page ends partway through such a batch, `>=` re-reads the boundary instead of skipping the rest. Paging can only move forward once a page ends on a later timestamp, so the page size (1000) must exceed the push chunk (500).
- **The 60-second overlap.** `now()` in Postgres is the transaction's *start* time, and transactions don't commit in start order. Upload A can start, upload B can start and commit, a device can pull past B, and then A commits with a timestamp *older* than that device's cursor. A strict cursor would never see A. Re-reading the last minute on each pull catches it, and re-applying a row is a no-op. A minute is generous: Supabase cancels authenticated statements after 8 seconds. Only the first page reaches back, so the overlap can't stall paging.

## Conflict resolution

**Last write wins, per row, on `updated_at`.**

- **Server** ([trigger](../supabase/migrations/20261105000001_sync_skip_echo.sql)): an upsert whose `updated_at` isn't strictly newer than the stored row is skipped. That also makes re-sent rows (retries, echoes) free: they don't bump `server_updated_at`, so other devices don't re-download them.
- **Device**: a downloaded row replaces the local copy if its `updated_at` is newer. On an **exact tie with different contents**, the server's copy wins. The server kept whichever write reached it first, and the device adopts it. Without this, two devices that wrote in the same millisecond would each keep their own version forever.
- **Edits always move forward.** If the device clock is *behind* the version it's replacing (the version came from a device with a fast clock), a trigger stamps the edit 1 ms after that version instead. Without this, the server would reject the edit as older, and the editing device, already past the winning row, would never re-download it: a permanent split. It also matches what the user did, which was edit *after* seeing that version.
- **Deletes are edits.** A delete newer than an edit wins on every device. An older offline edit can't bring the item back. A device that never had an item doesn't create a local copy just to record its deletion.

## Accounts and security

- **Row-level security** limits every synced table to `auth.uid() = user_id`. `user_id` defaults to `auth.uid()` server-side. A client can't read, create or overwrite another account's rows, even with a newer `updated_at`. `profiles` is also readable by signed-in users for the social feature, but writes stay owner-only.
- **Cursors are stored per account and table** (`sync:<user>:<table>:pushedSeq|pulledAt`), so two accounts on one device sync independently.
- **Rows created before accounts existed** have no owner. The first account to sign in on that device claims them.

## Failure cases

| Scenario | What happens | Covered by |
| --- | --- | --- |
| Offline for days, then reconnect | Everything since the last push uploads. Server-side conflicts resolve by `updated_at` | `sync-engine.test.ts`: conflicts |
| Two devices edit the same item offline | Both converge on the newer edit | "converges on the newest edit…" |
| Old edit syncs after a newer one | Skipped by the server. The stale device downloads the winner | "doesn't let an older edit…" |
| Same-millisecond edits on two devices | Server keeps the first to arrive. The other device adopts it | "settles exact-timestamp ties…" |
| Device clock behind the version it edits | Edit is stamped just after that version and wins | "keeps an edit made after downloading…" |
| Device clock set back | New edits still upload (`sync_seq`, not time) | "still uploads new items after the device clock jumps backwards" |
| Upload fails partway through | Next sync resumes. Nothing lost | "retries a failed upload…", "uploads every row even when several share…" |
| Transaction commits after a later one | Caught by the 60 s pull overlap | "catches a change that commits late…" (and its counterpart showing the miss without the overlap) |
| More changes than one page | Paged with a `>=` cursor | "pages through more rows…" |
| Downloads uploaded back | Never: downloads aren't stamped with `sync_seq` | "doesn't upload rows it just downloaded", "…a downloaded update…" |
| Another account's data | RLS rejects reads and writes | `supabase/tests/sync_lww.sql` |
| Random interleavings | Devices and server end up identical | "devices end up identical after random edits" (8 seeds) |

## Trade-offs and known limitations

- **Whole-row last write wins.** If two devices edit *different* fields of the same item while both are offline (status on the phone, notes on the laptop), the older edit's fields are lost. Per-field timestamps or CRDTs (Yjs, Automerge) would merge them, at the cost of much more bookkeeping. For a personal tracker, where conflicting offline edits to the same item are rare, a whole row is a reasonable unit.
- **Wall clocks decide conflicts.** A device whose clock runs fast wins conflicts it shouldn't. The monotonic-edit rule makes a slow device's *later* edits win, but two devices editing independently are still ordered by their clocks. Hybrid logical clocks or server-assigned versions (optimistic concurrency: each write carries the version it was based on, and the server rejects stale bases) would fix this, at the cost of conflict handling in the client. The server could also clamp `updated_at` to a few minutes past its own `now()` to cap the damage from a wildly wrong clock.
- **Tombstones are kept forever.** Soft-deleted rows stay on the server and on devices that saw them. That's fine at personal-library scale; a large dataset would need tombstone expiry, plus a full resync for devices offline longer than the expiry.
- **Not real-time.** Changes from other devices arrive when this device next syncs: foreground, after an edit, or sign-in. Supabase Realtime could push them, but the sync protocol wouldn't change.
- **Upgrading re-uploads once.** Migration 0031 gives every existing row a starting `sync_seq`, so the first sync after upgrading re-sends the library. The server skips it all as unchanged.

## Tests

```bash
npm test                                                                  # client engine (Vitest)
npx supabase db query --remote --yes -f supabase/tests/sync_lww.sql       # server rules
npx supabase db query --remote --yes -f supabase/tests/social_rls.sql     # social feed RLS
```

- **[`sync-engine.test.ts`](../src/lib/__tests__/sync-engine.test.ts)** runs the real engine against a real SQLite database built from the app's own migrations, on each simulated device, with an in-memory server that follows the same rules as the Postgres trigger ([`sync-harness.ts`](../src/lib/__tests__/sync-harness.ts)). Tests drive device clocks, server transaction timing and upload failures directly. A seeded randomized test runs 150 random offline edits, deletes and syncs across two devices, with frequent same-millisecond writes, and checks that both devices and the server end with identical data.
- **[`sync_lww.sql`](../supabase/tests/sync_lww.sql)** checks the real Postgres rules: newer wins, older and equal are skipped, `server_updated_at` can't be forged, soft deletes stick, and RLS keeps accounts apart. It runs in a transaction that's rolled back.

Each safeguard was checked by removing it and confirming its test fails: the tie rule, the download marker, the pull overlap and the monotonic-edit trigger.
