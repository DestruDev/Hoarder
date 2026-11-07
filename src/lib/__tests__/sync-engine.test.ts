import { describe, expect, it } from 'vitest';

import { Device, FakeServer, serverSnapshot } from './sync-harness';

const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BOB = '00000000-0000-4000-8000-0000000000b0';

function setup(options?: ConstructorParameters<typeof Device>[1]) {
  const server = new FakeServer();
  return { server, phone: new Device(server, options), laptop: new Device(server, options) };
}

describe('sync: basics', () => {
  it('copies a new item from one device to another', async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE, { title: 'Frieren' });

    await phone.sync(ALICE);
    const result = await laptop.sync(ALICE);

    expect(result.changed).toBe(true);
    expect(laptop.item(id)?.title).toBe('Frieren');
  });

  it("doesn't upload rows it just downloaded", async () => {
    const { server, phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);
    const stamped = server.row('items', id)?.server_updated_at;

    await laptop.sync(ALICE);
    const again = await laptop.sync(ALICE);

    expect(again).toEqual({ pushed: 0, changed: false });
    expect(server.row('items', id)?.server_updated_at).toBe(stamped);
  });

  it("doesn't upload a downloaded update to a row it already had", async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    phone.editItem(id, { status: 'completed' });
    await phone.sync(ALICE);
    await laptop.sync(ALICE); // applies the update

    expect(laptop.item(id)?.status).toBe('completed');
    expect(await laptop.sync(ALICE)).toEqual({ pushed: 0, changed: false });
  });

  it('only sends columns the server has (never the local id or sync_seq)', async () => {
    const { server, phone } = setup();
    const id = phone.addItem(ALICE);

    await phone.sync(ALICE); // the fake server throws on unknown columns

    expect(server.row('items', id)).not.toHaveProperty('sync_seq');
    expect(server.row('items', id)).not.toHaveProperty('id');
  });
});

describe('sync: conflicts (last write wins on updated_at)', () => {
  it('converges on the newest edit when two offline devices edit the same item', async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE, { title: 'Original' });
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    phone.editItem(id, { title: 'Phone edit' }, 1000);
    laptop.clock = phone.clock;
    laptop.editItem(id, { title: 'Laptop edit' }, 5000); // later

    await phone.sync(ALICE);
    await laptop.sync(ALICE);
    await phone.sync(ALICE);

    expect(phone.item(id)?.title).toBe('Laptop edit');
    expect(laptop.item(id)?.title).toBe('Laptop edit');
  });

  it("doesn't let an older edit that syncs late overwrite a newer one", async () => {
    const { server, phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    phone.editItem(id, { status: 'dropped' }, 1000); // older, stays offline
    laptop.clock = phone.clock;
    laptop.editItem(id, { status: 'completed' }, 5000);
    await laptop.sync(ALICE);

    await phone.sync(ALICE);

    expect(server.row('items', id)?.status).toBe('completed');
    expect(phone.item(id)?.status).toBe('completed');
  });

  it('settles exact-timestamp ties on the version the server kept', async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    laptop.clock = phone.clock;
    phone.editItem(id, { title: 'Phone' }, 1000);
    laptop.editItem(id, { title: 'Laptop' }, 1000); // same millisecond

    await phone.sync(ALICE); // reaches the server first, so it's kept
    await laptop.sync(ALICE);

    expect(laptop.item(id)?.title).toBe('Phone');
  });

  it('keeps an edit made after downloading from a device whose clock runs ahead', async () => {
    const { server, phone, laptop } = setup();
    laptop.clock += 10 * 60 * 1000; // laptop is 10 minutes fast
    const id = laptop.addItem(ALICE, { title: 'From laptop' });
    await laptop.sync(ALICE);
    await phone.sync(ALICE);

    phone.editItem(id, { title: 'Edited on phone' }); // phone clock says earlier
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    expect(server.row('items', id)?.title).toBe('Edited on phone');
    expect(laptop.item(id)?.title).toBe('Edited on phone');
  });

  it('propagates deletes, and an older offline edit does not bring the item back', async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    laptop.clock = phone.clock;
    laptop.editItem(id, { title: 'Edited offline' }, 1000);
    phone.deleteItem(id, 5000); // later
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    expect(laptop.item(id)?.deleted_at).not.toBeNull();
    expect(phone.item(id)?.deleted_at).not.toBeNull();
  });

  it("doesn't create a local copy of an item that was deleted before this device saw it", async () => {
    const { phone, laptop } = setup();
    const id = phone.addItem(ALICE);
    phone.deleteItem(id);
    await phone.sync(ALICE);

    await laptop.sync(ALICE);

    expect(laptop.item(id)).toBeUndefined();
  });

  it('syncs the one-row-per-account tables (profile) the same way', async () => {
    const { phone, laptop } = setup();
    phone.setProfileName(ALICE, 'Alice');
    await phone.sync(ALICE);
    await laptop.sync(ALICE);

    laptop.setProfileName(ALICE, 'Alice B.', 5000);
    await laptop.sync(ALICE);
    await phone.sync(ALICE);

    expect(phone.profileName(ALICE)).toBe('Alice B.');
  });
});

describe('sync: uploads survive failures and bad clocks', () => {
  it('retries a failed upload on the next sync without losing anything', async () => {
    const { server, phone } = setup({ pushChunk: 2, pullPage: 3 });
    const ids = [1, 2, 3, 4, 5].map(() => phone.addItem(ALICE));
    server.failUpload(1); // second chunk fails

    await expect(phone.sync(ALICE)).rejects.toThrow('Push to items failed: network error');
    await phone.sync(ALICE);

    for (const id of ids) {
      expect(server.row('items', id)).toBeDefined();
    }
  });

  it('uploads every row even when several share the same updated_at', async () => {
    const { server, phone } = setup({ pushChunk: 2, pullPage: 3 });
    // Bulk writes in one millisecond, like a seed or an import.
    const ids = [1, 2, 3, 4, 5].map(() => phone.addItem(ALICE, {}, 0));
    server.failUpload(1);

    await expect(phone.sync(ALICE)).rejects.toThrow();
    await phone.sync(ALICE);

    expect(ids.filter((id) => !server.row('items', id))).toEqual([]);
  });

  it('still uploads new items after the device clock jumps backwards', async () => {
    const { server, phone } = setup();
    phone.addItem(ALICE);
    await phone.sync(ALICE);

    phone.clock -= 24 * 60 * 60 * 1000; // clock corrected back a day
    const id = phone.addItem(ALICE);
    await phone.sync(ALICE);

    expect(server.row('items', id)).toBeDefined();
  });
});

describe('sync: downloads', () => {
  it('pages through more rows than fit in one page', async () => {
    const { phone, laptop } = setup({ pushChunk: 2, pullPage: 3 });
    const ids = Array.from({ length: 10 }, () => phone.addItem(ALICE));
    await phone.sync(ALICE);

    await laptop.sync(ALICE);

    expect(ids.filter((id) => !laptop.item(id))).toEqual([]);
  });

  // server_updated_at is a transaction's *start* time. An upload that starts
  // first but commits last becomes visible with a timestamp older than rows
  // another device has already pulled past.
  it('catches a change that commits late with an earlier server timestamp', async () => {
    const { server, phone, laptop } = setup();
    const slowRow = { ...rowFor(phone, phone.addItem(ALICE, { title: 'Slow upload' })) };
    const startedAt = server.tick(); // slow transaction begins...

    laptop.addItem(ALICE);
    await laptop.sync(ALICE); // ...a later one commits, and laptop pulls past it

    server.commit('items', [slowRow], 'sync_id', startedAt); // slow one commits now
    await laptop.sync(ALICE);

    expect(laptop.item(String(slowRow.sync_id))?.title).toBe('Slow upload');
  });

  it('would miss that late commit without the overlap window', async () => {
    const { server, phone, laptop } = setup({ pullOverlapMs: 0 });
    const slowRow = { ...rowFor(phone, phone.addItem(ALICE, { title: 'Slow upload' })) };
    const startedAt = server.tick();

    laptop.addItem(ALICE);
    await laptop.sync(ALICE);

    server.commit('items', [slowRow], 'sync_id', startedAt);
    await laptop.sync(ALICE);

    expect(laptop.item(String(slowRow.sync_id))).toBeUndefined();
  });
});

describe('sync: accounts', () => {
  it('keeps two accounts on the same device separate', async () => {
    const { server, phone, laptop } = setup();
    const aliceItem = phone.addItem(ALICE);
    await phone.sync(ALICE);

    phone.addItem(BOB);
    await phone.sync(BOB);
    await laptop.sync(BOB);

    expect(serverSnapshot(server, BOB)).toHaveLength(1);
    expect(laptop.item(aliceItem)).toBeUndefined();
  });
});

describe('sync: convergence', () => {
  // Random offline edits on two devices, with syncs at random moments and
  // clocks that often collide. After both devices sync, they and the server
  // must hold exactly the same data.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`devices end up identical after random edits (seed ${seed})`, async () => {
      const random = mulberry32(seed);
      const server = new FakeServer();
      const devices = [new Device(server, { pushChunk: 3, pullPage: 4 }), new Device(server, { pushChunk: 3, pullPage: 4 })];
      const ids: string[] = [];

      for (let step = 0; step < 150; step += 1) {
        const device = devices[Math.floor(random() * devices.length)]!;
        // 0-2ms steps make same-millisecond writes across devices common.
        const advance = Math.floor(random() * 3);
        const roll = random();

        if (roll < 0.2 || ids.length === 0) {
          ids.push(device.addItem(ALICE, { title: `t${step}` }, advance));
        } else if (roll < 0.65) {
          const id = ids[Math.floor(random() * ids.length)]!;
          if (device.item(id)) {
            device.editItem(id, random() < 0.5 ? { title: `t${step}` } : { status: pick(random, STATUSES) }, advance);
          }
        } else if (roll < 0.75) {
          const id = ids[Math.floor(random() * ids.length)]!;
          if (device.item(id)) {
            device.deleteItem(id, advance);
          }
        } else {
          await device.sync(ALICE);
        }
      }

      // Settle: a full round so every device has pushed and pulled everything.
      for (const device of [...devices, ...devices]) {
        await device.sync(ALICE);
      }

      const expected = serverSnapshot(server, ALICE);
      for (const device of devices) {
        expect(device.snapshot(ALICE)).toEqual(expected);
      }
    });
  }
});

const STATUSES = ['planning', 'in_progress', 'completed', 'dropped'];

function rowFor(device: Device, syncId: string) {
  const { id: _id, sync_seq: _seq, ...row } = device.item(syncId)!;
  return row;
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

// Small seeded PRNG so failures are reproducible.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
