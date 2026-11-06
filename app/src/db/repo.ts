import { SCHEMA_SQL } from './schema';

export type MediaType = 'photo' | 'video' | 'screenshot' | 'selfie' | 'live' | 'gif' | 'long';

/** 浏览分类：'photo' 语义为"所有静态图像"（与原 app 照片分类一致），其余精确匹配 */
export type Category = MediaType;

export interface MediaRow {
  localIdentifier: string;
  cloudIdentifier: string | null;
  mediaType: MediaType;
  width: number;
  height: number;
  creationDate: number;
  favorite: boolean;
  lastReviewedDate: number | null;
  lastLocallyReviewedDate: number | null;
}

export interface DeletionInput {
  localIdentifier: string;
  mediaType: MediaType;
  deletedAt: Date;
  fileSize: number | null;
}

export interface StatGroup {
  group: 'photos' | 'screenshots' | 'videos';
  viewed: number;
  deleted: number;
  freedBytes: number;
}

export type ResetScope = 'all' | 'photos' | 'photosNoScreenshots' | 'screenshots' | 'videos';

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  withTransactionAsync<T>(fn: () => Promise<T>): Promise<T>;
}

const STILL_TYPES: MediaType[] = ['photo', 'screenshot', 'selfie', 'live', 'gif', 'long'];
const STILL_TYPES_NO_SHOTS: MediaType[] = ['photo', 'selfie', 'live', 'gif', 'long'];
const PHOTOS_GROUP_TYPES: MediaType[] = ['photo', 'selfie', 'live', 'gif', 'long'];

let db: Db | null = null;

export function configureDbForTesting(d: Db): void {
  db = d;
}

/** 仅测试用：取回注入的 db 以执行原始查询 */
export function __testingDb(): Db {
  if (!db) throw new Error('db not configured');
  return db;
}

async function ensureDb(): Promise<Db> {
  if (db) return db;
  const SQLite = require('expo-sqlite');
  const opened: Db = await SQLite.openDatabaseAsync('quliu.db');
  db = opened;
  return opened;
}

export async function initDb(): Promise<void> {
  const d = await ensureDb();
  await d.execAsync(SCHEMA_SQL);
}

function placeholders(n: number): string {
  return Array(n).fill('?').join(',');
}

interface RawMediaRow extends Omit<MediaRow, 'favorite'> {
  favorite: number;
}

function toMediaRow(r: RawMediaRow): MediaRow {
  return { ...r, favorite: r.favorite === 1 };
}

export async function upsertMedia(items: MediaRow[]): Promise<void> {
  if (items.length === 0) return;
  const d = await ensureDb();
  await d.withTransactionAsync(async () => {
    for (const m of items) {
      await d.runAsync(
        `INSERT INTO media (localIdentifier, cloudIdentifier, mediaType, width, height, creationDate, favorite)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(localIdentifier) DO UPDATE SET
           cloudIdentifier = excluded.cloudIdentifier,
           mediaType = excluded.mediaType,
           width = excluded.width,
           height = excluded.height,
           creationDate = excluded.creationDate,
           favorite = excluded.favorite`,
        m.localIdentifier, m.cloudIdentifier, m.mediaType, m.width, m.height, m.creationDate, m.favorite ? 1 : 0,
      );
    }
  });
}

export async function markReviewed(ids: string[], at: Date): Promise<void> {
  if (ids.length === 0) return;
  const d = await ensureDb();
  await d.runAsync(
    `UPDATE media SET lastReviewedDate = ? WHERE localIdentifier IN (${placeholders(ids.length)})`,
    at.getTime(), ...ids,
  );
}

export async function fetchUnreviewedRandom(category: Category, n: number): Promise<MediaRow[]> {
  const d = await ensureDb();
  const types = category === 'photo' ? STILL_TYPES : [category];
  const rows = await d.getAllAsync<RawMediaRow>(
    `SELECT * FROM media WHERE lastReviewedDate IS NULL AND mediaType IN (${placeholders(types.length)})
     ORDER BY RANDOM() LIMIT ?`,
    ...types, n,
  );
  return rows.map(toMediaRow);
}

export async function countUnreviewed(category: Category): Promise<number> {
  const d = await ensureDb();
  const types = category === 'photo' ? STILL_TYPES : [category];
  const rows = await d.getAllAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM media WHERE lastReviewedDate IS NULL AND mediaType IN (${placeholders(types.length)})`,
    ...types,
  );
  return rows[0]?.c ?? 0;
}

export async function addDeletion(rec: DeletionInput): Promise<void> {
  const d = await ensureDb();
  await d.runAsync(
    'INSERT INTO deletion (localIdentifier, mediaType, deletedAt, fileSize) VALUES (?, ?, ?, ?)',
    rec.localIdentifier, rec.mediaType, rec.deletedAt.getTime(), rec.fileSize,
  );
}

export async function getStats(): Promise<StatGroup[]> {
  const d = await ensureDb();
  const groupFor = async (label: StatGroup['group'], types: MediaType[]): Promise<StatGroup> => {
    const viewedRows = await d.getAllAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM media WHERE lastReviewedDate IS NOT NULL AND mediaType IN (${placeholders(types.length)})`,
      ...types,
    );
    const delRows = await d.getAllAsync<{ c: number; b: number | null }>(
      `SELECT COUNT(*) AS c, SUM(fileSize) AS b FROM deletion WHERE mediaType IN (${placeholders(types.length)})`,
      ...types,
    );
    return {
      group: label,
      viewed: viewedRows[0]?.c ?? 0,
      deleted: delRows[0]?.c ?? 0,
      freedBytes: delRows[0]?.b ?? 0,
    };
  };
  return [
    await groupFor('photos', PHOTOS_GROUP_TYPES),
    await groupFor('screenshots', ['screenshot']),
    await groupFor('videos', ['video']),
  ];
}

export async function resetReviewed(scope: ResetScope): Promise<void> {
  const d = await ensureDb();
  const clear = 'UPDATE media SET lastReviewedDate = NULL, lastLocallyReviewedDate = NULL';
  switch (scope) {
    case 'all':
      await d.runAsync(clear);
      break;
    case 'photos':
      await d.runAsync(`${clear} WHERE mediaType IN (${placeholders(STILL_TYPES.length)})`, ...STILL_TYPES);
      break;
    case 'photosNoScreenshots':
      await d.runAsync(`${clear} WHERE mediaType IN (${placeholders(STILL_TYPES_NO_SHOTS.length)})`, ...STILL_TYPES_NO_SHOTS);
      break;
    case 'screenshots':
      await d.runAsync(`${clear} WHERE mediaType = 'screenshot'`);
      break;
    case 'videos':
      await d.runAsync(`${clear} WHERE mediaType = 'video'`);
      break;
  }
}

export async function removeMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const d = await ensureDb();
  await d.runAsync(`DELETE FROM media WHERE localIdentifier IN (${placeholders(ids.length)})`, ...ids);
}

export async function getSetting(key: string): Promise<string | null> {
  const d = await ensureDb();
  const rows = await d.getAllAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await ensureDb();
  await d.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
