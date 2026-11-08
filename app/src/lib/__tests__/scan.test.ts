import { resolveCreationTime, normalizeCreationTime } from '../scan';

describe('normalizeCreationTime', () => {
  it('null/0 → 0', () => {
    expect(normalizeCreationTime(null)).toBe(0);
    expect(normalizeCreationTime(0)).toBe(0);
  });
  it('秒级(<1e11)归一化为毫秒', () => {
    expect(normalizeCreationTime(1794119249)).toBe(1794119249000);
  });
  it('毫秒原样', () => {
    expect(normalizeCreationTime(1794119249476)).toBe(1794119249476);
  });
});

describe('resolveCreationTime（Android 时间回退链，真机 OPPO 实证）', () => {
  it('date_taken 有值优先用（毫秒）', () => {
    expect(resolveCreationTime(1691311260000, 1691311260)).toBe(1691311260000);
  });
  it('date_taken 为 null（微信 mmexport/迁移无 EXIF）→ 回退 date_modified（秒→毫秒）', () => {
    expect(resolveCreationTime(null, 1789479767)).toBe(1789479767000);
  });
  it('date_taken 为 0 同样回退', () => {
    expect(resolveCreationTime(0, 1783771336)).toBe(1783771336000);
  });
  it('两者皆 null → 0（不再产生 1970 假时间以外的猜测）', () => {
    expect(resolveCreationTime(null, null)).toBe(0);
  });
  it('taken 秒级也归一化', () => {
    expect(resolveCreationTime(1691311260, null)).toBe(1691311260000);
  });
});
