import { Asset, AssetField, MediaType, Query } from 'expo-media-library';

export interface LiveSource {
  photoUri: string;
  pairedVideoUri: string;
}

/** IMG_1234.HEIC.JPG / IMG_1234.JPG → IMG_1234（去掉全部扩展名，配对 MOV 同 stem） */
const stem = (name: string | null): string => (name ?? '').split('.')[0];

let videoList: { stem: string; id: string }[] | null = null;

async function ensureVideoList(): Promise<{ stem: string; id: string }[]> {
  if (!videoList) {
    const vids = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).exeForMetadata();
    videoList = vids.map((v) => ({ stem: stem(v.filename), id: v.id }));
  }
  return videoList;
}

const cache = new Map<string, LiveSource | null>();

/**
 * 实况照片 → LivePhotoView 所需的 {photoUri, pairedVideoUri}。
 * 配对视频按 iOS 存储规律匹配：IMG_1234.JPG ↔ IMG_1234.MOV（同文件名 stem）。
 */
export async function getLiveSource(photoId: string): Promise<LiveSource | null> {
  if (cache.has(photoId)) return cache.get(photoId) ?? null;
  try {
    const asset = new Asset(photoId);
    const [photoUri, name] = await Promise.all([asset.getUri(), asset.getFilename()]);
    const s = stem(name);
    if (!photoUri || !s) {
      cache.set(photoId, null);
      return null;
    }
    const list = await ensureVideoList();
    const hit = list.find((v) => v.stem === s);
    if (!hit) {
      cache.set(photoId, null);
      return null;
    }
    const pairedVideoUri = await new Asset(hit.id).getUri();
    const src = pairedVideoUri ? { photoUri, pairedVideoUri } : null;
    cache.set(photoId, src);
    return src;
  } catch {
    cache.set(photoId, null);
    return null;
  }
}
