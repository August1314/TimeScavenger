import { configureDbForTesting, initDb, upsertMedia, type MediaRow } from '../../db/repo';
import { fakeDb } from '../../testlib/fakeDb';
import { dayBounds, sameDayItems } from '../sameDay';

function row(localIdentifier: string, mediaType: MediaRow['mediaType'], creationDate: number): MediaRow {
  return {
    localIdentifier, cloudIdentifier: null, mediaType,
    width: 100, height: 200, creationDate, favorite: false,
    lastReviewedDate: null, lastLocallyReviewedDate: null,
  };
}

beforeEach(async () => {
  configureDbForTesting(fakeDb());
  await initDb();
});

describe('dayBounds', () => {
  it('covers the local calendar day', () => {
    const noon = new Date(2025, 0, 7, 12, 0, 0).getTime();
    const [start, end] = dayBounds(noon);
    expect(start).toBe(new Date(2025, 0, 7, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2025, 0, 8, 0, 0, 0, 0).getTime());
  });

  it('late night stays in the same day', () => {
    const late = new Date(2025, 0, 7, 23, 59, 59, 999).getTime();
    const [start, end] = dayBounds(late);
    expect(start).toBe(new Date(2025, 0, 7).getTime());
    expect(end).toBe(new Date(2025, 0, 8).getTime());
  });
});

describe('sameDayItems', () => {
  it('returns all media of the anchor local day, ordered, including video/screenshots', async () => {
    const d1morning = new Date(2025, 0, 7, 8, 0).getTime();
    const d1night = new Date(2025, 0, 7, 23, 30).getTime();
    const d0 = new Date(2025, 0, 6, 23, 59).getTime();
    const d2 = new Date(2025, 0, 8, 0, 1).getTime();
    await upsertMedia([
      row('NIGHT', 'video', d1night),
      row('MORNING', 'screenshot', d1morning),
      row('PREV', 'photo', d0),
      row('NEXT', 'photo', d2),
    ]);
    const items = await sameDayItems(row('MORNING', 'screenshot', d1morning));
    expect(items.map((r) => r.localIdentifier)).toEqual(['MORNING', 'NIGHT']);
  });

  it('returns empty for a day with only the anchor missing', async () => {
    const anchor = row('X', 'photo', new Date(2030, 5, 5, 10).getTime());
    expect(await sameDayItems(anchor)).toEqual([]);
  });
});
