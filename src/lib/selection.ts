export function toggleId(sel: string[], id: string): string[] {
  return sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
}

/** selection=null 表示全选 */
export function selectedIdsOf(items: { id: string }[], selection: string[] | null): string[] {
  if (selection === null) return items.map((i) => i.id);
  const set = new Set(selection);
  return items.filter((i) => set.has(i.id)).map((i) => i.id);
}

export function allSelected(ids: string[], selection: string[]): boolean {
  const set = new Set(selection);
  return ids.length > 0 && ids.every((id) => set.has(id));
}
