import {
  configureDbForTesting,
  initDb,
  upsertMedia,
  getStats,
  fetchUnreviewedRandom,
  type MediaRow,
} from '../../db/repo';
import { fakeDb } from '../../testlib/fakeDb';
import { pendingQueue, commitPending, type DeletionDeps } from '../deletion';

function row(id: string, mediaType: MediaRow['mediaType'] = 'photo'): MediaRow {
  return {
    localIdentifier: id, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate: 1700000000000, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null,
  };
}

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
  pendingQueue.discardAll();
});

describe('PendingQueue', () => {
  it('push dedupes by id; remove and discardAll work', () => {
    pendingQueue.push(row('A'));
    pendingQueue.push(row('A'));
    pendingQueue.push(row('B', 'screenshot'));
    expect(pendingQueue.list().map((r) => r.localIdentifier)).toEqual(['A', 'B']);
    pendingQueue.remove('A');
    expect(pendingQueue.list().map((r) => r.localIdentifier)).toEqual(['B']);
    pendingQueue.discardAll();
    expect(pendingQueue.list()).toHaveLength(0);
  });
});

describe('commitPending', () => {
  it('records deletions with measured size and clears queue & media rows', async () => {
    await upsertMedia([row('A'), row('B', 'screenshot')]);
    pendingQueue.push(row('A'));
    pendingQueue.push(row('B', 'screenshot'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ids, failed: [] }),
      measureSize: async (id) => (id === 'A' ? 2_000_000 : null),
    };
    const res = await commitPending(['A', 'B'], deps);
    expect(res.deleted.sort()).toEqual(['A', 'B']);
    expect(res.failed).toHaveLength(0);
    expect(pendingQueue.list()).toHaveLength(0);
    expect(await fetchUnreviewedRandom('photo', 10)).toHaveLength(0); // media 行已清
    const stats = await getStats();
    expect(stats.find((s) => s.group === 'photos')).toMatchObject({ deleted: 1, freedBytes: 2_000_000 });
    expect(stats.find((s) => s.group === 'screenshots')).toMatchObject({ deleted: 1, freedBytes: 0 });
  });

  it('failed items stay in queue and are not recorded', async () => {
    await upsertMedia([row('A'), row('B')]);
    pendingQueue.push(row('A'));
    pendingQueue.push(row('B'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ['A'], failed: ids.filter((i) => i !== 'A').map((id) => ({ id, error: '系统未弹出确认' })) }),
      measureSize: async () => 1000,
    };
    const res = await commitPending(['A', 'B'], deps);
    expect(res.deleted).toEqual(['A']);
    expect(res.failed[0]).toMatchObject({ id: 'B', error: '系统未弹出确认' });
    expect(pendingQueue.list().map((r) => r.localIdentifier)).toEqual(['B']);
  });

  it('only commits the selected subset', async () => {
    await upsertMedia([row('A'), row('B')]);
    pendingQueue.push(row('A'));
    pendingQueue.push(row('B'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ids, failed: [] }),
      measureSize: async () => 5,
    };
    const res = await commitPending(['A'], deps);
    expect(res.deleted).toEqual(['A']);
    expect(pendingQueue.list().map((r) => r.localIdentifier)).toEqual(['B']);
  });
});
