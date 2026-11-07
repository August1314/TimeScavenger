export type TimeFormat = 'relative' | 'date';

const DAY = 86400_000;

export function formatTime(ts: number, fmt: TimeFormat, now: number = Date.now()): string {
  if (fmt === 'date') {
    const d = new Date(ts);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < DAY) return `${Math.floor(diff / 3600_000)}小时前`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return '昨天';
  if (days === 2) return '前天';
  if (days < 365) return `${days}天前`;
  return `${Math.floor(days / 365)}年前`;
}
