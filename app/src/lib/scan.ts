import {
  AssetField,
  Album,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
  type AssetMetadata,
} from 'expo-media-library';
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
 * 增量导入：一次拉全量轻量元数据（image+video），分批 upsert 并回报进度。
 * upsert 保留已读时间戳（Task 2 语义），重复调用安全。
 */
export async function startImport(onProgress: (done: number, total: number) => void): Promise<ImportResult> {
  const selfieIds = await collectSelfieIds();
  const images = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).exeForMetadata();
  const videos = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).exeForMetadata();
  const all = [...images, ...videos];
  const total = all.length;

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
