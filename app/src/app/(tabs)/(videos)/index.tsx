import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Asset } from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../../../theme/colors';
import { nextGroup, markSeen } from '../../../lib/session';
import { pendingQueue } from '../../../lib/deletion';
import { setFavoriteSafe } from '../../../lib/assets';
import { placeParts } from '../../../lib/place';
import { getAssetLocation } from '../../../lib/assets';
import { formatTime } from '../../../lib/time';
import { hapticWarn, hapticSuccess, hapticSelect } from '../../../lib/haptics';
import type { MediaRow } from '../../../db/repo';

export default function VideosHome() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fast, setFast] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<MediaRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = rows[idx];
  const player = useVideoPlayer(uri ?? '', (p) => {
    p.loop = true;
  });

  const showToast = (s: string) => {
    setToast(s);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    let alive = true;
    void nextGroup('video').then((g) => {
      if (!alive) return;
      setRows(g.items);
      setIdx(0);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 当前视频：解析 uri、播放、位置
  useEffect(() => {
    if (!current) {
      setUri(null);
      return;
    }
    let alive = true;
    setPlace(null);
    setProgress(0);
    (async () => {
      try {
        const asset = new Asset(current.localIdentifier);
        if (await asset.getIsInCloud()) {
          if (alive) showToast('该视频存储在 iCloud 云端，无法本地播放');
          setUri(null);
          return;
        }
        // expo-video 官方文档：相册视频要用 legacy getAssetInfoAsync 的 uri（带 PHAsset 权限上下文），
        // 新 API getUri() 的导出路径 AVPlayer 打不开（实机 "The file couldn't be opened"）
        const { getAssetInfoAsync } = require('expo-media-library/legacy');
        const info = await getAssetInfoAsync(current.localIdentifier);
        const u: string | null = info?.uri ?? null;
        if (!alive) return;
        if (!u) {
          showToast('无法获取视频文件地址');
          return;
        }
        setUri(u);
        const loc = await getAssetLocation(current.localIdentifier);
        if (loc && alive) {
          const p = await placeParts(loc.latitude, loc.longitude);
          if (alive) setPlace(p?.region ?? p?.street ?? null);
        }
      } catch (e: any) {
        if (alive) showToast(`视频加载失败：${String(e?.message ?? e).slice(0, 60)}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [current?.localIdentifier]);

  // 播放器状态错误上报
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') showToast(`播放失败：${String(error?.message ?? '未知').slice(0, 60)}`);
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (uri) {
      player.replace(uri);
      player.play();
    }
  }, [uri, player]);

  // 进度轮询
  useEffect(() => {
    const t = setInterval(() => {
      const d = player.duration;
      if (d > 0) setProgress(player.currentTime / d);
    }, 400);
    return () => clearInterval(t);
  }, [player]);

  const go = (next: number) => {
    if (!current) return;
    void markSeen(current);
    setIdx(Math.max(0, Math.min(rows.length - 1, next)));
  };

  const doStep = (d: number) => go(idx + d);
  const doFast = (v: boolean) => {
    setFast(v);
    player.playbackRate = v ? 2 : 1;
  };

  // 上下滑切换 + 长按 2x（原版 IMG_1494 / 文案"2x 速率播放中"）；手势随渲染重建，闭包始终最新
  const composed = Gesture.Race(
    Gesture.Pan().onEnd((e) => {
      'worklet';
      if (Math.abs(e.translationY) > Math.abs(e.translationX)) {
        if (e.translationY < -80) runOnJS(doStep)(1);
        else if (e.translationY > 80) runOnJS(doStep)(-1);
      }
    }),
    Gesture.LongPress()
      .minDuration(350)
      .onStart(() => {
        'worklet';
        runOnJS(doFast)(true);
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(doFast)(false);
      }),
  );

  const toggleFav = async () => {
    if (!current) return;
    const next = !current.favorite;
    const res = await setFavoriteSafe(current.localIdentifier, next);
    if (res.ok) {
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, favorite: next } : r)));
      next ? hapticSuccess() : hapticWarn();
      showToast(next ? '已收藏' : '已取消收藏');
    }
  };

  const del = async () => {
    if (!current) return;
    await pendingQueue.push(current);
    await markSeen(current);
    setLastDeleted(current);
    hapticWarn();
    showToast('已加入待删除 · 回收站确认');
    if (idx < rows.length - 1) setIdx(idx + 1);
  };

  const undo = async () => {
    if (!lastDeleted) return;
    await pendingQueue.remove(lastDeleted.localIdentifier);
    hapticSelect();
    showToast('已撤回删除');
    setLastDeleted(null);
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={composed}>
        <View style={styles.videoArea}>
          {uri ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{rows.length === 0 ? '视频已全部回顾\n可在设置中重置再来一轮' : '正在载入视频…'}</Text>
            </View>
          )}
          {fast && (
            <View style={styles.fastBadge} pointerEvents="none">
              <Text style={styles.fastText}>2x 速率播放中</Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* 右侧竖排圆钮：♡ / ↑ / 🗑 / （原版 IMG_1494） */}
      <View style={styles.rightBar}>
        <RoundIcon icon={current?.favorite ? 'heart' : 'heart-outline'} onPress={() => void toggleFav()} />
        <RoundIcon
          icon="share-outline"
          onPress={() => {
            if (uri && Platform.OS === 'ios') void Share.share({ url: uri }).catch(() => {});
            else void Share.share({ message: uri ?? '' }).catch(() => {});
          }}
        />
        <RoundIcon icon="trash-outline" onPress={() => void del()} />
        <RoundIcon icon="arrow-undo-outline" dim={!lastDeleted} onPress={() => void undo()} />
      </View>

      {/* 左下：时间 + 位置；底部进度条 */}
      <View style={styles.bottomLeft}>
        {toast ? (
          <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
        ) : (
          current && (
            <>
              <Text style={styles.timeText}>{formatTime(current.creationDate, 'relative')}</Text>
              <Text style={styles.placeText} numberOfLines={1}>{place ?? ''}</Text>
            </>
          )
        )}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
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
  videoArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textDim, fontSize: 16, textAlign: 'center', lineHeight: 26 },
  fastBadge: {
    position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  fastText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  rightBar: { position: 'absolute', right: 14, bottom: 190, gap: 16 },
  roundBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(25,25,30,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnDim: { opacity: 0.35 },

  bottomLeft: { position: 'absolute', left: 18, bottom: 118, maxWidth: '62%', gap: 3 },
  timeText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  placeText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  toast: { backgroundColor: 'rgba(30,30,40,0.85)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { color: '#fff', fontSize: 13 },

  progressTrack: {
    position: 'absolute', left: 0, right: 0, bottom: 84, height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: { height: 3, backgroundColor: '#fff' },
});
