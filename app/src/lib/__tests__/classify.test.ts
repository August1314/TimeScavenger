import { classifyAsset, type AssetMetaLite } from '../classify';

function meta(over: Partial<AssetMetaLite>): AssetMetaLite {
  return {
    id: 'X', mediaType: 'image', width: 1000, height: 1000,
    duration: null, subtypes: [], ...over,
  };
}

describe('classifyAsset', () => {
  it('screenshot subtype wins over everything', () => {
    expect(classifyAsset(meta({ subtypes: ['screenshot'] }), new Set())).toBe('screenshot');
    expect(classifyAsset(meta({ mediaType: 'video', duration: 3, subtypes: ['screenRecording'] }), new Set())).toBe('screenshot');
  });

  it('live photo and animation(gif)', () => {
    expect(classifyAsset(meta({ subtypes: ['livePhoto'] }), new Set())).toBe('live');
    expect(classifyAsset(meta({ mediaType: 'video', duration: 0, subtypes: ['animation'] }), new Set())).toBe('gif');
  });

  it('selfie via smart album membership, below subtype priority', () => {
    expect(classifyAsset(meta({ id: 'S1' }), new Set(['S1']))).toBe('selfie');
    expect(classifyAsset(meta({ id: 'S1', subtypes: ['screenshot'] }), new Set(['S1']))).toBe('screenshot');
  });

  it('long image by aspect ratio >= 2.5 (either orientation), panorama excluded from long', () => {
    expect(classifyAsset(meta({ width: 1200, height: 3000 }), new Set())).toBe('long');
    expect(classifyAsset(meta({ width: 3000, height: 1000 }), new Set())).toBe('long');
    expect(classifyAsset(meta({ width: 1200, height: 2999 }), new Set())).toBe('photo');
    expect(classifyAsset(meta({ width: 3000, height: 1000, subtypes: ['panorama'] }), new Set())).toBe('photo');
  });

  it('plain image/video and audio/unknown return null-safe defaults', () => {
    expect(classifyAsset(meta({}), new Set())).toBe('photo');
    expect(classifyAsset(meta({ mediaType: 'video', duration: 12 }), new Set())).toBe('video');
    expect(classifyAsset(meta({ mediaType: 'audio', duration: 30 }), new Set())).toBeNull();
    expect(classifyAsset(meta({ mediaType: 'unknown' }), new Set())).toBeNull();
  });

  it('null dimensions do not crash and fall back to type default', () => {
    expect(classifyAsset(meta({ width: null, height: null }), new Set())).toBe('photo');
  });
});
