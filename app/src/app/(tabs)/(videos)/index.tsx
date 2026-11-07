import { useEffect, useRef, useState } from 'react';
import {
  Text, View, StyleSheet, TouchableOpacity, Share, Platform, FlatList, PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { C } from '../../../theme/colors';
import { VideoCell, type VideoCellHandle } from '../../../components/VideoCell';
import { nextGroup, markSeen } from '../../../lib/session';
import { snapIndex, seekRatio } from '../../../lib/videoFeed';
import { pendingQueue } from '../../../lib/deletion';
import { setFavoriteSafe, getAssetLocation } from '../../../lib/assets';
import { placeParts } from '../../../lib/place';
import { formatTime } from '../../../lib/time';
import { hapticWarn, hapticSuccess, hapticSelect } from '../../../lib/haptics';
import type { MediaRow } from '../../../db/repo';

export default function VideosHome() {
  const { width: vw, height: vh } = useWindowDimensions();
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const [tick, setTick] = useState({ t: 0, d: 0 });
  const [drag, setDrag] = useState<number | null>(null); // 拖动中的 seek 预览比例
  const [fast, setFast] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<MediaRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellRefs = useRef<(VideoCellHandle | null)[]>([]);
  const loadingMoreRef = useRef(false);
  const rowsRef = useRef<MediaRow[]>([]);
  const currentRef = useRef(0);
  const trackWRef = useRef(vw - 36);

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

  // 当前行变化 → 刷新位置信息 + 归零进度预览
  const cur = rows[current];
  useEffect(() => {
    setTick({ t: 0, d: 0 });
    setDrag(null);
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
      if (g.items.length > 0) {
        rowsRef.current = [...rowsRef.current, ...g.items];
        setRows(rowsRef.current);
      }
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const onSettled = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const next = snapIndex(e.nativeEvent.contentOffset.y, vh);
    const prev = currentRef.current;
    if (next === prev) return;
    const leaving = rowsRef.current[prev];
    if (leaving) void markSeen(leaving); // 定格才对离开行记已读，一次
    currentRef.current = next;
    setCurrent(next);
    if (next >= rowsRef.current.length - 1) void appendNextGroup();
  };

  // 进度条轨道：点按+拖动 seek（3pt 线外套 24pt 高命中区）
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setDrag(seekRatio(e.nativeEvent.locationX, 0, trackWRef.current)),
      onPanResponderMove: (e) => setDrag(seekRatio(e.nativeEvent.locationX, 0, trackWRef.current)),
      onPanResponderRelease: (e) => {
        const r = seekRatio(e.nativeEvent.locationX, 0, trackWRef.current);
        cellRefs.current[currentRef.current]?.seekTo(r);
        setDrag(null);
      },
    }),
  ).current;

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

  const progress = drag ?? (tick.d > 0 ? tick.t / tick.d : 0);

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
        <FlatList
          data={rows}
          keyExtractor={(r) => r.localIdentifier}
          renderItem={({ item, index }) => (
            <View style={{ width: vw, height: vh }}>
              <VideoCell
                row={item}
                active={index === current}
                onError={(m) => showToast(`播放失败：${m}`)}
                onTick={(t, d) => index === currentRef.current && setTick({ t, d })}
                ref={(h) => {
                  cellRefs.current[index] = h;
                }}
              />
            </View>
          )}
          pagingEnabled
          snapToInterval={vh}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          windowSize={3}
          getItemLayout={(_, index) => ({ length: vh, offset: vh * index, index })}
          onMomentumScrollEnd={onSettled}
        />

        {fast && (
          <View style={styles.fastBadge} pointerEvents="none">
            <Text style={styles.fastText}>2x 速率播放中</Text>
          </View>
        )}

        {/* 右侧竖排圆钮：♡ / ↑ / 🗑 /  */}
        <View style={styles.rightBar}>
          <RoundIcon icon={cur?.favorite ? 'heart' : 'heart-outline'} onPress={() => void toggleFav()} />
          <RoundIcon
            icon="share-outline"
            onPress={() => {
              const uri = cur?.localIdentifier ?? '';
              if (uri && Platform.OS === 'ios') void Share.share({ url: uri }).catch(() => {});
              else void Share.share({ message: uri }).catch(() => {});
            }}
          />
          <RoundIcon icon="trash-outline" onPress={() => void del()} />
          <RoundIcon icon="arrow-undo-outline" dim={!lastDeleted} onPress={() => void undo()} />
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

        {/* 进度条：tab 胶囊上方，可点按/拖动 seek */}
        <View
          style={styles.trackHit}
          onLayout={(e) => {
            trackWRef.current = e.nativeEvent.layout.width;
          }}
          {...scrub.panHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

function RoundIcon({ icon, dim, onPress }: { icon: keyof typeof Ionicons.glyphMap; dim?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.roundBtn, dim && styles.roundBtnDim]} onPress={onPress}>
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

  // tab 胶囊占底部 12+62=74，轨道命中区底边 78、高 24（3pt 线居中）
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

  trackHit: { position: 'absolute', left: 18, right: 18, bottom: 78, height: 24, justifyContent: 'center' },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2 },
  fill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
});
