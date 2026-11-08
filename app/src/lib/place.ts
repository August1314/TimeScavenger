import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface PlaceParts {
  street: string | null; // 路名/地点名（信息页左侧）
  region: string | null; // 省市区（信息页右侧、浏览页胶囊）
}

const cache = new Map<string, PlaceParts | null>();
let permChecked = false;

async function geocode(lat: number, lon: number): Promise<PlaceParts | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    // Android：系统 Geocoder 需要定位权限才返回结果（OPPO 真机实证：无权限恒空、
    // 授权后出"省市区+POI"级地名）；首次调用请求一次，拒绝则静默走坐标兜底
    if (Platform.OS === 'android' && !permChecked) {
      permChecked = true;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        cache.set(key, null);
        return null;
      }
    }
    const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!p) {
      cache.set(key, null);
      return null;
    }
    // 去重相邻同名段：特别行政区等地名 region 与 city 相同（澳门真机实证重复）
    const segs = [p.region, p.city, p.district].filter(Boolean) as string[];
    const region = segs.filter((s, i) => s !== segs[i - 1]).join('') || null;
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
