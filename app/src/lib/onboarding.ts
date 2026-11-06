export type PermStatus = 'granted' | 'limited' | 'denied' | 'restricted' | 'undetermined';

export type OnbState =
  | { phase: 'unknown' }
  | { phase: 'guide'; reason: 'denied' | 'restricted'; awaiting?: boolean }
  | { phase: 'ask' }
  | { phase: 'importing' }
  | { phase: 'ready' };

export type OnbEvent =
  | { type: 'check'; status: PermStatus }
  | { type: 'userContinue' }
  | { type: 'result'; status: PermStatus }
  | { type: 'openSettings' }
  | { type: 'importStart' }
  | { type: 'importDone'; count: number };

function afterCheck(status: PermStatus): OnbState {
  return status === 'granted' || status === 'limited' ? { phase: 'ask' } : { phase: 'guide', reason: status === 'denied' ? 'denied' : 'restricted' };
}

export function nextOnboarding(s: OnbState, e: OnbEvent): OnbState {
  switch (s.phase) {
    case 'unknown':
      return e.type === 'check' ? afterCheck(e.status) : s;
    case 'guide': {
      if (e.type === 'check') return afterCheck(e.status);
      if (e.type === 'userContinue') return { phase: 'ask' };
      if (e.type === 'openSettings') return { ...s, awaiting: true };
      if (e.type === 'result') {
        if (e.status === 'granted' || e.status === 'limited') return s.awaiting ? { phase: 'importing' } : s;
        return { phase: 'guide', reason: e.status === 'denied' ? 'denied' : 'restricted' };
      }
      return s;
    }
    case 'ask':
      if (e.type === 'importStart') return { phase: 'importing' };
      if (e.type === 'result') {
        return e.status === 'granted' || e.status === 'limited' ? { phase: 'importing' } : { phase: 'guide', reason: e.status === 'denied' ? 'denied' : 'restricted' };
      }
      return s; // userContinue：由 UI 发起系统请求
    case 'importing':
      return e.type === 'importDone' ? { phase: 'ready' } : s;
    case 'ready':
      return s;
  }
}
