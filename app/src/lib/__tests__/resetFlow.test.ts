import { SCOPE_LABELS, resetConfirmText, nextResetState, type ResetFlowState } from '../resetFlow';

describe('SCOPE_LABELS', () => {
  it('covers all five scopes', () => {
    expect(Object.keys(SCOPE_LABELS).sort()).toEqual(
      ['all', 'photos', 'photosNoScreenshots', 'screenshots', 'videos'].sort(),
    );
  });
});

describe('resetConfirmText', () => {
  it('maps scope to original-phrase confirmation (en_localizable evidence)', () => {
    expect(resetConfirmText('screenshots')).toBe('将重置截屏的浏览记录，重置后，这些项目会重新出现在浏览过程中。');
    expect(resetConfirmText('photos')).toBe('将重置照片的浏览记录，重置后，这些项目会重新出现在浏览过程中。');
    expect(resetConfirmText('photosNoScreenshots')).toContain('不含截屏');
    expect(resetConfirmText('all')).toContain('所有照片、截屏和视频');
  });
});

describe('nextResetState', () => {
  const idle: ResetFlowState = { phase: 'idle' };

  it('idle → pick → confirm → busy → done', () => {
    const picked = nextResetState(idle, { type: 'pick', scope: 'videos' });
    expect(picked).toEqual({ phase: 'picked', scope: 'videos' });
    const confirmed = nextResetState(picked, { type: 'confirm' });
    expect(confirmed).toEqual({ phase: 'busy', scope: 'videos' });
    const done = nextResetState(confirmed, { type: 'done' });
    expect(done).toEqual({ phase: 'done', scope: 'videos' });
    const closed = nextResetState(done, { type: 'close' });
    expect(closed).toEqual(idle);
  });

  it('ignores confirm without pick; close resets anytime', () => {
    expect(nextResetState(idle, { type: 'confirm' })).toEqual(idle);
    expect(nextResetState({ phase: 'busy', scope: 'all' }, { type: 'close' })).toEqual(idle);
  });
});
