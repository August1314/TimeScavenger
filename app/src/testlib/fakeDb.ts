import BetterSqlite3 from 'better-sqlite3';
import type { Db } from '../db/repo';

/** 与 expo-sqlite 语义一致的内存 Db 实现（better-sqlite3 后端），供所有仓库层测试复用 */
export function fakeDb(): Db {
  const raw = new BetterSqlite3(':memory:');
  return {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]) =>
      raw.prepare(sql).all(...(params as never[])) as T[],
    withTransactionAsync: async <T>(fn: () => Promise<T>): Promise<T> => {
      raw.exec('BEGIN');
      try {
        const r = await fn();
        raw.exec('COMMIT');
        return r;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
