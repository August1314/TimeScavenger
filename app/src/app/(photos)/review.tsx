import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Text, View, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GradientBackground } from '../../theme/GradientBackground';
import { C } from '../../theme/colors';
import { CardStack } from '../../components/CardStack';
import { createDeck, deckReducer, type DeckAction, type DeckState } from '../../lib/deckMachine';
import { nextGroup, markSeen } from '../../lib/session';
import { pendingQueue } from '../../lib/deletion';
import { setFavorite, getAssetLocation } from '../../lib/assets';
import { placeName } from '../../lib/place';
import { formatTime } from '../../lib/time';
import { getSetting } from '../../db/repo';
import { setHapticsEnabled, hapticWarn, hapticSuccess, hapticLight, hapticSelect } from '../../lib/haptics';
import type { Category, MediaRow } from '../../db/repo';

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'photo') as Category;
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [timeFormat, setTimeFormat] = useState<'relative' | 'date'>('relative');
  const [place, setPlace] = useState<string | null>(null);
  const [, force] = useState(0);

  const currentId = deck?.items[deck.index]?.id;
  const [toast, setToast] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (s: string) => {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };
  useEffect(() => {
    setPlace(null);
    if (!currentId) return;
    let alive = true;
    (async () => {
      const loc = await getAssetLocation(currentId);
      if (loc && alive) {
        const name = await placeName(loc.latitude, loc.longitude);
        if (alive) setPlace(name);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentId]);

  useEffect(() => {
    (async () => {
      const tf = (await getSetting('timeFormat')) as 'relative' | 'date' | null;
      if (tf === 'date') setTimeFormat('date');
      const h = await getSetting('haptics');
      setHapticsEnabled(h !== 'off');
      const g = await nextGroup(category);
      setRows(g.items);
      const dta = (await getSetting('doubleTapAction')) === 'zoom' ? 'zoom' : 'favorite';
      setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier })), dta));
    })();
  }, [category]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.localIdentifier, r])), [rows]);

  const dispatch = useCallback(
    (e: Parameters<typeof deckReducer>[1]) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const { state, action } = deckReducer(prev, e);
        if (action) void run(action);
        return state;
      });
    },
    [],
  );

  const run = async (a: DeckAction) => {
    const row = rowById.get(a.id);
    switch (a.kind) {
      case 'delete':
        if (row) {
          pendingQueue.push(row);
          await markSeen(row);
        }
        hapticWarn();
        setHintVisible(false);
        showToast('已加入待删除 · 点 ↩ 撤回');
        break;
      case 'favorite':
        if (row) await markSeen(row);
        await setFavorite(a.id, true);
        hapticSuccess();
        setHintVisible(false);
        showToast('已收藏 · 同步到系统个人收藏');
        break;
      case 'seen':
        if (row) await markSeen(row);
        hapticLight();
        break;
      case 'undoDelete':
        pendingQueue.remove(a.id);
        hapticSelect();
        showToast('已撤回删除');
        break;
      case 'backToDay':
        router.push({ pathname: '/back-to-day', params: { id: a.id } });
        break;
      case 'zoom':
        break;
    }
  };

  if (!deck) {
    return (
      <View style={styles.root}>
        <GradientBackground />
        <View style={styles.center}>
          <Text style={styles.loading}>正在载入随机照片…</Text>
        </View>
      </View>
    );
  }

  const currentRow = rowById.get(deck.items[deck.index]?.id ?? '');
  const progress = deck.items.length ? deck.index / deck.items.length : 0;

  const nextSet = async () => {
    const g = await nextGroup(category);
    setRows(g.items);
    setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier }))));
    setHintVisible(true);
  };

  // 一组刷完 → 有待删除项则自动进入确认页（原 app 闭环）
  const doneRef = useRef(false);
  useEffect(() => {
    if (deck?.done && !doneRef.current) {
      doneRef.current = true;
      if (pendingQueue.list().length > 0) {
        router.push({ pathname: '/pending', params: { from: 'done' } });
      }
    }
    if (deck && !deck.done) doneRef.current = false;
  }, [deck]);

  const goHome = () => {
    if (pendingQueue.list().length > 0) {
      Alert.alert('返回前请先处理这些照片', '待删除的项目仍保留在你的相册中，直到你确认删除。', [
        { text: '保留待处理', onPress: () => router.back() },
        { text: '去处理', onPress: () => router.push({ pathname: '/pending', params: { from: 'done' } }) },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.root}>
      <GradientBackground seed={deck.items[deck.index]?.id} />

      {/* 顶栏 */}
      <View style={styles.topBar}>
        <RoundBtn label="‹" onPress={goHome} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <RoundBtn
          label="↑"
          onPress={() =>
            Share.share({ message: '像刷短视频一样刷自己的照片 —— 去留复刻' }).catch(() => {})
          }
        />
      </View>

      {/* 卡组 */}
      <View style={styles.deckArea}>
        {deck.done ? (
          <View style={styles.center}>
            <Text style={styles.doneTitle}>回顾完毕</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={nextSet}>
              <Text style={styles.primaryBtnText}>再来一组</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
              <Text style={styles.ghostBtnText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CardStack
            cards={deck.items}
            index={deck.index}
            badge={
              currentRow?.mediaType === 'live' ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>◉ 实况 ▾</Text>
                </View>
              ) : undefined
            }
            onSwipe={(dir) => dispatch({ type: 'swipe', dir })}
            onDoubleTap={() => dispatch({ type: 'doubleTap' })}
            onPinchOut={() => dispatch({ type: 'pinch' })}
          />
        )}
      </View>

      {/* 提示与反馈条 */}
      <View style={styles.feedbackRow}>
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : hintVisible && !deck.done ? (
          <Text style={styles.hint}>上滑待删除 · 下滑收藏 · 左右切换 · 捏合回到那天</Text>
        ) : null}
      </View>

      {/* 底栏 */}
      <View style={styles.bottomBar}>
        <RoundBtn
          label="♡"
          onPress={() => {
            const id = deck.items[deck.index]?.id;
            if (!id) return;
            void setFavorite(id, true).then(() => hapticSelect());
          }}
        />
        <View style={styles.timeCapsule}>
          <View style={{ gap: 2 }}>
            <Text style={styles.timeText}>
              {currentRow ? formatTime(currentRow.creationDate, timeFormat) : '未知时间'}
            </Text>
            {place ? <Text style={styles.placeText}>{place}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => {
              const id = deck.items[deck.index]?.id;
              if (id) router.push({ pathname: '/photo-info', params: { id } });
            }}
          >
            <Text style={styles.infoGlyph}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        <RoundBtn label="↩" onPress={() => dispatch({ type: 'undo' })} />
      </View>
    </View>
  );
}

function RoundBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.roundBtn} onPress={onPress}>
      <Text style={styles.roundBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: C.textDim, fontSize: 15 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 62, paddingBottom: 8,
  },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, marginHorizontal: 18 },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  deckArea: { flex: 1, paddingHorizontal: 14, paddingBottom: 6 },
  liveBadge: {
    position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  placeText: { color: C.textDim, fontSize: 13 },
  feedbackRow: { minHeight: 34, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  toast: { backgroundColor: 'rgba(30,30,40,0.85)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  toastText: { color: '#fff', fontSize: 14 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 110, paddingTop: 10,
  },
  roundBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: C.capsule,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnText: { color: '#fff', fontSize: 22 },
  timeCapsule: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,40,0.75)',
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  timeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoGlyph: { color: C.textDim, fontSize: 16 },
  doneTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 28 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 26, paddingHorizontal: 40, paddingVertical: 15, marginBottom: 14 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: C.textDim, fontSize: 16 },
});
