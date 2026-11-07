import type { MediaType } from '../db/repo';

/** 分类判定的纯输入（从 expo-media-library AssetMetadata 映射而来） */
export interface AssetMetaLite {
  id: string;
  mediaType: 'image' | 'video' | 'audio' | 'unknown';
  width: number | null;
  height: number | null;
  duration: number | null;
  /** MediaSubtype 值（iOS）：screenshot/screenRecording/livePhoto/animation/panorama… */
  subtypes: string[];
}

const LONG_RATIO = 2.5;

/**
 * 优先级：截屏/录屏 > 实况 > 动图 > 自拍(智能相册成员) > 长图 > photo/video。
 * audio/unknown 返回 null（导入时跳过）。
 */
export function classifyAsset(meta: AssetMetaLite, selfieIds: Set<string>): MediaType | null {
  const s = new Set(meta.subtypes);
  if (s.has('pairedLivePhotoVideo')) return null; // 实况配对 MOV 不作为独立视频出现
  if (s.has('screenshot') || s.has('screenRecording')) return 'screenshot';
  if (s.has('livePhoto')) return 'live';
  if (s.has('animation')) return 'gif';
  if (selfieIds.has(meta.id)) return 'selfie';
  if (meta.mediaType === 'image') {
    const { width, height } = meta;
    if (width && height && !s.has('panorama')) {
      const ratio = Math.max(width, height) / Math.min(width, height);
      if (ratio >= LONG_RATIO) return 'long';
    }
    return 'photo';
  }
  if (meta.mediaType === 'video') return 'video';
  return null;
}
