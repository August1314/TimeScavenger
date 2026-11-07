export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export interface DeckCard {
  id: string;
  uri: string;
}

export interface DeckState {
  items: DeckCard[];
  index: number;
  status: 'idle' | 'animating';
  done: boolean;
  doubleTapAction: 'favorite' | 'zoom';
  lastDeleted: DeckCard | null;
}

export type DeckEvent =
  | { type: 'swipe'; dir: SwipeDir }
  | { type: 'doubleTap' }
  | { type: 'pinch' }
  | { type: 'undo' }
  | { type: 'animStart' }
  | { type: 'animEnd' };

export type DeckAction =
  | { kind: 'delete'; id: string }
  | { kind: 'favorite'; id: string }
  | { kind: 'seen'; id: string }
  | { kind: 'undoDelete'; id: string }
  | { kind: 'backToDay'; id: string }
  | { kind: 'zoom'; id: string };

export function createDeck(items: DeckCard[], doubleTapAction: 'favorite' | 'zoom' = 'favorite'): DeckState {
  return { items, index: 0, status: 'idle', done: items.length === 0, doubleTapAction, lastDeleted: null };
}

function current(s: DeckState): DeckCard | null {
  return s.items[s.index] ?? null;
}

function advance(s: DeckState): DeckState {
  const next = s.index + 1;
  return { ...s, index: next, done: next >= s.items.length };
}

export function deckReducer(
  s: DeckState,
  e: DeckEvent,
): { state: DeckState; action: DeckAction | null } {
  if (e.type === 'animStart') return { state: { ...s, status: 'animating' }, action: null };
  if (e.type === 'animEnd') return { state: { ...s, status: 'idle' }, action: null };

  // Review Focus #4：动画进行中的手势一律忽略，防止重复消费
  if (s.status === 'animating') return { state: s, action: null };

  // T7.3 裁决5：done 状态允许撤回（不受 done 阻断）
  if (e.type === 'undo') {
    if (!s.lastDeleted) return { state: s, action: null };
    const id = s.lastDeleted.id;
    const back = Math.max(0, s.index - 1);
    return {
      state: { ...s, index: back, done: back >= s.items.length, lastDeleted: null },
      action: { kind: 'undoDelete', id },
    };
  }

  if (s.done) return { state: s, action: null };
  const c = current(s);
  if (!c) return { state: { ...s, done: true }, action: null };

  switch (e.type) {
    case 'swipe':
      switch (e.dir) {
        case 'up':
          return { state: advance({ ...s, lastDeleted: c }), action: { kind: 'delete', id: c.id } };
        case 'down':
          return { state: advance(s), action: { kind: 'favorite', id: c.id } };
        case 'left':
          return { state: advance(s), action: { kind: 'seen', id: c.id } };
        case 'right': {
          const back = Math.max(0, s.index - 1);
          const b = s.items[back];
          return { state: { ...s, index: back, done: false }, action: b ? { kind: 'seen', id: b.id } : null };
        }
      }
      break;
    case 'doubleTap':
      return {
        state: s,
        action: s.doubleTapAction === 'favorite' ? { kind: 'favorite', id: c.id } : { kind: 'zoom', id: c.id },
      };
    case 'pinch':
      return { state: s, action: { kind: 'backToDay', id: c.id } };
  }
  return { state: s, action: null };
}
