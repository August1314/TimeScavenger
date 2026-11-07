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

/** iOS getExif() 返回嵌套字典 {Exif:{...}, TIFF:{...}, ExifAux:{...}, 顶层杂项}（iOS 实机校准）；拍平后再取键 */
export function flattenExif(tags: Raw): Raw {
  const out: Raw = {};
  for (const [k, v] of Object.entries(tags)) {
    const clean = k.replace(/[{}]/g, ''); // 兼容键名带字面花括号的渲染/实现差异
    if ((clean === 'Exif' || clean === 'TIFF' || clean === 'ExifAux') && v && typeof v === 'object') {
      Object.assign(out, v as Raw);
    } else {
      out[clean] = v;
    }
  }
  return out;
}

export function mapExif(raw: Raw): ExifInfo {
  const tags = flattenExif(raw);
  const aperture = num(pick(tags, ['FNumber', 'ApertureValue']));
  const shutter = num(pick(tags, ['ExposureTime']));
  const iso = num(first(pick(tags, ['ISOSpeedRatings', 'ISO', 'PhotoISOSpeed']))) ?? undefined;
  // 显示 35mm 等效焦距（如 FocalLength 6.86 → FocalLenIn35mmFilm 48）
  const focal = num(pick(tags, ['FocalLenIn35mmFilm', 'FocalLength']));
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

/** 读取并映射 EXIF + 文件名；失败/无 EXIF 返回全 null（截屏降级态） */
export async function readExif(localIdentifier: string): Promise<ExifInfo> {
  try {
    const asset = new Asset(localIdentifier);
    const [tags, filename] = await Promise.all([
      asset.getExif(),
      asset.getFilename().catch(() => null),
    ]);
    const info = mapExif(tags);
    return { ...info, fileName: info.fileName ?? filename ?? null };
  } catch {
    return EMPTY;
  }
}
