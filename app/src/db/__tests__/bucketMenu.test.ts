import {
  configureDbForTesting,
  initDb,
  upsertMedia,
  markReviewed,
  fetchUnreviewedRandom,
  countUnreviewed,
  fetchBucketCounts,
  filterAggregateBuckets,
  ALL_BUCKET,
  type MediaRow,
} from '../repo';
import { fakeDb } from '../../testlib/fakeDb';

function row(id: string, mediaType: MediaRow['mediaType'], extra?: Partial<MediaRow>): MediaRow {
  return {
    localIdentifier: id, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate: 1700000000000, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null, ...extra,
  };
}

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
});

describe('bucket-filter queries', () => {
  beforeEach(async () => {
    await upsertMedia([
      row('c1', 'photo', { bucket: 'Camera' }),
      row('c2', 'long', { bucket: 'Camera' }),
      row('w1', 'photo', { bucket: 'WeiXin' }),
      row('v1', 'video', { bucket: 'Camera' }),
      row('n1', 'photo'),
    ]);
  });

  it('无 bucket = 旧行为：photo 类含 long、排除 video', async () => {
    const ids = (await fetchUnreviewedRandom('photo', 10)).map((r) => r.localIdentifier).sort();
    expect(ids).toEqual(['c1', 'c2', 'n1', 'w1']);
  });

  it('bucket 过滤只返回该夹', async () => {
    const ids = (await fetchUnreviewedRandom('photo', 10, 'Camera')).map((r) => r.localIdentifier).sort();
    expect(ids).toEqual(['c1', 'c2']);
  });

  it("bucket='all'/null/undefined = 不加条件", async () => {
    expect((await fetchUnreviewedRandom('photo', 10, ALL_BUCKET)).length).toBe(4);
    expect((await fetchUnreviewedRandom('photo', 10, null)).length).toBe(4);
  });

  it('countUnreviewed 与 feed 同口径（长图计入）', async () => {
    expect(await countUnreviewed('photo')).toBe(4);
    expect(await countUnreviewed('photo', 'Camera')).toBe(2);
  });

  it('upsertMedia 冲突更新 bucket 且不清已读', async () => {
    await upsertMedia([row('c1', 'photo', { bucket: 'Camera' })]);
    await markReviewed(['c1'], new Date(1800000000000));
    await upsertMedia([row('c1', 'photo', { bucket: 'WeiXin' })]);
    const inWeiXin = await fetchUnreviewedRandom('photo', 10, 'WeiXin');
    expect(inWeiXin.find((x) => x.localIdentifier === 'c1')).toBeUndefined();
    expect(await countUnreviewed('photo', 'Camera')).toBe(1);
  });
});

describe('fetchBucketCounts', () => {
  it('按 STILL_TYPES 过滤、排除 NULL bucket、降序', async () => {
    await upsertMedia([
      row('a', 'photo', { bucket: 'Camera' }),
      row('b', 'long', { bucket: 'Camera' }),
      row('c', 'photo', { bucket: 'WeiXin' }),
      row('d', 'video', { bucket: 'Camera' }),
      row('e', 'photo'),
    ]);
    expect(await fetchBucketCounts()).toEqual([
      { bucket: 'Camera', count: 2 },
      { bucket: 'WeiXin', count: 1 },
    ]);
  });
});

describe('filterAggregateBuckets', () => {
  it('剔除占比>0.8', () => {
    expect(filterAggregateBuckets([{ bucket: 'Camera', count: 90 }], 100)).toEqual([]);
  });
  it('剔除聚合名（中文/英文）', () => {
    expect(filterAggregateBuckets([{ bucket: '所有照片', count: 10 }, { bucket: 'All Photos', count: 5 }], 100)).toEqual([]);
    expect(filterAggregateBuckets([{ bucket: '最近添加', count: 5 }], 100)).toEqual([]);
  });
  it('保留正常夹', () => {
    expect(filterAggregateBuckets([{ bucket: 'Camera', count: 35 }, { bucket: 'WeiXin', count: 10 }], 100))
      .toEqual([{ bucket: 'Camera', count: 35 }, { bucket: 'WeiXin', count: 10 }]);
  });
  it('totalImages=0 返回 []', () => {
    expect(filterAggregateBuckets([{ bucket: 'Camera', count: 1 }], 0)).toEqual([]);
  });
});
