import * as Location from 'expo-location';

export interface PlaceParts {
  street: string | null; // 路名/地点名（信息页左侧）
  region: string | null; // 省市区（信息页右侧、浏览页胶囊）
}

const cache = new Map<string, PlaceParts | null>();

async function geocode(lat: number, lon: number): Promise<PlaceParts | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!p) {
      cache.set(key, null);
      return null;
    }
    const region = [p.region, p.city, p.district].filter(Boolean).join('') || null;
    const street = p.name ?? p.street ?? null;
    const v = region || street ? { street, region } : null;
    cache.set(key, v);
    return v;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** 反查"省市区"风格短地址（Apple 地图服务；无网络返回 null） */
export async function placeName(lat: number, lon: number): Promise<string | null> {
  const parts = await geocode(lat, lon);
  return parts?.region ?? parts?.street ?? null;
}

/** 信息页用：路名与省市区拆分 */
export async function placeParts(lat: number, lon: number): Promise<PlaceParts | null> {
  return geocode(lat, lon);
}
