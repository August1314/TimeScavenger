import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text, View, StyleSheet, TouchableOpacity, ScrollView, Dimensions, PanResponder, Modal,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GradientBackground } from '../theme/GradientBackground';
import { C } from '../theme/colors';
import { dayTitle, sameDayItems } from '../lib/sameDay';
import { getMediaById } from '../db/repo';
import type { MediaRow } from '../db/repo';

const W = Dimensions.get('window').width;
const GAP = 10;
const COL_W = Math.round((W - 24 - GAP) / 2);

type Filter = 'all' | 'photo' | 'video';
const FILTER_LABELS: Record<Filter, string> = { all: '照片和视频', photo: '照片', video: '视频' };

/** 双列瀑布流：保留宽高比，限幅防极端长图 */
function cellHeight(row: MediaRow): number {
  const aspect = row.width > 0 && row.height > 0 ? row.width / row.height : 0.75;
  const h = COL_W / aspect;
  return Math.round(Math.max(COL_W * 0.7, Math.min(COL_W * 1.5, h)));
}

export default function BackToDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const contentHRef = useRef(0);
  const viewHRef = useRef(600);
  const anchorYRef = useRef(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void getMediaById(id).then((anchor) => {
      if (anchor && alive) void sameDayItems(anchor).then((all) => alive && setItems(all));
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const filtered = useMemo(
    () => items.filter((r) => (filter === 'all' ? true : filter === 'video' ? r.mediaType === 'video' : r.mediaType !== 'video')),
    [items, filter],
  );

  // 最短列优先分配 → 两列底边自然齐平（瀑布流核心）
  const cols = useMemo(() => {
    const c: [MediaRow[], MediaRow[]] = [[], []];
    const h = [0, 0];
    for (const it of filtered) {
      const k = h[0] <= h[1] ? 0 : 1;
      c[k].push(it);
      h[k] += cellHeight(it) + GAP;
      if (it.localIdentifier === id) anchorYRef.current = h[k] - GAP;
    }
    return c;
  }, [filtered, id]);

  const jumpToAnchor = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, anchorYRef.current - 20), animated: true });
  };

  // 刻度条拖动 → 纵向滚动跳转
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const max = Math.max(1, contentHRef.current - viewHRef.current);
        scrollRef.current?.scrollTo({ y: (e.nativeEvent.locationX / 220) * max, animated: false });
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(220, e.nativeEvent.locationX));
        const max = Math.max(1, contentHRef.current - viewHRef.current);
        scrollRef.current?.scrollTo({ y: (x / 220) * max, animated: false });
      },
    }),
  ).current;

  return (
    <View style={styles.root}>
      <GradientBackground seed={id} />

      {/* 顶栏：‹ ☰ 日期 ✓ —— ☰=过滤，✓=返回 */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setMenuOpen(true)}>
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.titleSub}>回到那天</Text>
          <Text style={styles.titleMain}>{filtered.length > 0 ? dayTitle(filtered[0].creationDate) : '…'}</Text>
        </View>
        <TouchableOpacity style={styles.roundBtn} onPress={() => router.back()}>
          <Ionicons name="checkmark" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 瀑布流：纵向滚动、两列、保留宽高比 */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.wall}
        onScroll={(e) => {
          contentHRef.current = e.nativeEvent.contentSize.height;
          viewHRef.current = e.nativeEvent.layoutMeasurement.height;
          const max = Math.max(1, e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height);
          setProgress(Math.min(1, e.nativeEvent.contentOffset.y / max));
        }}
        scrollEventThrottle={32}
      >
        {cols.map((col, ci) => (
          <View key={ci} style={styles.column}>
            {col.map((it) => (
              <TouchableOpacity
                key={it.localIdentifier}
                activeOpacity={0.9}
                style={[styles.cell, { height: cellHeight(it) }]}
                onPress={() => router.push({ pathname: '/day-preview', params: { id: it.localIdentifier } })}
              >
                <Image source={{ uri: it.localIdentifier }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={it.localIdentifier} />
                {it.mediaType === 'live' && (
                  <View style={styles.liveBadge} pointerEvents="none">
                    <Text style={styles.liveBadgeText}>◉ 实况</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>没有符合过滤条件的照片</Text>}
      </ScrollView>

      {/* 底栏：↻ 回锚点 + 可拖动刻度条 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.roundBtn} onPress={jumpToAnchor}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.ticks} {...scrub.panHandlers}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={i} style={[styles.tick, i / 24 <= progress && styles.tickOn]} />
          ))}
        </View>
        <View style={styles.roundBtnPlaceholder} />
      </View>

      {/* ☰ 过滤菜单 */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            {(['photo', 'video', 'all'] as Filter[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={styles.menuRow}
                onPress={() => {
                  setFilter(f);
                  setMenuOpen(false);
                }}
              >
                <Text style={[styles.menuText, filter === f && styles.menuOn]}>{FILTER_LABELS[f]}</Text>
                {filter === f && <Ionicons name="checkmark" size={18} color={C.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 10,
  },
  topLeft: { flexDirection: 'row', gap: 10 },
  roundBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.capsuleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnPlaceholder: { width: 48, height: 48 },
  titleWrap: { alignItems: 'center' },
  titleSub: { color: C.textDim, fontSize: 13 },
  titleMain: { color: '#fff', fontSize: 22, fontWeight: '800' },

  wall: { flexDirection: 'row', gap: GAP, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  column: { flex: 1, gap: GAP },
  cell: { width: COL_W, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1c1c24' },
  liveBadge: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { color: C.textDim, fontSize: 15, alignSelf: 'center', marginTop: 80 },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 34, paddingTop: 10,
  },
  ticks: {
    flexDirection: 'row', alignItems: 'center', gap: 4, width: 220, height: 40,
    backgroundColor: 'rgba(30,30,40,0.6)', borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center',
  },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  tickOn: { backgroundColor: '#fff', height: 16 },

  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#23232C', borderRadius: 20, paddingVertical: 8, width: 240 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, paddingHorizontal: 20 },
  menuText: { color: '#fff', fontSize: 16 },
  menuOn: { color: C.accent, fontWeight: '700' },
});
