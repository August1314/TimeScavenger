import { paletteFor } from '../palette';

describe('paletteFor', () => {
  it('is deterministic per id', () => {
    expect(paletteFor('ph://AAA')).toEqual(paletteFor('ph://AAA'));
  });

  it('different ids usually differ', () => {
    const a = paletteFor('ph://AAA');
    const b = paletteFor('ph://BBB');
    expect(a).not.toEqual(b);
  });

  it('top is a mid-brightness hex, bottom is fixed #161627 (UI设计规范 §1)', () => {
    for (let i = 0; i < 50; i++) {
      const [top, bottom] = paletteFor(`id-${i}`);
      expect(top).toMatch(/^#[0-9a-f]{6}$/i);
      expect(bottom).toBe('#161627');
    }
  });

  it('falls back to default for empty id', () => {
    expect(paletteFor('')).toEqual(['#8a7a63', '#161627']);
  });
});
