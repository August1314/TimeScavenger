import { snapIndex, settlePage, dragPage } from '../videoFeed';

const H = 700; // 单格高

describe('videoFeed', () => {
  it('snapIndex rounds to nearest page and clamps negatives', () => {
    expect(snapIndex(812, 812)).toBe(1);
    expect(snapIndex(300, 812)).toBe(0);
    expect(snapIndex(-50, 812)).toBe(0);
  });

  describe('settlePage（惯性结算判定）', () => {
    it('落到别的页 → 直接取落点页', () => {
      expect(settlePage(2, 3 * H, H, 10, { v: 0, d: 0 })).toBe(3);
    });
    it('回弹回原页但松手是快甩且方向一致 → 沿方向翻一条', () => {
      expect(settlePage(2, 2 * H, H, 10, { v: 0.8, d: 60 })).toBe(3);
      expect(settlePage(2, 2 * H, H, 10, { v: -0.8, d: -60 })).toBe(1);
    });
    it('甩速不足或方向不一致 → 保持原页', () => {
      expect(settlePage(2, 2 * H, H, 10, { v: 0.2, d: 60 })).toBe(2);
      expect(settlePage(2, 2 * H, H, 10, { v: 0.8, d: -60 })).toBe(2);
    });
    it('release 已消费（清零）后再次结算不再翻页——防级联连跳回归', () => {
      const hot = { v: 1, d: 60 };
      expect(settlePage(2, 2 * H, H, 10, hot)).toBe(3);
      // 消费后（组件把 release 置 0）程序化滚动引发的二次结算必须停在原页
      expect(settlePage(3, 3 * H, H, 10, { v: 0, d: 0 })).toBe(3);
    });
    it('尾部/头部越界被钳制', () => {
      expect(settlePage(9, 9 * H, H, 10, { v: 1, d: 60 })).toBe(9);
      expect(settlePage(0, 0, H, 10, { v: -1, d: -60 })).toBe(0);
    });
  });

  describe('dragPage（慢拖松手判定）', () => {
    it('快甩小幅 → 沿速度方向翻一条', () => {
      expect(dragPage(2, 2 * H + 80, H, 10, { v: 0.8, d: 0 })).toBe(3);
      expect(dragPage(2, 2 * H - 80, H, 10, { v: -0.8, d: 0 })).toBe(1);
    });
    it('慢拖超过 1/4 屏 → 沿拖距方向翻一条', () => {
      expect(dragPage(2, 2 * H + H * 0.3, H, 10, { v: 0, d: 0 })).toBe(3);
    });
    it('慢拖不足 1/4 屏 → 回弹原页', () => {
      expect(dragPage(2, 2 * H + H * 0.1, H, 10, { v: 0, d: 0 })).toBe(2);
    });
    it('已消费 release 的二次判定不再翻页——防级联连跳回归', () => {
      expect(dragPage(2, 2 * H + 80, H, 10, { v: 0.8, d: 0 })).toBe(3);
      expect(dragPage(3, 3 * H, H, 10, { v: 0, d: 0 })).toBe(3);
    });
  });
});
