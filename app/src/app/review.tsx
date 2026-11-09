import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Platform, Text, View, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../theme/GradientBackground';
import { C } from '../theme/colors';
import { CardStack } from '../components/CardStack';
import { Confetti } from '../components/Confetti';
import { createDeck, deckReducer, type DeckAction, type DeckState } from '../lib/deckMachine';
import { nextGroup, markSeen } from '../lib/session';
import { pendingQueue } from '../lib/deletion';
import { setFavoriteSafe, getAssetLocation } from '../lib/assets';
import { getLiveSource, type LiveSource } from '../lib/live';
import { placeName } from '../lib/place';
import { formatTime } from '../lib/time';
import { ALL_BUCKET, getSetting, type Category, type MediaRow } from '../db/repo';
import { setHapticsEnabled, hapticWarn, hapticSuccess, hapticMedium, hapticLight, hapticSelect } from '../lib/haptics';

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ category?: string; bucket?: string }>();
  const category = (params.category ?? 'photo') as Category;
  const bucket = params.bucket ?? ALL_BUCKET;
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [timeFormat, setTimeFormat] = useState<'relative' | 'date'>('relative');
  const [place, setPlace] = useState<string | null>(null);
  const [, force] = useState(0);

  const currentId = deck?.items[deck.index]?.id;
  const [toast, setToast] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [liveSrc, setLiveSrc] = useState<{ id: string; src: LiveSource } | null>(null); // 实况卡内播放源（按卡 id 键控）
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
      const g = await nextGroup(category, bucket);
      setRows(g.items);
      const dta = (await getSetting('doubleTapAction')) === 'zoom' ? 'zoom' : 'favorite';
      setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier })), dta));
    })();
  }, [category]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.localIdentifier, r])), [rows]);

  // 同步镜像：连续手势在两次渲染之间也能正确消费（Review Focus #4）
  const deckRef = useRef<DeckState | null>(null);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  const dispatch = (e: Parameters<typeof deckReducer>[1]) => {
    const prev = deckRef.current;
    if (!prev) return;
    const { state, action } = deckReducer(prev, e);
    deckRef.current = state;
    setDeck(state);
    if (action) void run(action);
  };

  // 一组刷完 → 有待删除项则自动进入确认页（原 app 闭环）
  const doneRef = useRef(false);
  useEffect(() => {
    if (deck?.done && !doneRef.current) {
      doneRef.current = true;
      void pendingQueue.count().then((c) => {
        if (c > 0) router.push({ pathname: '/pending', params: { from: 'done' } });
      });
    }
    if (deck && !deck.done) doneRef.current = false;
  }, [deck]);

  const run = async (a: DeckAction) => {
    const row = rowById.get(a.id);
    switch (a.kind) {
      case 'delete':
        if (row) {
          await pendingQueue.push(row);
          await markSeen(row);
        }
        // 用户裁决：iOS 保持 warning 原触感不变；Android warning 过重，改 Medium
        Platform.OS === 'ios' ? hapticWarn() : hapticMedium();
        setHintVisible(false);
        showToast('已加入待删除 · 点 ↩ 撤回');
        break;
      case 'favorite': {
        if (row) await markSeen(row);
        const next = !row?.favorite;
        const res = await setFavoriteSafe(a.id, next);
        if (res.ok) {
          setRows((rs) => rs.map((x) => (x.localIdentifier === a.id ? { ...x, favorite: next } : x)));
          hapticSuccess();
          setHintVisible(false);
          showToast(next ? '已收藏 · 可在系统相册"个人收藏"查看' : '已取消收藏');
        } else if (res.cancelled) {
          showToast('已取消收藏');
        } else {
          showToast(res.limited ? '相册为受限访问，无法修改收藏，请到系统设置开启完全访问' : '收藏失败，请重试');
        }
        break;
      }
      case 'seen':
        if (row) await markSeen(row);
        hapticLight();
        break;
      case 'undoDelete':
        await pendingQueue.remove(a.id);
        hapticSelect();
        showToast('已撤回删除');
        break;
      case 'backToDay':
        router.push({ pathname: '/back-to-day', params: { id: a.id } });
        break;
      case 'zoom':
        // 双击放大 = 打开完整不裁切预览（day-preview 已按实际宽高比 contain 显示）
        router.push({ pathname: '/day-preview', params: { id: a.id } });
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
    const g = await nextGroup(category, bucket);
    setRows(g.items);
    setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier }))));
    setHintVisible(true);
  };

  const goHome = () => {
    // R2 由首页焦点逻辑统一处理（队列>抑制水位则自动弹确认页）
    router.back();
  };

  // 实况长按：在当前卡内播放一次
  const playLive = async () => {
    const id = deckRef.current?.items[deckRef.current.index]?.id;
    if (!id) return;
    const src = await getLiveSource(id);
    if (src) {
      hapticLight();
      setLiveSrc({ id, src });
    } else {
      showToast('未找到该实况的配对视频（可能存在 iCloud 云端）');
    }
  };

  return (
    <View style={styles.root}>
      <GradientBackground seed={deck.items[deck.index]?.id} />

      {/* 顶栏：左右圆钮 + 中央短横线进度条 */}
      <View style={styles.topBar}>
        <RoundBtn light icon="chevron-back" onPress={goHome} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <RoundBtn
          light
          icon="share-outline"
          onPress={() =>
            Share.share({ message: '像刷短视频一样刷自己的照片 —— 拾光' }).catch(() => {})
          }
        />
      </View>

      {/* 卡组 */}
      <View style={styles.deckArea}>
        {deck.done && rows.length === 0 ? (
          <View style={styles.center}>
            <Confetti />
            <Text style={styles.doneTitle}>你已经回顾完所有照片了！</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/settings')}>
              <Text style={styles.primaryBtnText}>重置浏览记录，再来一轮</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={goHome}>
              <Text style={styles.ghostBtnText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        ) : deck.done ? (
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
            testID="review_card"
            cards={deck.items}
            index={deck.index}
            live={currentRow?.mediaType === 'live'}
            liveSource={liveSrc && currentId && liveSrc.id === currentId ? liveSrc.src : null}
            badge={
              currentRow?.mediaType === 'live' ? (
                <View style={styles.liveBadge} pointerEvents="none">
                  <Text style={styles.liveBadgeText}>◉ 实况</Text>
                </View>
              ) : undefined
            }
            onSwipe={(dir) => dispatch({ type: 'swipe', dir })}
            onDoubleTap={() => dispatch({ type: 'doubleTap' })}
            onPinchOut={() => dispatch({ type: 'pinch' })}
            onLongPress={() => void playLive()}
            onLiveEnd={(reason) => {
              setLiveSrc(null);
              if (reason) showToast('实况播放失败，已回到静态照片');
            }}
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
          <Text style={styles.hint}>上滑待删除 · 下滑收藏 · 左右切换 · 捏合回到那天 · 实况长按播放</Text>
        ) : null}
      </View>

      {/* 底栏：深色圆钮 + 时间胶囊 */}
      <View style={styles.bottomBar}>
        <RoundBtn
          testID="review_like"
          icon={currentRow?.favorite ? 'heart' : 'heart-outline'}
          onPress={() => {
            const id = deck.items[deck.index]?.id;
            const r = rowById.get(id ?? '');
            if (!id || !r) return;
            void (async () => {
              const next = !r.favorite;
              const res = await setFavoriteSafe(id, next);
              if (res.ok) {
                setRows((rs) => rs.map((x) => (x.localIdentifier === id ? { ...x, favorite: next } : x)));
                hapticSelect();
                showToast(next ? '已收藏 · 可在系统相册"个人收藏"查看' : '已取消收藏');
              } else if (res.cancelled) {
                showToast('已取消收藏');
              } else {
                showToast(res.limited ? '相册为受限访问，无法修改收藏，请到系统设置开启完全访问' : '收藏失败，请重试');
              }
            })();
          }}
        />
        <View style={styles.timeCapsule}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={styles.timeText} numberOfLines={1}>
              {currentRow ? formatTime(currentRow.creationDate, timeFormat) : '未知时间'}
            </Text>
            {place ? <Text style={styles.placeText} numberOfLines={1} ellipsizeMode="tail">{place}</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => {
              const id = deck.items[deck.index]?.id;
              if (id) router.push({ pathname: '/photo-info', params: { id } });
            }}
          >
            <Text style={styles.infoGlyph}>i</Text>
          </TouchableOpacity>
        </View>
        <RoundBtn icon="arrow-undo-outline" onPress={() => dispatch({ type: 'undo' })} />
      </View>
    </View>
  );
}

function RoundBtn({ icon, light, onPress, testID }: { icon: keyof typeof Ionicons.glyphMap; light?: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} style={[styles.roundBtn, light && styles.roundBtnLight]} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: C.textDim, fontSize: 15 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10,
  },
  progressTrack: { width: 110, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  deckArea: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
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
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 8,
  },
  roundBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.capsuleDark,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnLight: { backgroundColor: C.capsuleLight },
  timeCapsule: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.capsuleDark,
    borderRadius: 26, paddingHorizontal: 20, paddingVertical: 10, gap: 12,
  },
  timeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoGlyph: { color: C.textDim, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
  doneTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 28 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 26, paddingHorizontal: 40, paddingVertical: 15, marginBottom: 14 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: C.textDim, fontSize: 16 },
});
