import { mapExif } from '../exif';

describe('mapExif', () => {
  it('parses common iOS EXIF tag shapes', () => {
    const info = mapExif({
      FNumber: { numerator: 178, denominator: 100 },
      ExposureTime: { numerator: 1, denominator: 60 },
      ISOSpeedRatings: [400],
      FocalLength: 24,
      Make: 'Apple',
      Model: 'iPhone 14 Pro Max',
      OriginalFilename: 'IMG_6752.JPG',
    });
    expect(info.aperture).toBe('f1.78');
    expect(info.shutter).toBe('1/60 s');
    expect(info.iso).toBe('ISO 400');
    expect(info.focal).toBe('24 mm');
    expect(info.camera).toBe('Apple iPhone 14 Pro Max');
    expect(info.fileName).toBe('IMG_6752.JPG');
  });

  it('accepts plain numbers and strings', () => {
    const info = mapExif({ FNumber: 2.8, ExposureTime: 0.5, ISO: 100, LensModel: 'iPhone back camera 24mm' });
    expect(info.aperture).toBe('f2.8');
    expect(info.shutter).toBe('1/2 s');
    expect(info.iso).toBe('ISO 100');
  });

  it('flattens iOS nested dictionaries (Exif/TIFF submaps)', () => {
    const info = mapExif({
      Exif: { FNumber: 1.78, ExposureTime: 0.0002089864158829676, ISOSpeedRatings: [64], FocalLenIn35mmFilm: 48 },
      '{TIFF}': { Make: 'Apple', Model: 'iPhone 14 Pro Max' },
      PixelHeight: 3024,
    });
    expect(info.aperture).toBe('f1.78');
    expect(info.shutter).toBe('1/4785 s');
    expect(info.iso).toBe('ISO 64');
    expect(info.focal).toBe('48 mm');
    expect(info.camera).toBe('Apple iPhone 14 Pro Max');
  });

  it('returns all null without throwing for missing tags (screenshots)', () => {
    const info = mapExif({});
    expect(info).toEqual({ aperture: null, shutter: null, iso: null, focal: null, camera: null, fileName: null });
  });
});
