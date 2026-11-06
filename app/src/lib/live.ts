import { Asset, AssetUriVersion } from 'expo-media-library';
import { File } from 'expo-file-system';

export interface LiveSource {
  photoUri: string;
  pairedVideoUri: string;
}

/**
 * REA 结论：原版是原生 app，用 PHLivePhoto.request(for: PHAsset) 直接播，无需文件路径。
 * expo-live-photo 需要两个 file URL，且 PHLivePhoto 校验"配对元数据完整"：
 * 编辑过照片的 Mutations/Adjustments 渲染件与 MOV 配对已破坏 → 必须取 ORIGINAL 原始件对。
 * 候选：原始照片路径同目录换扩展名(.mov/.MOV/.HEIC.MOV) + DCIM/<album>/<STEM>.MOV。
 */
function candidateVideoUris(photoUri: string, filename: string): string[] {
  const out: string[] = [];
  const extMatch = photoUri.match(/\.(jpe?g|heic|heif|png)$/i);
  if (extMatch) {
    const base = photoUri.slice(0, photoUri.length - extMatch[0].length);
    out.push(`${base}.mov`, `${base}.MOV`, `${base}.HEIC.MOV`);
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

/** 实况照片 → LivePhotoView 所需 {photoUri, pairedVideoUri}（ORIGINAL 原始件对）；失败返回 null */
export async function getLiveSource(photoId: string): Promise<LiveSource | null> {
  if (cache.has(photoId)) return cache.get(photoId) ?? null;
  try {
    const asset = new Asset(photoId);
    const [photoUri, filename] = await Promise.all([
      asset.getUri({ version: AssetUriVersion.ORIGINAL }),
      asset.getFilename(),
    ]);
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
