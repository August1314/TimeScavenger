import {
  configureDbForTesting,
  initDb,
  upsertMedia,
  getStats,
  fetchUnreviewedRandom,
  type MediaRow,
} from '../../db/repo';
import { fakeDb } from '../../testlib/fakeDb';
import { PendingQueue, commitPending, classifyDeleteError, type DeletionDeps } from '../deletion';

function row(id: string, mediaType: MediaRow['mediaType'] = 'photo'): MediaRow {
  return {
    localIdentifier: id, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate: 1700000000000, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null,
  };
}

let queue: PendingQueue;

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
  queue = new PendingQueue();
});

describe('PendingQueue (DB-backed)', () => {
  it('push dedupes, remove and discardAll work', async () => {
    await queue.push(row('A'));
    await queue.push(row('A'));
    await queue.push(row('B', 'screenshot'));
    expect((await queue.list()).map((r) => r.localIdentifier)).toEqual(['A', 'B']);
    await queue.remove('A');
    expect((await queue.list()).map((r) => r.localIdentifier)).toEqual(['B']);
    await queue.discardAll();
    expect(await queue.list()).toHaveLength(0);
  });

  it('survives restart: new instance hydrate() restores items', async () => {
    await upsertMedia([row('A'), row('B', 'screenshot')]);
    await queue.push(row('A'));
    await queue.push(row('B', 'screenshot'));
    const revived = new PendingQueue();
    await revived.hydrate();
    expect((await revived.list()).map((r) => r.localIdentifier).sort()).toEqual(['A', 'B']);
    await revived.remove('A');
    const again = new PendingQueue();
    await again.hydrate();
    expect((await again.list()).map((r) => r.localIdentifier)).toEqual(['B']);
  });
});

describe('commitPending', () => {
  it('records deletions with measured size and clears queue & media rows', async () => {
    await upsertMedia([row('A'), row('B', 'screenshot')]);
    await queue.push(row('A'));
    await queue.push(row('B', 'screenshot'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ids, failed: [] }),
      measureSize: async (id) => (id === 'A' ? 2_000_000 : null),
    };
    const res = await commitPending(['A', 'B'], deps, queue);
    expect(res.deleted.sort()).toEqual(['A', 'B']);
    expect(res.failed).toHaveLength(0);
    expect(await queue.list()).toHaveLength(0);
    expect(await fetchUnreviewedRandom('photo', 10)).toHaveLength(0);
    const stats = await getStats();
    expect(stats.find((s) => s.group === 'photos')).toMatchObject({ deleted: 1, freedBytes: 2_000_000 });
    expect(stats.find((s) => s.group === 'screenshots')).toMatchObject({ deleted: 1, freedBytes: 0 });
  });

  it('failed items stay in queue and are not recorded', async () => {
    await upsertMedia([row('A'), row('B')]);
    await queue.push(row('A'));
    await queue.push(row('B'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ['A'], failed: ids.filter((i) => i !== 'A').map((id) => ({ id, error: '系统未弹出确认' })) }),
      measureSize: async () => 1000,
    };
    const res = await commitPending(['A', 'B'], deps, queue);
    expect(res.deleted).toEqual(['A']);
    expect(res.failed[0]).toMatchObject({ id: 'B', error: '系统未弹出确认' });
    expect((await queue.list()).map((r) => r.localIdentifier)).toEqual(['B']);
  });

  it('only commits the selected subset', async () => {
    await upsertMedia([row('A'), row('B')]);
    await queue.push(row('A'));
    await queue.push(row('B'));
    const deps: DeletionDeps = {
      deleteAssets: async (ids) => ({ succeeded: ids, failed: [] }),
      measureSize: async () => 5,
    };
    const res = await commitPending(['A'], deps, queue);
    expect(res.deleted).toEqual(['A']);
    expect((await queue.list()).map((r) => r.localIdentifier)).toEqual(['B']);
  });
});

describe('classifyDeleteError', () => {
  it('classifies iOS cancel', () => {
    expect(classifyDeleteError('PHAsset deletion was canceled', 'ios')).toBe('cancelled');
  });
  it('classifies Android MediaStore denial', () => {
    expect(classifyDeleteError('User did not grant permission for the delete request', 'android')).toBe('cancelled');
  });
  it('classifies Android wrapped rejection (device-verified message)', () => {
    expect(classifyDeleteError("Call to function 'Asset.delete' has been rejected.", 'android')).toBe('cancelled');
  });
  it('does not treat generic rejection as cancel on iOS', () => {
    expect(classifyDeleteError("Call to function 'Asset.delete' has been rejected.", 'ios')).toBe('failed');
  });
  it('keeps unknown errors as failed', () => {
    expect(classifyDeleteError('EACCES', 'android')).toBe('failed');
  });
});
