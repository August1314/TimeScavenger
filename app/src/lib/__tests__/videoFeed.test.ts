import { snapIndex } from '../videoFeed';

describe('videoFeed', () => {
  it('snapIndex rounds to nearest page and clamps negatives', () => {
    expect(snapIndex(812, 812)).toBe(1);
    expect(snapIndex(300, 812)).toBe(0);
    expect(snapIndex(-50, 812)).toBe(0);
  });
});
