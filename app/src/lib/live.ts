import { Asset, AssetField, MediaType, Query } from 'expo-media-library';

const stem = (name: string | null): string => (name ?? '').replace(/\.[^.]+$/, '');

let videoList: { stem: string; id: string }[] | null = null;

async function ensureVideoList(): Promise<{ stem: string; id: string }[]> {
  if (!videoList) {
    const vids = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).exeForMetadata();
    videoList = vids.map((v) => ({ stem: stem(v.filename), id: v.id }));
  }
  return videoList;
}

/**
 * iOS 实况照片的配对视频是独立 MOV 资产，文件名 stem 与 JPG 一致（IMG_1234.JPG ↔ IMG_1234.MOV）。
 * 返回配对视频 URI；找不到返回 null。
 */
export async function getLiveVideoUri(photoId: string): Promise<string | null> {
  try {
    const name = await new Asset(photoId).getFilename();
    const s = stem(name);
    if (!s) return null;
    const list = await ensureVideoList();
    const hit = list.find((v) => v.stem === s);
    if (!hit) return null;
    return await new Asset(hit.id).getUri();
  } catch {
    return null;
  }
}
