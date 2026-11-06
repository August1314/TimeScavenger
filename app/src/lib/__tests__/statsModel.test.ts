import { formatBytes, totalFreed } from '../statsModel';
import type { StatGroup } from '../../db/repo';

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(479895)).toBe('468.6 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3 + 512 * 1024 ** 2)).toBe('3.5 GB');
    expect(formatBytes(12 * 1024 ** 4)).toBe('12.0 TB');
  });
});

describe('totalFreed', () => {
  it('sums bytes across groups', () => {
    const groups: StatGroup[] = [
      { group: 'photos', viewed: 10, deleted: 2, freedBytes: 1024 },
      { group: 'screenshots', viewed: 5, deleted: 1, freedBytes: 2048 },
      { group: 'videos', viewed: 3, deleted: 0, freedBytes: 0 },
    ];
    expect(totalFreed(groups)).toBe(3072);
  });
});
