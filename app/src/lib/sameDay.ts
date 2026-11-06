import { fetchByDayRange, type MediaRow } from '../db/repo';

/** 本地日历日的 [当日 0 点, 次日 0 点)（跨时区/DST 安全，T10 裁决） */
export function dayBounds(ms: number): [number, number] {
  const start = new Date(ms);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}

/** 与锚点照片同一本地日的全部媒体（含视频与截屏） */
export async function sameDayItems(anchor: MediaRow): Promise<MediaRow[]> {
  const [s, e] = dayBounds(anchor.creationDate);
  return fetchByDayRange(s, e);
}

/** 标题日期，如 2025/1/7 */
export function dayTitle(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
