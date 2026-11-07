import {
  fetchUnreviewedRandom,
  getSetting,
  markReviewed,
  type Category,
  type MediaRow,
} from '../db/repo';

export interface Group {
  items: MediaRow[];
  index: number;
}

const DEFAULT_SIZE = 15;

function sizeKey(category: Category): string {
  return category === 'video' ? 'videosPerGroup' : 'photosPerGroup';
}

async function groupSize(category: Category): Promise<number> {
  const raw = await getSetting(sizeKey(category));
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SIZE;
}

export async function nextGroup(category: Category): Promise<Group> {
  const size = await groupSize(category);
  const items = await fetchUnreviewedRandom(category, size);
  return { items, index: 0 };
}

/** 卡片被看到即记已读（3 年内不再出现；重置由设置页负责） */
export async function markSeen(item: MediaRow): Promise<void> {
  await markReviewed([item.localIdentifier], new Date());
}

export async function groupSizeLabel(category: Category): Promise<string> {
  return String(await groupSize(category));
}
