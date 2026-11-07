import { toggleId, selectedIdsOf, allSelected } from '../selection';

describe('selection', () => {
  it('toggle adds and removes ids', () => {
    let s = toggleId([], 'A');
    expect(s).toEqual(['A']);
    s = toggleId(s, 'B');
    expect(s.sort()).toEqual(['A', 'B']);
    s = toggleId(s, 'A');
    expect(s).toEqual(['B']);
  });

  it('selectedIdsOf: empty selection means all when defaultSelectAll', () => {
    const items = [{ id: 'A' }, { id: 'B' }];
    expect(selectedIdsOf(items, null)).toEqual(['A', 'B']); // null=全选
    expect(selectedIdsOf(items, ['A'])).toEqual(['A']);
  });

  it('allSelected detects full selection', () => {
    expect(allSelected(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(allSelected(['A', 'B'], ['A'])).toBe(false);
  });
});
