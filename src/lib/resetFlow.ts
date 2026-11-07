import type { ResetScope } from '../db/repo';

export const SCOPE_LABELS: Record<ResetScope, string> = {
  all: '所有内容（照片、截屏、视频）',
  photos: '仅照片',
  photosNoScreenshots: '仅照片（不含截屏）',
  screenshots: '仅截屏',
  videos: '仅视频',
};

/** 各重置范围的确认文案 */
export function resetConfirmText(scope: ResetScope): string {
  switch (scope) {
    case 'all':
      return '将重置所有照片、截屏和视频的浏览记录，重置后，这些项目会重新出现在浏览过程中。';
    case 'photos':
      return '将重置照片的浏览记录，重置后，这些项目会重新出现在浏览过程中。';
    case 'photosNoScreenshots':
      return '将重置照片（不含截屏）的浏览记录，重置后，这些项目会重新出现在浏览过程中。';
    case 'screenshots':
      return '将重置截屏的浏览记录，重置后，这些项目会重新出现在浏览过程中。';
    case 'videos':
      return '将重置视频的浏览记录，重置后，这些项目会重新出现在浏览过程中。';
  }
}

export type ResetFlowState =
  | { phase: 'idle' }
  | { phase: 'picked'; scope: ResetScope }
  | { phase: 'busy'; scope: ResetScope }
  | { phase: 'done'; scope: ResetScope };

export type ResetFlowEvent =
  | { type: 'pick'; scope: ResetScope }
  | { type: 'confirm' }
  | { type: 'done' }
  | { type: 'close' };

export function nextResetState(s: ResetFlowState, e: ResetFlowEvent): ResetFlowState {
  if (e.type === 'close') return { phase: 'idle' };
  switch (s.phase) {
    case 'idle':
      return e.type === 'pick' ? { phase: 'picked', scope: e.scope } : s;
    case 'picked':
      if (e.type === 'pick') return { phase: 'picked', scope: e.scope };
      return e.type === 'confirm' ? { phase: 'busy', scope: s.scope } : s;
    case 'busy':
      return e.type === 'done' ? { phase: 'done', scope: s.scope } : s;
    case 'done':
      return s;
  }
}
