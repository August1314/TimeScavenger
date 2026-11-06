import {
  configureDbForTesting,
  initDb,
  upsertMedia,
  markReviewed,
  fetchUnreviewedRandom,
  addDeletion,
  getStats,
  resetReviewed,
  getSetting,
  setSetting,
  removeMedia,
  setPending,
  fetchPending,
  __testingDb,
  type MediaRow,
} from '../repo';
import { fakeDb } from '../../testlib/fakeDb';

function row(localIdentifier: string, mediaType: MediaRow['mediaType'], extra?: Partial<MediaRow>): MediaRow {
  return {
    localIdentifier, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate: 1700000000000, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null, ...extra,
  };
}

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
});

describe('initDb', () => {
  it('is idempotent', async () => {
    await initDb();
    await upsertMedia([row('L1', 'photo')]);
    expect((await fetchUnreviewedRandom('photo', 10)).length).toBe(1);
  });
});

describe('upsertMedia', () => {
  it('preserves review timestamps when re-upserting metadata', async () => {
    await upsertMedia([row('L1', 'photo')]);
    await markReviewed(['L1'], new Date(1800000000000));
    await upsertMedia([row('L1', 'photo', { width: 4000 })]);
    const got = await fetchUnreviewedRandom('photo', 10);
    expect(got).toHaveLength(0); // 已读状态未被覆盖
    const rows = await __testingDb().getAllAsync<{ width: number }>(
      'SELECT width FROM media WHERE localIdentifier = ?', 'L1',
    );
    expect(rows).toEqual([{ width: 4000 }]); // 元数据已更新
  });
});

describe('fetchUnreviewedRandom', () => {
  it('photo category includes all still types but excludes video', async () => {
    await upsertMedia([
      row('A', 'photo'), row('B', 'screenshot'), row('C', 'selfie'),
      row('D', 'live'), row('E', 'gif'), row('F', 'long'), row('G', 'video'),
    ]);
    const ids = (await fetchUnreviewedRandom('photo', 100)).map((r) => r.localIdentifier).sort();
    expect(ids).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('specific categories match exactly and n limits size', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'screenshot'), row('C', 'screenshot')]);
    expect((await fetchUnreviewedRandom('screenshot', 100)).map((r) => r.localIdentifier).sort()).toEqual(['B', 'C']);
    expect(await fetchUnreviewedRandom('photo', 2)).toHaveLength(2); // photo 分类=全部静态图（3 条）取 2
    expect(await fetchUnreviewedRandom('photo', 10)).toHaveLength(3);
    expect(await fetchUnreviewedRandom('video', 5)).toHaveLength(0);
  });

  it('excludes reviewed items', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'photo')]);
    await markReviewed(['A'], new Date());
    const rest = await fetchUnreviewedRandom('photo', 10);
    expect(rest.map((r) => r.localIdentifier)).toEqual(['B']);
  });
});

describe('resetReviewed', () => {
  it('screenshots scope clears only screenshots', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'screenshot')]);
    await markReviewed(['A', 'B'], new Date());
    await resetReviewed('screenshots');
    const left = await fetchUnreviewedRandom('photo', 10);
    expect(left.map((r) => r.localIdentifier)).toEqual(['B']); // A 仍是已读
  });

  it('photos scope clears still images but not videos; photosNoScreenshots keeps screenshots reviewed', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'screenshot'), row('C', 'video')]);
    await markReviewed(['A', 'B', 'C'], new Date());
    await resetReviewed('photos');
    expect((await fetchUnreviewedRandom('photo', 10)).map((r) => r.localIdentifier).sort()).toEqual(['A', 'B']);
    expect(await fetchUnreviewedRandom('video', 10)).toHaveLength(0);
    await resetReviewed('photosNoScreenshots');
    await markReviewed(['A', 'B', 'C'], new Date());
    await resetReviewed('photosNoScreenshots');
    // 清"照片但不含截屏" → A 变未读，B(截屏) 保持已读
    expect((await fetchUnreviewedRandom('photo', 10)).map((r) => r.localIdentifier)).toEqual(['A']);
  });

  it('all scope clears everything', async () => {
    await upsertMedia([row('A', 'photo'), row('C', 'video')]);
    await markReviewed(['A', 'C'], new Date());
    await resetReviewed('all');
    expect(await fetchUnreviewedRandom('photo', 10)).toHaveLength(1);
    expect(await fetchUnreviewedRandom('video', 10)).toHaveLength(1);
  });
});

describe('getStats', () => {
  it('aggregates viewed/deleted/freed per group', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'screenshot'), row('C', 'video')]);
    await markReviewed(['A', 'B'], new Date());
    await addDeletion({ localIdentifier: 'A', mediaType: 'photo', deletedAt: new Date(), fileSize: 3_000_000 });
    await addDeletion({ localIdentifier: 'B', mediaType: 'screenshot', deletedAt: new Date(), fileSize: 500 });
    await addDeletion({ localIdentifier: 'C', mediaType: 'video', deletedAt: new Date(), fileSize: null });
    const stats = await getStats();
    const photos = stats.find((s) => s.group === 'photos')!;
    const shots = stats.find((s) => s.group === 'screenshots')!;
    const videos = stats.find((s) => s.group === 'videos')!;
    expect(photos).toMatchObject({ viewed: 1, deleted: 1, freedBytes: 3_000_000 });
    expect(shots).toMatchObject({ viewed: 1, deleted: 1, freedBytes: 500 });
    expect(videos).toMatchObject({ viewed: 0, deleted: 1, freedBytes: 0 });
  });
});

describe('settings', () => {
  it('roundtrips and defaults to null', async () => {
    expect(await getSetting('photosPerGroup')).toBeNull();
    await setSetting('photosPerGroup', '15');
    expect(await getSetting('photosPerGroup')).toBe('15');
    await setSetting('photosPerGroup', '20');
    expect(await getSetting('photosPerGroup')).toBe('20');
  });
});

describe('removeMedia', () => {
  it('deletes rows by id and leaves others', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'photo')]);
    await removeMedia(['A']);
    expect((await fetchUnreviewedRandom('photo', 10)).map((r) => r.localIdentifier)).toEqual(['B']);
  });
});

describe('pendingDeletedAt', () => {
  it('setPending marks rows; fetchPending returns them; null clears', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'screenshot'), row('C', 'photo')]);
    await setPending(['A', 'B'], 1700000001000);
    const p = await fetchPending();
    expect(p.map((r) => r.localIdentifier).sort()).toEqual(['A', 'B']);
    await setPending(['A'], null);
    expect((await fetchPending()).map((r) => r.localIdentifier)).toEqual(['B']);
  });

  it('initDb migration is idempotent (double run keeps data)', async () => {
    await upsertMedia([row('A', 'photo')]);
    await initDb();
    await setPending(['A'], 123);
    expect((await fetchPending()).map((r) => r.localIdentifier)).toEqual(['A']);
  });
});
