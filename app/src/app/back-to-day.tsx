import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const COL_W = Math.round((W - 24 - GAP) / 2); // 两列宽
// 原版统一格子尺寸（IMG_1516 第一行两图同为 205x380，横图也裁成竖格）
const CELL_H = Math.round(COL_W * 1.85);

type Filter = 'all' | 'photo' | 'video';
const FILTER_LABELS: Record<Filter, string> = { all: '照片和视频', photo: '照片', video: '视频' };

export default function BackToDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const contentWRef = useRef(0);
  const viewWRef = useRef(W);

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

  // 原版为"行式"：奇偶分两行、每行顶边对齐、行内保留各自宽高比（IMG_1516 对比裁决）
  const rows: MediaRow[][] = useMemo(() => {
    const r1: MediaRow[] = [];
    const r2: MediaRow[] = [];
    filtered.forEach((it, i) => (i % 2 === 0 ? r1 : r2).push(it));
    return [r1, r2];
  }, [filtered]);

  const anchorCol = Math.max(0, Math.floor(filtered.findIndex((r) => r.localIdentifier === id) / 2));

  const jumpToAnchor = useCallback(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, anchorCol * (COL_W + GAP)), animated: true });
  }, [anchorCol]);

  // 刻度条拖动 → 跳转滚动位置
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const max = Math.max(1, contentWRef.current - viewWRef.current);
        scrollRef.current?.scrollTo({ x: (e.nativeEvent.locationX / 220) * max, animated: false });
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(220, e.nativeEvent.locationX));
        const max = Math.max(1, contentWRef.current - viewWRef.current);
        scrollRef.current?.scrollTo({ x: (x / 220) * max, animated: false });
      },
    }),
  ).current;

  return (
    <View style={styles.root}>
      <GradientBackground seed={id} />

      {/* 顶栏（原版：‹ ☰ 日期✓ —— ☰=过滤，✓=返回） */}
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

      {/* 错落照片墙：两行、保留宽高比、横滑 */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.wall}
        onScroll={(e) => {
          contentWRef.current = e.nativeEvent.contentSize.width;
          viewWRef.current = e.nativeEvent.layoutMeasurement.width;
          const max = Math.max(1, e.nativeEvent.contentSize.width - e.nativeEvent.layoutMeasurement.width);
          setProgress(Math.min(1, e.nativeEvent.contentOffset.x / max));
        }}
        scrollEventThrottle={32}
      >
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((it) => (
              <TouchableOpacity
                key={it.localIdentifier}
                activeOpacity={0.9}
                style={styles.cell}
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

  wall: { gap: GAP, paddingHorizontal: 12, flexDirection: 'column' },
  row: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start', paddingVertical: 8 },
  cell: { width: COL_W, height: CELL_H, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1c1c24' },
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
