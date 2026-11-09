import { Asset } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { copyAsync, cacheDirectory } from 'expo-file-system/legacy';

/**
 * Android 分享真实媒体文件。expo-sharing 原生侧只接受 file:// scheme
 * （SharingModule.kt 源码实证，content:// 直接抛错），故先把 content://
 * 资产拷到缓存目录再拉起系统分享面板。iOS 调用点不走这里（保持 Share.share）。
 */
export async function shareAssetAndroid(id: string, kind: 'image' | 'video'): Promise<void> {
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  const mimeType = kind === 'video' ? 'video/mp4' : 'image/jpeg';
  const src = await new Asset(id).getUri();
  const dest = `${cacheDirectory}share_${Date.now()}.${ext}`;
  await copyAsync({ from: src, to: dest });
  await Sharing.shareAsync(dest, { dialogTitle: '分享', mimeType });
}
