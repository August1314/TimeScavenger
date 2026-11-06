import { Asset } from 'expo-media-library';

export interface ExifInfo {
  aperture: string | null;
  shutter: string | null;
  iso: string | null;
  focal: string | null;
  camera: string | null;
  fileName: string | null;
}

const EMPTY: ExifInfo = { aperture: null, shutter: null, iso: null, focal: null, camera: null, fileName: null };

type Raw = Record<string, unknown>;

/** 兼容 rational 对象 / [n,d] / number / 字符串 */
function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(v) && v.length >= 2) {
    const d = num(v[1]);
    const nn = num(v[0]);
    return nn != null && d ? nn / d : null;
  }
  if (typeof v === 'object' && 'numerator' in (v as Raw)) {
    const o = v as { numerator: unknown; denominator: unknown };
    const nn = num(o.numerator);
    const d = num(o.denominator);
    return nn != null && d ? nn / d : null;
  }
  if (Array.isArray(v)) return num(v[0]);
  return null;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function pick(tags: Raw, keys: string[]): unknown {
  for (const k of keys) {
    if (tags[k] != null) return tags[k];
  }
  return null;
}

function formatShutter(sec: number): string {
  if (sec >= 1) return `${Math.round(sec * 10) / 10} s`;
  return `1/${Math.round(1 / sec)} s`;
}

export function mapExif(tags: Raw): ExifInfo {
  const aperture = num(pick(tags, ['FNumber', 'ApertureValue']));
  const shutter = num(pick(tags, ['ExposureTime']));
  const iso = num(first(pick(tags, ['ISOSpeedRatings', 'ISO', 'PhotoISOSpeed']))) ?? undefined;
  const focal = num(pick(tags, ['FocalLength', 'LensInfo']));
  const make = pick(tags, ['Make']);
  const model = pick(tags, ['Model']);
  const camera = [make, model].filter(Boolean).join(' ').trim() || null;
  const fileName = pick(tags, ['OriginalFilename', 'FileName', 'KMDItemFSName']);
  return {
    aperture: aperture != null ? `f${Math.round(aperture * 100) / 100}` : null,
    shutter: shutter != null && shutter > 0 ? formatShutter(shutter) : null,
    iso: iso != null ? `ISO ${Math.round(iso)}` : null,
    focal: focal != null ? `${Math.round(focal * 10) / 10} mm` : null,
    camera: camera || null,
    fileName: typeof fileName === 'string' && fileName ? fileName : null,
  };
}

/** 读取并映射 EXIF；失败/无 EXIF 返回全 null（截屏降级态） */
export async function readExif(localIdentifier: string): Promise<ExifInfo> {
  try {
    return mapExif(await new Asset(localIdentifier).getExif());
  } catch {
    return EMPTY;
  }
}
