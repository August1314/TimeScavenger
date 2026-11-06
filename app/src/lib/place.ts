import * as Location from 'expo-location';

const cache = new Map<string, string | null>();

/** 反查"省市区"风格短地址（Apple 地图服务；无网络返回 null） */
export async function placeName(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!p) {
      cache.set(key, null);
      return null;
    }
    const parts = [p.city, p.district].filter(Boolean) as string[];
    const name = parts.length ? parts.join('') : (p.name ?? '');
    const v = name || null;
    cache.set(key, v);
    return v;
  } catch {
    cache.set(key, null);
    return null;
  }
}
