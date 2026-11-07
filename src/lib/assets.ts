import { Asset, getPermissionsAsync } from 'expo-media-library';

export async function setFavorite(id: string, fav: boolean): Promise<void> {
  await new Asset(id).setFavorite(fav);
}

/** 收藏写入 + 权限感知失败反馈（受限访问下 PHAsset 改收藏会抛错） */
export async function setFavoriteSafe(id: string, fav: boolean): Promise<{ ok: boolean; limited?: boolean }> {
  try {
    await new Asset(id).setFavorite(fav);
    return { ok: true };
  } catch {
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
    return await new Asset(id).getLocation();
  } catch {
    return null;
  }
}
