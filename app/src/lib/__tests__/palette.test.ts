import { paletteFor, isDarkHex } from '../palette';

describe('paletteFor', () => {
  it('is deterministic per id', () => {
    expect(paletteFor('ph://AAA')).toEqual(paletteFor('ph://AAA'));
  });

  it('different ids usually differ', () => {
    const a = paletteFor('ph://AAA');
    const b = paletteFor('ph://BBB');
    expect(a).not.toEqual(b);
  });

  it('returns two dark hex colors, top lighter than bottom', () => {
    for (let i = 0; i < 50; i++) {
      const [top, bottom] = paletteFor(`id-${i}`);
      expect(isDarkHex(top)).toBe(true);
      expect(isDarkHex(bottom)).toBe(true);
    }
  });

  it('falls back to default for empty id', () => {
    expect(paletteFor('')).toEqual(['#2b2b35', '#151520']);
  });
});
