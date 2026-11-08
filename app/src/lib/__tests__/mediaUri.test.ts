import { toDisplayUri } from '../mediaUri';

describe('mediaUri', () => {
  it('passes iOS ids through unchanged', () => {
    expect(toDisplayUri('ph://ABC', 'photo', 'ios')).toBe('ph://ABC');
  });
  it('builds content uri for android video', () => {
    expect(toDisplayUri('123', 'video', 'android')).toBe(
      'content://media/external/video/media/123'
    );
  });
  it('maps every non-video mediaType to images', () => {
    expect(toDisplayUri('9', 'screenshot', 'android')).toBe(
      'content://media/external/images/media/9'
    );
    expect(toDisplayUri('9', 'live', 'android')).toBe(
      'content://media/external/images/media/9'
    );
  });
  it('passes existing content uris through on android', () => {
    expect(toDisplayUri('content://media/x', 'photo', 'android')).toBe('content://media/x');
  });
});
