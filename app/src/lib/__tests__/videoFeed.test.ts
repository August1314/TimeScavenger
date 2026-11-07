import { snapIndex, seekRatio } from '../videoFeed';

describe('videoFeed', () => {
  it('snapIndex rounds to nearest page and clamps negatives', () => {
    expect(snapIndex(812, 812)).toBe(1);
    expect(snapIndex(300, 812)).toBe(0);
    expect(snapIndex(-50, 812)).toBe(0);
  });
  it('seekRatio clamps to [0, 0.999]', () => {
    expect(seekRatio(50, 0, 200)).toBeCloseTo(0.25);
    expect(seekRatio(-10, 0, 200)).toBe(0);
    expect(seekRatio(999, 0, 200)).toBe(0.999);
  });
});
