import {
  AssetField,
  Album,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';
import { Platform } from 'react-native';
import { upsertMedia, type MediaRow } from '../db/repo';
import { classifyAsset, type AssetMetaLite } from './classify';

export type PermState = 'granted' | 'limited' | 'denied';

export async function ensurePhotoPermission(): Promise<PermState> {
  let res = await getPermissionsAsync();
  if (res.status !== 'granted') {
    res = await requestPermissionsAsync();
  }
  if (res.status !== 'granted') return 'denied';
  return res.accessPrivileges === 'limited' ? 'limited' : 'granted';
}

/** expo-media-library 文档为毫秒；若个别版本给秒（<1e11）则归一化为毫秒 */
export function normalizeCreationTime(v: number | null): number {
  const n = v ?? 0;
  return n > 0 && n < 1e11 ? n * 1000 : n;
}

/**
 * 拍摄时间回退链（OPPO ColorOS 真机实证）：Android 的 creationTime 映射
 * MediaStore DATE_TAKEN（EXIF 拍摄时间），微信 mmexport/部分迁移照片该列为 NULL，
 * 直接落 0 会显示"56 年前"（1970 纪元）。无 EXIF 时退 DATE_MODIFIED（文件修改时间，
 * 迁移工具普遍保留原始 mtime≈拍摄/导出时刻）。
 */
export function resolveCreationTime(taken: number | null, modified: number | null): number {
  const t = normalizeCreationTime(taken);
  if (t > 0) return t;
  return normalizeCreationTime(modified);
}

function toLite(m: AssetMetadata): AssetMetaLite {
  return {
    id: m.id,
    mediaType: m.mediaType as AssetMetaLite['mediaType'],
    width: m.width,
    height: m.height,
    duration: m.duration,
    subtypes: m.mediaSubtypes ?? [],
  };
}

async function collectSelfieIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const smartAlbums = await Album.getSmartAlbums();
    for (const album of smartAlbums) {
      const title = await album.getTitle();
      if (/selfie|自拍/i.test(title)) {
        const assets = await new Query().album(album).eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).exeForMetadata();
        for (const a of assets) ids.add(a.id);
      }
    }
  } catch {
    // 智能相册不可用（受限访问等）→ 无自拍分类
  }
  return ids;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Android：assetId → 文件夹名映射。
 * 不用 Album.getAll（其底层查 content://media/external/files，ColorOS 实测
 * 抛 UnsupportedOperationException 致枚举恒空）——改走 legacy getAssetsAsync，
 * 从 asset.file 绝对路径取末段目录名（与 MediaStore bucket_display_name 一致，
 * 如 /storage/emulated/0/DCIM/Camera/x.jpg → "Camera"）。
 * iOS 不调用（恒空 Map → bucket null）。
 */
export async function collectAndroidBuckets(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const ML = require('expo-media-library');
    let after: string | undefined;
    let hasNext = true;
    while (hasNext) {
      const page = await ML.getAssetsAsync({
        mediaType: ML.MediaType?.photo ?? 'photo',
        first: 1000,
        ...(after ? { after } : {}),
      });
      for (const edge of page.edges) {
        const node = edge.node;
        const parts = String(node.file ?? '').split('/');
        const folder = parts[parts.length - 2] ?? '';
        if (folder && node.id) map.set(node.id, folder);
      }
      after = page.page_info?.end_cursor;
      hasNext = Boolean(page.has_next);
    }
  } catch {
    // 采集不可用 → 全部无 bucket，菜单只剩"全部"（COALESCE 保住旧值）
  }
  return map;
}

/**
 * 增量导入：一次拉全量轻量元数据（image+video），分批 upsert 并回报进度。
 * upsert 保留已读时间戳（Task 2 语义），重复调用安全。
 */
export async function startImport(onProgress: (done: number, total: number) => void): Promise<ImportResult> {
  const selfieIds = await collectSelfieIds();
  const images = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).exeForMetadata();
  const videos = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).exeForMetadata();
  const all = [...images, ...videos];
  const total = all.length;
  const bucketMap = Platform.OS === 'android' ? await collectAndroidBuckets() : new Map<string, string>();

  let imported = 0;
  let skipped = 0;
  const BATCH = 500;
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH);
    const rows: MediaRow[] = [];
    for (const m of chunk) {
      const mediaType = classifyAsset(toLite(m), selfieIds);
      if (!mediaType) {
        skipped++;
        continue;
      }
      rows.push({
        localIdentifier: m.id,
        cloudIdentifier: null,
        mediaType,
        width: m.width ?? 0,
        height: m.height ?? 0,
        creationDate: resolveCreationTime(m.creationTime, m.modificationTime),
        bucket: bucketMap.get(m.id) ?? null,
        favorite: m.isFavorite,
        lastReviewedDate: null,
        lastLocallyReviewedDate: null,
      });
    }
    await upsertMedia(rows);
    imported += rows.length;
    onProgress(Math.min(i + BATCH, total), total);
  }
  return { imported, skipped };
}
