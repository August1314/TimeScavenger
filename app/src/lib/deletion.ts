import { addDeletion, removeMedia, type MediaRow } from '../db/repo';

export interface DeleteOutcome {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface DeletionDeps {
  deleteAssets(ids: string[]): Promise<DeleteOutcome>;
  measureSize(id: string): Promise<number | null>;
}

/** 待删除队列（内存单件：上滑入队 → 回收站确认 → 真删除） */
class PendingQueue {
  private items = new Map<string, MediaRow>();

  push(item: MediaRow): void {
    this.items.set(item.localIdentifier, item);
  }

  remove(id: string): void {
    this.items.delete(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  list(): MediaRow[] {
    return [...this.items.values()];
  }

  discardAll(): void {
    this.items.clear();
  }
}

export const pendingQueue = new PendingQueue();

export interface CommitResult {
  deleted: string[];
  failed: { id: string; error: string }[];
}

const SIZE_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);
}

/**
 * 提交勾选的待删除项：测尺寸（超时→null，iCloud 未下载即此路径）→ 系统删除
 * → 成功项写删除记录并清 media 行；失败项留在队列里。
 */
export async function commitPending(selectedIds: string[], deps: DeletionDeps): Promise<CommitResult> {
  const targets = selectedIds
    .map((id) => pendingQueue.list().find((r) => r.localIdentifier === id))
    .filter((r): r is MediaRow => !!r);
  if (targets.length === 0) return { deleted: [], failed: [] };

  const sizes = new Map<string, number | null>();
  for (const t of targets) {
    sizes.set(t.localIdentifier, await deps.measureSize(t.localIdentifier));
  }

  const outcome = await deps.deleteAssets(targets.map((t) => t.localIdentifier));
  const failedIds = new Set(outcome.failed.map((f) => f.id));
  const deleted: string[] = [];
  const now = new Date();

  for (const t of targets) {
    if (failedIds.has(t.localIdentifier)) continue;
    await addDeletion({
      localIdentifier: t.localIdentifier,
      mediaType: t.mediaType,
      deletedAt: now,
      fileSize: sizes.get(t.localIdentifier) ?? null,
    });
    pendingQueue.remove(t.localIdentifier);
    deleted.push(t.localIdentifier);
  }
  if (deleted.length > 0) await removeMedia(deleted);

  return { deleted, failed: outcome.failed };
}

/** 生产依赖：expo-media-library Asset.delete + File(uri).size（实机 spike 验证） */
export function nativeDeps(): DeletionDeps {
  return {
    async deleteAssets(ids) {
      const { Asset } = require('expo-media-library');
      try {
        await Asset.delete(ids.map((id) => new Asset(id)));
        return { succeeded: ids, failed: [] };
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/cancel/i.test(msg)) return { succeeded: [], failed: ids.map((id) => ({ id, error: '已取消删除。' })) };
        return { succeeded: [], failed: ids.map((id) => ({ id, error: msg })) };
      }
    },
    async measureSize(id) {
      const { Asset } = require('expo-media-library');
      const { File } = require('expo-file-system');
      try {
        const asset = new Asset(id);
        const uri = await withTimeout(asset.getUri(), SIZE_TIMEOUT_MS);
        if (!uri) return null;
        const size = await withTimeout(Promise.resolve(new File(uri).size), SIZE_TIMEOUT_MS);
        return typeof size === 'number' && size > 0 ? size : null;
      } catch {
        return null;
      }
    },
  };
}
