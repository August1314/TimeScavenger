const DEFAULT: [string, string] = ['#2b2b35', '#151520'];

/** FNV-1a 32bit */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 深色 HSL→hex（L 控制在 0.10–0.24 的暗调区） */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * 确定性渐变（近似原 app"照片取样双色深色渐变"）：
 * 同一 assetId 恒定；top 亮、bottom 暗。M3 升级为 expo-gl 内容取样。
 */
export function paletteFor(assetId: string): [string, string] {
  if (!assetId) return DEFAULT;
  const h = hash(assetId);
  const hue = h % 360;
  const sat = 0.25 + ((h >>> 9) % 20) / 100; // 0.25–0.44
  const topL = 0.18 + ((h >>> 17) % 6) / 100; // 0.18–0.23
  const bottomL = 0.10 + ((h >>> 23) % 3) / 100; // 0.10–0.12
  const hueBottom = (hue + 30) % 360;
  return [hslToHex(hue, sat, topL), hslToHex(hueBottom, sat * 0.8, bottomL)];
}

export function isDarkHex(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 90; // 暗调
}
