/** 视频 Feed 纯计算：吸附下标 / 翻页判定 */

export function snapIndex(offsetY: number, viewportHeight: number): number {
  return Math.max(0, Math.round(offsetY / viewportHeight));
}

/** 松手瞬间信息：v=速度(px/ms，下滑为正)，d=相对当前格边界的位移 */
export interface SwipeRelease {
  v: number;
  d: number;
}

export const FLING_V = 0.45;

function clampPage(i: number, count: number): number {
  return Math.max(0, Math.min(i, count - 1));
}

/**
 * 惯性结算判定：落到别的页取落点；回弹回原页但松手是快甩且方向一致则沿方向翻一条。
 * release 必须由调用方一次性消费（用后置零）——翻页动画会再次触发结算事件，
 * 若 release 未消费将造成"滑一下无限连跳"级联。
 */
export function settlePage(
  current: number,
  offsetY: number,
  viewportHeight: number,
  count: number,
  release: SwipeRelease,
): number {
  const landed = snapIndex(offsetY, viewportHeight);
  if (landed !== current) return landed;
  if (Math.abs(release.v) > FLING_V && Math.sign(release.v) === Math.sign(release.d)) {
    return clampPage(current + (release.v > 0 ? 1 : -1), count);
  }
  return current;
}

/** 慢拖松手（无惯性）判定：快甩沿速度方向翻；拖距超 1/4 屏沿拖距方向翻；否则回弹原页 */
export function dragPage(
  current: number,
  offsetY: number,
  viewportHeight: number,
  count: number,
  release: SwipeRelease,
): number {
  const d = offsetY - current * viewportHeight;
  if (Math.abs(release.v) > FLING_V) return clampPage(current + (release.v > 0 ? 1 : -1), count);
  if (Math.abs(d) > viewportHeight * 0.25) return clampPage(current + (d > 0 ? 1 : -1), count);
  return current;
}
