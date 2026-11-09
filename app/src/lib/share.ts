import { Asset } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { copyAsync, cacheDirectory, readDirectoryAsync, deleteAsync } from 'expo-file-system/legacy';

/**
 * Android 分享真实媒体文件。expo-sharing 原生侧只接受 file:// scheme
 * （SharingModule.kt 源码实证，content:// 直接抛错），故先把 content://
 * 资产拷到缓存目录再拉起系统分享面板。iOS 调用点不走这里（保持 Share.share）。
 */
export async function shareAssetAndroid(id: string, kind: 'image' | 'video'): Promise<void> {
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  const mimeType = kind === 'video' ? 'video/mp4' : 'image/jpeg';
  const src = await new Asset(id).getUri();
  // best-effort 清理上次分享的缓存残留，避免长期累积占用（失败不阻塞分享）
  if (cacheDirectory) {
    try {
      const names = await readDirectoryAsync(cacheDirectory);
      for (const name of names) {
        if (name.startsWith('share_')) {
          await deleteAsync(`${cacheDirectory}${name}`);
        }
      }
    } catch {
      // ignore
    }
  }
  const dest = `${cacheDirectory}share_${Date.now()}.${ext}`;
  await copyAsync({ from: src, to: dest });
  await Sharing.shareAsync(dest, { dialogTitle: '分享', mimeType });
}
