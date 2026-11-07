/** 视频 Feed 纯计算：吸附下标 */

export function snapIndex(offsetY: number, viewportHeight: number): number {
  return Math.max(0, Math.round(offsetY / viewportHeight));
}
