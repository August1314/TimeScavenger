import { Platform } from 'react-native';
import { addDeletion, removeMedia, setPending, fetchPending, type MediaRow } from '../db/repo';

export interface DeleteOutcome {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface DeletionDeps {
  deleteAssets(ids: string[]): Promise<DeleteOutcome>;
  measureSize(id: string): Promise<number | null>;
}

/**
 * 待删除队列：内存 Map + SQLite pendingDeletedAt 标记双写（T7.3 裁决2）。
 * 重启/热重载后 hydrate() 从库恢复，杜绝"幽灵照片"。
 */
export class PendingQueue {
  private items = new Map<string, MediaRow>();

  async hydrate(): Promise<void> {
    const rows = await fetchPending();
    this.items = new Map(rows.map((r) => [r.localIdentifier, r]));
  }

  async push(item: MediaRow): Promise<void> {
    this.items.set(item.localIdentifier, item);
    await setPending([item.localIdentifier], Date.now());
  }

  async remove(id: string): Promise<void> {
    if (!this.items.delete(id)) return;
    await setPending([id], null);
  }

  async list(): Promise<MediaRow[]> {
    return [...this.items.values()];
  }

  async count(): Promise<number> {
    return this.items.size;
  }

  async discardAll(): Promise<void> {
    const ids = [...this.items.keys()];
    this.items.clear();
    if (ids.length > 0) await setPending(ids, null);
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
 * 提交勾选的待删除项：测尺寸（超时→null）→ 系统删除
 * → 成功项写删除记录、清 media 行与 pending 标记；失败项保留在队列。
 */
export async function commitPending(
  selectedIds: string[],
  deps: DeletionDeps,
  queue: PendingQueue = pendingQueue,
): Promise<CommitResult> {
  const all = await queue.list();
  const targets = selectedIds
    .map((id) => all.find((r) => r.localIdentifier === id))
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
    await queue.remove(t.localIdentifier);
    deleted.push(t.localIdentifier);
  }
  if (deleted.length > 0) await removeMedia(deleted);

  return { deleted, failed: outcome.failed };
}

/** 删除失败信息归类：用户取消 vs 真失败。
 * Android 原生 cause（"User didn't grant write permission…"）被 modules-core 吞掉，
 * JS 只见 "Call to function 'Asset.delete' has been rejected."，故 rejected 仅 Android 归 cancelled */
export function classifyDeleteError(msg: string, os: 'ios' | 'android'): 'cancelled' | 'failed' {
  if (/cancel|did not grant|didn't grant/i.test(msg)) return 'cancelled';
  if (os === 'android' && /denied|rejected/i.test(msg)) return 'cancelled';
  return 'failed';
}

/** 生产依赖：expo-media-library Asset.delete + File(uri).size（真机已验证 ph:// 可读） */
export function nativeDeps(): DeletionDeps {
  return {
    async deleteAssets(ids) {
      const { Asset } = require('expo-media-library');
      try {
        await Asset.delete(ids.map((id) => new Asset(id)));
        return { succeeded: ids, failed: [] };
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (classifyDeleteError(msg, Platform.OS === 'android' ? 'android' : 'ios') === 'cancelled') return { succeeded: [], failed: ids.map((id) => ({ id, error: '已取消删除。' })) };
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
