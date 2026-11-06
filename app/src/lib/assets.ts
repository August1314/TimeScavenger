import { Asset } from 'expo-media-library';

export async function setFavorite(id: string, fav: boolean): Promise<void> {
  await new Asset(id).setFavorite(fav);
}

export async function getFavorite(id: string): Promise<boolean> {
  return new Asset(id).getFavorite();
}
