import { Asset, AssetUriVersion } from 'expo-media-library';
import { File } from 'expo-file-system';

export interface LiveSource {
  photoUri: string;
  pairedVideoUri: string;
}

/**
 * REA 结论：原版原生用 PHLivePhoto.request(for: PHAsset)，从不碰路径；
 * expo-live-photo 要求 photo/video 两个 file URL 且**配对元数据一致**（实机报错
 * "Provided photo and video urls are not paired"）。
 * 严格同 stem 配对：JPG/HEIC 照片 → 仅把"照片文件名末尾扩展名"换成 .mov/.MOV：
 *   IMG_1.MOV       ← IMG_1.JPG / IMG_1.HEIC
 *   IMG_1.HEIC.MOV  ← IMG_1.HEIC.JPG（HEIC 实况的视频轨命名）
 * 禁止跨 stem（如 IMG_1.MOV 配 IMG_1.HEIC.JPG）——那必不配对。
 */
function strictCandidates(photoUri: string, filename: string): string[] {
  const out: string[] = [];
  const pushSwap = (base: string) => {
    out.push(`${base}.mov`, `${base}.MOV`);
  };
  if (/\.(mov|mp4)$/i.test(photoUri)) return []; // 照片 URI 本身是视频 = 数据异常
  const jpg = photoUri.match(/^(.*\.(?:heic|heif))\.jpe?g$/i); // IMG_1.HEIC.JPG → IMG_1.HEIC
  if (jpg) pushSwap(jpg[1]);
  const plain = photoUri.match(/^(.*)\.jpe?g$/i);
  if (plain) pushSwap(plain[1]);
  const heic = photoUri.match(/^(.*)\.(?:heic|heif)$/i);
  if (heic) pushSwap(heic[1]);
  // 兜底：按文件名 stem 猜原始 DCIM 位置（同 stem 直接 .MOV）
  const album = (photoUri.match(/DCIM\/([^/]+)\//) ?? [])[1] ?? '';
  const stem = (filename ?? '').split('.')[0];
  if (album && stem) {
    out.push(`file:///var/mobile/Media/DCIM/${album}/${stem}.MOV`);
    out.push(`file:///var/mobile/Media/DCIM/${album}/${stem}.mov`);
    const stemHeic = stem.match(/^(.*)\.heic$/i);
    if (stemHeic) {
      out.push(`file:///var/mobile/Media/DCIM/${album}/${stemHeic[1]}.HEIC.MOV`);
      out.push(`file:///var/mobile/Media/DCIM/${album}/${stem}.HEIC.MOV`);
    }
  }
  return Array.from(new Set(out));
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
    const [currentUri, origUri, filename] = await Promise.all([
      asset.getUri(),
      asset.getUri({ version: AssetUriVersion.ORIGINAL }),
      asset.getFilename(),
    ]);
    const photoUri = currentUri ?? origUri;
    if (!photoUri) {
      cache.set(photoId, null);
      return null;
    }
    // 配对原则：photo 与 video 必须来自同一存储位置/同一 stem。
    // 若 ORIGINAL uri 仍在 DCIM 原始位（未被 Mutations 渲染路径污染），优先"原始照片+原始MOV"成对。
    const album = (photoUri.match(/DCIM\/([^/]+)\//) ?? [])[1]
      ?? ((origUri ?? '').match(/DCIM\/([^/]+)\//) ?? [])[1] ?? '';
    const stem = (filename ?? '').split('.')[0];
    let pair: LiveSource | null = null;
    if (album && stem) {
      const origPhoto = [
        `file:///var/mobile/Media/DCIM/${album}/${stem}.JPG`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.jpg`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.HEIC.JPG`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.HEIC`,
      ].find(fileExists);
      const origVideo = [
        `file:///var/mobile/Media/DCIM/${album}/${stem}.MOV`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.mov`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.HEIC.MOV`,
        `file:///var/mobile/Media/DCIM/${album}/${stem}.HEIC.mov`,
      ].find(fileExists);
      if (origPhoto && origVideo) pair = { photoUri: origPhoto, pairedVideoUri: origVideo };
    }
    if (!pair) {
      const v = strictCandidates(photoUri, filename).find(fileExists);
      if (v) pair = { photoUri, pairedVideoUri: v };
    }
    cache.set(photoId, pair);
    return pair;
  } catch {
    cache.set(photoId, null);
    return null;
  }
}
