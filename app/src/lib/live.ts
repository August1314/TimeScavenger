import { Asset } from 'expo-media-library';
import { File } from 'expo-file-system';

export interface LiveSource {
  photoUri: string;
  pairedVideoUri: string;
}

/**
 * 实况配对视频不是独立 PHAsset（视频查询 0 命中，spike 按钮5 实证），
 * 但可通过照片 getUri 的路径规律直接定位（spike 按钮6 实证 exists=true）：
 *  1) 编辑过：…/Mutations/DCIM/<album>/<name>/Adjustments/FullSizeRender.jpg → 同路径 .mov
 *  2) 原始位：file:///var/mobile/Media/DCIM/<album>/<STEM>.MOV
 */
function candidateVideoUris(photoUri: string, filename: string): string[] {
  const out: string[] = [];
  if (/\.jpe?g$/i.test(photoUri)) {
    out.push(photoUri.replace(/\.jpe?g$/i, '.mov'), photoUri.replace(/\.jpe?g$/i, '.MOV'));
  }
  const album = (photoUri.match(/DCIM\/([^/]+)\//) ?? [])[1] ?? '';
  const stem = (filename ?? '').split('.')[0];
  if (album && stem) {
    out.push(
      `file:///var/mobile/Media/DCIM/${album}/${stem}.MOV`,
      `file:///var/mobile/Media/DCIM/${album}/${stem}.mov`,
    );
  }
  return out;
}

function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

const cache = new Map<string, LiveSource | null>();

/** 实况照片 → LivePhotoView 所需 {photoUri, pairedVideoUri}；失败返回 null */
export async function getLiveSource(photoId: string): Promise<LiveSource | null> {
  if (cache.has(photoId)) return cache.get(photoId) ?? null;
  try {
    const asset = new Asset(photoId);
    const [photoUri, filename] = await Promise.all([asset.getUri(), asset.getFilename()]);
    if (!photoUri) {
      cache.set(photoId, null);
      return null;
    }
    const pairedVideoUri = candidateVideoUris(photoUri, filename).find(fileExists) ?? null;
    const src = pairedVideoUri ? { photoUri, pairedVideoUri } : null;
    cache.set(photoId, src);
    return src;
  } catch {
    cache.set(photoId, null);
    return null;
  }
}
