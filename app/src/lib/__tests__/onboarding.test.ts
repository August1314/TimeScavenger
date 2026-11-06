import { nextOnboarding, type OnbState, type OnbEvent } from '../onboarding';

function run(events: OnbEvent[], start: OnbState = { phase: 'unknown' }): OnbState {
  return events.reduce((s, e) => nextOnboarding(s, e), start);
}

describe('onboarding state machine', () => {
  it('undecided → request → granted → import → ready', () => {
    const s = run([
      { type: 'check', status: 'undetermined' },
      { type: 'userContinue' },
      { type: 'result', status: 'granted' },
      { type: 'importDone', count: 6848 },
    ]);
    expect(s).toEqual({ phase: 'ready' });
  });

  it('restricted leads to guide, then granted can proceed', () => {
    const s = run([
      { type: 'check', status: 'restricted' },
      { type: 'openSettings' },
      { type: 'result', status: 'granted' },
      { type: 'importDone', count: 10 },
    ]);
    expect(s.phase).toBe('ready');
  });

  it('denied stays in guide', () => {
    const s = run([{ type: 'check', status: 'denied' }]);
    expect(s).toEqual({ phase: 'guide', reason: 'denied' });
    const again = nextOnboarding(s, { type: 'result', status: 'granted' });
    expect(again.phase).toBe('guide'); // 需重新 check
    expect(nextOnboarding(s, { type: 'check', status: 'granted' })).toEqual({ phase: 'ask' });
  });

  it('importing shows progress and ignores stray events', () => {
    const importing = run([{ type: 'check', status: 'granted' }, { type: 'importStart' }]);
    expect(importing).toEqual({ phase: 'importing' });
    expect(nextOnboarding(importing, { type: 'userContinue' })).toEqual(importing);
  });
});
