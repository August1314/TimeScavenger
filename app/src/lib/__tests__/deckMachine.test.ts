import { createDeck, deckReducer, type DeckState } from '../deckMachine';

const items = [
  { id: 'A', uri: 'ph://A' },
  { id: 'B', uri: 'ph://B' },
  { id: 'C', uri: 'C' },
];

function idle(): DeckState {
  return createDeck(items);
}

describe('deckMachine', () => {
  it('swipe up deletes current card and advances', () => {
    const { state, action } = deckReducer(idle(), { type: 'swipe', dir: 'up' });
    expect(action).toEqual({ kind: 'delete', id: 'A' });
    expect(state.index).toBe(1);
    expect(state.status).toBe('idle'); // 简化：提交即完成
  });

  it('swipe down favorites current card and advances', () => {
    const { state, action } = deckReducer(idle(), { type: 'swipe', dir: 'down' });
    expect(action).toEqual({ kind: 'favorite', id: 'A' });
    expect(state.index).toBe(1);
  });

  it('swipe left/right just navigates but still marks seen', () => {
    const r1 = deckReducer(idle(), { type: 'swipe', dir: 'left' });
    expect(r1.action).toEqual({ kind: 'seen', id: 'A' });
    expect(r1.state.index).toBe(1);
    const r2 = deckReducer(r1.state, { type: 'swipe', dir: 'right' });
    expect(r2.state.index).toBe(0); // 回看
    expect(r2.action).toEqual({ kind: 'seen', id: 'A' }); // 重复 seen 幂等
  });

  it('animating state rejects new swipes (Review Focus #4)', () => {
    const animating: DeckState = { ...idle(), status: 'animating' };
    const { state, action } = deckReducer(animating, { type: 'swipe', dir: 'up' });
    expect(state).toBe(animating);
    expect(action).toBeNull();
  });

  it('double tap maps to configured action', () => {
    const s = { ...idle(), doubleTapAction: 'favorite' as const };
    const r = deckReducer(s, { type: 'doubleTap' });
    expect(r.action).toEqual({ kind: 'favorite', id: 'A' });
    expect(r.state.index).toBe(0); // 双击不翻页
  });

  it('pinch asks to open back-to-day for current card', () => {
    const r = deckReducer(idle(), { type: 'pinch' });
    expect(r.action).toEqual({ kind: 'backToDay', id: 'A' });
  });

  it('undo pops the last deleted card', () => {
    let s = idle();
    ({ state: s } = deckReducer(s, { type: 'swipe', dir: 'up' }));
    const r = deckReducer(s, { type: 'undo' });
    expect(r.action).toEqual({ kind: 'undoDelete', id: 'A' });
    expect(r.state.index).toBe(0);
  });

  it('exhausted deck returns null actions and done flag', () => {
    let s = idle();
    for (let i = 0; i < 3; i++) s = deckReducer(s, { type: 'swipe', dir: 'left' }).state;
    expect(s.done).toBe(true);
    const r = deckReducer(s, { type: 'swipe', dir: 'up' });
    expect(r.action).toBeNull();
  });

  it('undo works even in done state (T7.3 ruling 5)', () => {
    let s = createDeck(items);
    s = deckReducer(s, { type: 'swipe', dir: 'up' }).state; // A deleted, idx1
    s = deckReducer(s, { type: 'swipe', dir: 'up' }).state; // B deleted, idx2
    s = deckReducer(s, { type: 'swipe', dir: 'up' }).state; // C deleted, done
    expect(s.done).toBe(true);
    const r = deckReducer(s, { type: 'undo' });
    expect(r.action).toEqual({ kind: 'undoDelete', id: 'C' });
    expect(r.state.done).toBe(false);
    expect(r.state.index).toBe(2);
  });
});
