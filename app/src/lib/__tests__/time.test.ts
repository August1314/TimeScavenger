import { formatTime } from '../time';

const NOW = new Date('2026-11-06T12:00:00+08:00').getTime();

describe('formatTime relative', () => {
  it('刚刚 / 分钟前 / 小时前 / 天前 / 年前', () => {
    expect(formatTime(NOW - 30_000, 'relative', NOW)).toBe('刚刚');
    expect(formatTime(NOW - 5 * 60_000, 'relative', NOW)).toBe('5分钟前');
    expect(formatTime(NOW - 3 * 3600_000, 'relative', NOW)).toBe('3小时前');
    expect(formatTime(NOW - 187 * 86400_000, 'relative', NOW)).toBe('187天前');
    expect(formatTime(NOW - 730 * 86400_000, 'relative', NOW)).toBe('2年前');
  });
  it('昨天/前天/明天', () => {
    expect(formatTime(NOW - 1.2 * 86400_000, 'relative', NOW)).toBe('昨天');
    expect(formatTime(NOW - 2.2 * 86400_000, 'relative', NOW)).toBe('前天');
  });
});

describe('formatTime date', () => {
  it('具体日期格式 yyyy年M月d日', () => {
    expect(formatTime(new Date('2024-05-03T18:57:00+08:00').getTime(), 'date', NOW)).toBe(
      '2024年5月3日',
    );
  });
});
