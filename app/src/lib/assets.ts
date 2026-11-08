import { Asset, getPermissionsAsync } from 'expo-media-library';
import { PermissionsAndroid, Platform } from 'react-native';
import { classifyDeleteError } from './deletion';

export async function setFavorite(id: string, fav: boolean): Promise<void> {
  await new Asset(id).setFavorite(fav);
}

/** 收藏写入 + 权限感知失败反馈（受限访问下 PHAsset 改收藏会抛错）。
 * Android 系统确认弹窗被"拒绝"时 modules-core 抛 rejected，归 cancelled 而非失败（真机 ColorOS 实证） */
export async function setFavoriteSafe(id: string, fav: boolean): Promise<{ ok: boolean; limited?: boolean; cancelled?: boolean }> {
  try {
    await new Asset(id).setFavorite(fav);
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (classifyDeleteError(msg, Platform.OS === 'android' ? 'android' : 'ios') === 'cancelled') {
      return { ok: false, cancelled: true };
    }
    try {
      const r = await getPermissionsAsync();
      return { ok: false, limited: r.accessPrivileges === 'limited' };
    } catch {
      return { ok: false };
    }
  }
}

export async function getFavorite(id: string): Promise<boolean> {
  return new Asset(id).getFavorite();
}

export interface AssetLocation {
  latitude: number;
  longitude: number;
}

export async function getAssetLocation(id: string): Promise<AssetLocation | null> {
  try {
    if (Platform.OS === 'android') {
      // 无此权限时 MediaProvider 会剥掉 EXIF GPS（Android 10+），getLocation 恒 null
      await PermissionsAndroid.request('android.permission.ACCESS_MEDIA_LOCATION');
    }
    return await new Asset(id).getLocation();
  } catch {
    return null;
  }
}
