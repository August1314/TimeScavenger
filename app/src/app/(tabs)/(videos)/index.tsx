import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Text, View, StyleSheet, TouchableOpacity, Share, Platform, FlatList,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { C } from '../../../theme/colors';
import { VideoCell, type VideoCellHandle } from '../../../components/VideoCell';
import { nextGroup, markSeen } from '../../../lib/session';
import { settlePage, dragPage, type SwipeRelease } from '../../../lib/videoFeed';
import { pendingQueue } from '../../../lib/deletion';
import { setFavoriteSafe, getAssetLocation } from '../../../lib/assets';
import { placeParts } from '../../../lib/place';
import { formatTime } from '../../../lib/time';
import { hapticWarn, hapticSuccess, hapticSelect } from '../../../lib/haptics';
import type { MediaRow } from '../../../db/repo';

export default function VideosHome() {
  // tab 屏切走不卸载（expo-router 保活）：失焦即全格 pause，杜绝"离开页面声音还在播"
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { width: vw, height: vh } = useWindowDimensions();
  // 画面不与底部悬浮 tab 胶囊重叠：feed 区 = 视口高 − 胶囊区（12+62+8 余量），抖音式收边
  const feedH = vh - 82;
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const [fast, setFast] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<MediaRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<MediaRow>>(null);
  const cellRefs = useRef<(VideoCellHandle | null)[]>([]);
  const loadingMoreRef = useRef(false);
  const rowsRef = useRef<MediaRow[]>([]);
  const currentRef = useRef(0);

  const showToast = (s: string) => {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // 初始拉一组（重进语义：每次挂载重新拉，current=0 不触发 markSeen）
  useEffect(() => {
    let alive = true;
    void nextGroup('video').then((g) => {
      if (!alive) return;
      rowsRef.current = g.items;
      setRows(g.items);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 当前行变化 → 刷新位置信息
  const cur = rows[current];
  useEffect(() => {
    setPlace(null);
    if (!cur) return;
    let alive = true;
    void (async () => {
      const loc = await getAssetLocation(cur.localIdentifier);
      if (loc && alive) {
        const p = await placeParts(loc.latitude, loc.longitude);
        if (alive) setPlace(p?.region ?? p?.street ?? null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cur?.localIdentifier]);

  const appendNextGroup = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const g = await nextGroup('video');
      // 小库时 nextGroup 可能返回已在列表中的行（尚未全部记已读），去重防重复 key
      const seenIds = new Set(rowsRef.current.map((r) => r.localIdentifier));
      const fresh = g.items.filter((r) => !seenIds.has(r.localIdentifier));
      if (fresh.length > 0) {
        rowsRef.current = [...rowsRef.current, ...fresh];
        setRows(rowsRef.current);
      }
    } finally {
      loadingMoreRef.current = false;
    }
  };

  // 提交定格下标：离开行记已读、推进 current、组尾续拉
  const commitIndex = (next: number) => {
    const prev = currentRef.current;
    if (next === prev) return;
    const leaving = rowsRef.current[prev];
    if (leaving) void markSeen(leaving); // 定格才对离开行记已读，一次
    currentRef.current = next;
    setCurrent(next);
    if (next >= rowsRef.current.length - 1) void appendNextGroup();
  };

  // 慢拖松手（无惯性）时 iOS pagingEnabled 不会吸附分页，会停在半格"卡住"——
  // 拖拽结束起定时器：若期间进入惯性滚动（onMomentumScrollBegin）则取消，交给
  // onMomentumScrollEnd 结算；否则按"速度或距离"决定翻页/回弹（抖音式手感，用户裁决）
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSettleTimer = () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };
  useEffect(() => cancelSettleTimer, []);

  // 松手速度检测：onScroll 采样 px/ms 轻度平滑；手指停稳 >90ms 视为 0（慢拖不算甩）
  const scrollSample = useRef({ t: 0, y: 0, v: 0 });
  // 松手信息必须一次性消费（用后置零）：补翻页的动画滚动会再次触发结算事件，
  // 若残留甩速信息将造成"滑一下无限连跳"级联（真机 bug，测试已钉死防回归）
  const releaseRef = useRef<SwipeRelease>({ v: 0, d: 0 });
  const consumeRelease = (): SwipeRelease => {
    const r = releaseRef.current;
    releaseRef.current = { v: 0, d: 0 };
    return r;
  };
  const onScrollSample = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const t = Date.now();
    const p = scrollSample.current;
    if (p.t > 0 && t > p.t) {
      const inst = (y - p.y) / (t - p.t);
      scrollSample.current = { t, y, v: p.v * 0.4 + inst * 0.6 };
    } else {
      scrollSample.current = { t, y, v: p.v };
    }
  };

  const onEndDrag = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const d = y - currentRef.current * feedH;
    const v = Date.now() - scrollSample.current.t < 90 ? scrollSample.current.v : 0;
    releaseRef.current = { v, d };
    cancelSettleTimer();
    if (Math.abs(d) <= 2) return; // 恰在边界：交给惯性/原生分页结算
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      const target = dragPage(currentRef.current, y, feedH, rowsRef.current.length, consumeRelease());
      // 偏离目标格 >2px 就动画滚过去（含回弹原页）；此前只在翻页时滚动，
      // 慢拖回弹会停在错位处
      if (Math.abs(y - target * feedH) > 2) {
        listRef.current?.scrollToOffset({ offset: target * feedH, animated: true });
      }
      commitIndex(target);
    }, 200);
  };

  const onSettled = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    cancelSettleTimer();
    const y = e.nativeEvent.contentOffset.y;
    const target = settlePage(currentRef.current, y, feedH, rowsRef.current.length, consumeRelease());
    // 一律动画滚动：此前同页回正用 animated:false 瞬时跳，而轻点/滑动的
    // momentumEnd 常带几 px 误差 → 正是真机"画面上下跳一下"的根源。
    // inset 错位已由 contentInsetAdjustmentBehavior=never 根治，瞬时回正不再需要。
    if (Math.abs(y - target * feedH) > 2) {
      listRef.current?.scrollToOffset({ offset: target * feedH, animated: true });
    }
    commitIndex(target);
  };

  const setFastRate = (v: boolean) => {
    setFast(v);
    cellRefs.current[currentRef.current]?.setRate(v ? 2 : 1);
  };

  // 长按 2x：maxDistance 12 让位列表滚动（手指一动即取消）
  const longPress2x = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(12)
    .onStart(() => {
      'worklet';
      runOnJS(setFastRate)(true);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(setFastRate)(false);
    });

  const toggleFav = async () => {
    if (!cur) return;
    const next = !cur.favorite;
    const res = await setFavoriteSafe(cur.localIdentifier, next);
    if (res.ok) {
      const patch = (rs: MediaRow[]) => rs.map((r, i) => (i === currentRef.current ? { ...r, favorite: next } : r));
      rowsRef.current = patch(rowsRef.current);
      setRows(rowsRef.current);
      next ? hapticSuccess() : hapticWarn();
      showToast(next ? '已收藏' : '已取消收藏');
    } else if (res.cancelled) {
      showToast('已取消收藏');
    }
  };

  const del = async () => {
    if (!cur) return;
    await pendingQueue.push(cur);
    await markSeen(cur);
    setLastDeleted(cur);
    hapticWarn();
    showToast('已加入待删除 · 回收站确认');
    // 列表不删行保持下标稳定；定格前进由用户滑动完成
  };

  const undo = async () => {
    if (!lastDeleted) return;
    await pendingQueue.remove(lastDeleted.localIdentifier);
    hapticSelect();
    showToast('已撤回删除');
    setLastDeleted(null);
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <Text style={styles.emptyText}>正在载入视频…</Text>
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.emptyText}>{'视频已全部回顾\n可在设置中重置再来一轮'}</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={longPress2x}>
      <View style={styles.root}>
        {/* 容器高度=单格高度 + contentInsetAdjustmentBehavior=never：iOS 默认 automatic 会按
            底部安全区给滚动视图加 contentInset，导致停靠 offset 与格子边界错位（下一条漏出
            且 current 已前进→"露出还自动播"）。关掉调整后 offset 严格等于格子边界，
            整屏分页用 pagingEnabled（此时与 snapToInterval 等价且更稳） */}
        <FlatList
          ref={listRef}
          testID="feed_scroll"
          style={{ height: feedH }}
          data={rows}
          keyExtractor={(r) => r.localIdentifier}
          renderItem={({ item, index }) => (
            <View style={{ width: vw, height: feedH }}>
              <VideoCell
                row={item}
                active={focused && index === current}
                near={Math.abs(index - current) <= 1}
                onError={(m) => showToast(`播放失败：${m}`)}
                ref={(h) => {
                  cellRefs.current[index] = h;
                }}
              />
            </View>
          )}
          contentInsetAdjustmentBehavior="never"
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          // FlatList 参数保持原状（实证改 initialNumToRender/windowSize 会触发
          // VirtualizedList 回弹 → 划不动）；Android 内存问题改由 VideoCell
          // 只给近机格（±1）建真实源解决
          windowSize={3}
          getItemLayout={(_, index) => ({ length: feedH, offset: feedH * index, index })}
          onScroll={onScrollSample}
          scrollEventThrottle={16}
          onScrollEndDrag={onEndDrag}
          onMomentumScrollBegin={cancelSettleTimer}
          onMomentumScrollEnd={onSettled}
        />

        {fast && (
          <View style={styles.fastBadge} pointerEvents="none">
            <Text style={styles.fastText}>2x 速率播放中</Text>
          </View>
        )}

        {/* 右侧竖排圆钮：♡ / ↑ / 🗑 /  */}
        <View style={styles.rightBar}>
          <RoundIcon testID="video_like" icon={cur?.favorite ? 'heart' : 'heart-outline'} onPress={() => void toggleFav()} />
          <RoundIcon
            icon="share-outline"
            onPress={() => {
              const uri = cur?.localIdentifier ?? '';
              if (uri && Platform.OS === 'ios') void Share.share({ url: uri }).catch(() => {});
              // Android localIdentifier 即 content:// URI，可直接分享
              else if (uri) void Share.share({ url: uri }).catch(() => void Share.share({ message: uri }));
            }}
          />
          <RoundIcon testID="video_delete" icon="trash-outline" onPress={() => void del()} />
          <RoundIcon testID="video_undo" icon="arrow-undo-outline" dim={!lastDeleted} onPress={() => void undo()} />
        </View>

        {/* 左下：时间 + 位置 / toast */}
        <View style={styles.bottomLeft}>
          {toast ? (
            <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
          ) : (
            cur && (
              <>
                <Text style={styles.timeText}>{formatTime(cur.creationDate, 'relative')}</Text>
                <Text style={styles.placeText} numberOfLines={1}>{place ?? ''}</Text>
              </>
            )
          )}
        </View>

      </View>
    </GestureDetector>
  );
}

function RoundIcon({ icon, dim, onPress, testID }: { icon: keyof typeof Ionicons.glyphMap; dim?: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} style={[styles.roundBtn, dim && styles.roundBtnDim]} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  emptyText: { color: C.textDim, fontSize: 16, textAlign: 'center', lineHeight: 26 },
  fastBadge: {
    position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  fastText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  rightBar: { position: 'absolute', right: 14, bottom: 210, gap: 16 },
  roundBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(25,25,30,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnDim: { opacity: 0.35 },

  bottomLeft: { position: 'absolute', left: 18, bottom: 138, maxWidth: '62%', gap: 3 },
  timeText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  placeText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  toast: { backgroundColor: 'rgba(30,30,40,0.85)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { color: '#fff', fontSize: 13 },
});
