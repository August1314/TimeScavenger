import { configureDbForTesting, initDb, upsertMedia, setSetting, type MediaRow } from '../../db/repo';
import { fakeDb } from '../../testlib/fakeDb';
import { nextGroup, markSeen, groupSizeLabel } from '../session';

function row(id: string, mediaType: MediaRow['mediaType']): MediaRow {
  return {
    localIdentifier: id, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate: 1700000000000, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null,
  };
}

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
});

describe('nextGroup', () => {
  it('uses photosPerGroup setting, default 15', async () => {
    await upsertMedia(Array.from({ length: 20 }, (_, i) => row(`P${i}`, 'photo')));
    const g = await nextGroup('photo');
    expect(g.items).toHaveLength(15);
    expect(g.index).toBe(0);
    await setSetting('photosPerGroup', '3');
    expect((await nextGroup('photo')).items).toHaveLength(3);
  });

  it('returns all when fewer than group size; empty library gives empty group', async () => {
    await upsertMedia([row('P1', 'photo'), row('P2', 'photo')]);
    expect((await nextGroup('photo')).items).toHaveLength(2);
    expect((await nextGroup('video')).items).toHaveLength(0);
  });

  it('videos use videosPerGroup', async () => {
    await upsertMedia(Array.from({ length: 20 }, (_, i) => row(`V${i}`, 'video')));
    await setSetting('videosPerGroup', '7');
    expect((await nextGroup('video')).items).toHaveLength(7);
  });
});

describe('markSeen', () => {
  it('removes the item from subsequent groups', async () => {
    await upsertMedia([row('A', 'photo'), row('B', 'photo'), row('C', 'photo')]);
    await setSetting('photosPerGroup', '2');
    const g = await nextGroup('photo');
    await markSeen(g.items[0]);
    const ids = new Set((await nextGroup('photo')).items.map((r) => r.localIdentifier));
    expect(ids.has(g.items[0].localIdentifier)).toBe(false);
  });
});

describe('groupSizeLabel', () => {
  it('reflects current setting', async () => {
    expect(await groupSizeLabel('photo')).toBe('15');
    await setSetting('photosPerGroup', '40');
    expect(await groupSizeLabel('photo')).toBe('40');
    expect(await groupSizeLabel('video')).toBe('15');
  });
});
