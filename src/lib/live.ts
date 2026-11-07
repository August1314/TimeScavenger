import { Asset } from 'expo-media-library';

export interface LiveSource {
  photoUri: string;
  pairedVideoUri: string;
}

const cache = new Map<string, LiveSource | null>();

/**
 * 官方路径（docs.expo.dev media-library Asset.getLivePhotoVideoUri，iOS）：
 * 原生从 PHAssetResource 提取实况配对视频到临时文件，内嵌配对元数据完整，
 * 与照片 getUri() 同源于相册资源 → PHLivePhoto 配对校验可过。
 * （此前文件路径猜测法失败：withResourceFileURLs 校验文件内嵌 assetIdentifier，非文件名。）
 */
export async function getLiveSource(photoId: string): Promise<LiveSource | null> {
  if (cache.has(photoId)) return cache.get(photoId) ?? null;
  try {
    const asset = new Asset(photoId);
    const [photoUri, pairedVideoUri] = await Promise.all([
      asset.getUri(),
      asset.getLivePhotoVideoUri(),
    ]);
    const src = photoUri && pairedVideoUri ? { photoUri, pairedVideoUri } : null;
    cache.set(photoId, src);
    return src;
  } catch {
    cache.set(photoId, null);
    return null;
  }
}
