/** 视频 Feed 纯计算：吸附下标 / seek 比例 */

export function snapIndex(offsetY: number, viewportHeight: number): number {
  return Math.max(0, Math.round(offsetY / viewportHeight));
}

export function seekRatio(clientX: number, trackLeft: number, trackWidth: number): number {
  const r = (clientX - trackLeft) / trackWidth;
  return Math.min(0.999, Math.max(0, r));
}
