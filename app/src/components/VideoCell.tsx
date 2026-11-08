import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { Asset } from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../theme/colors';
import { playbackAction, loadedAction } from '../lib/videoFeed';
import type { MediaRow } from '../db/repo';

export interface VideoCellHandle {
  setRate(n: number): void;
}

interface Props {
  row: MediaRow;
  active: boolean;
  /** Android 内存闸门：仅近机格（当前±1）建真实源播放器，远格空源不占解码器。
   * 真机实证：大列表一次挂 10 个已装载 ExoPlayer 会爆 512MB 堆（OOM + MediaCodec SIGABRT） */
  near: boolean;
  onError: (msg: string) => void;
}

/**
 * 单格视频：独立播放器，播停完全由 active 驱动（不用 shouldPlay，避免列表回收误播）。
 * iOS：构造空源，iCloud 守卫判定为本地后才 replaceAsync 装载 ph:// URI（云端视频不触发下载）。
 * Android：near=true 时构造即真实 content:// 源（replaceAsync 在 Android 会把 URI 变空，
 * 实证不可用）；near 翻转经 key 重建播放器，远格释放解码器内存。
 * 预加载语义（用户裁决）：装载即首帧，但 VideoView 与 play() 都只在
 * active=true（列表定格、拖动完成）时发生——同屏最多一个播放器层，杜绝叠画/提前播。
 * play() 还要求 loaded（源装载完成）：装载前 play 的原生意图在划走时 pause 可能清不掉，
 * 会造成非当前格隐形出声（声音重叠/音画不同步，真机 bug，判定见 videoFeed.playbackAction）。
 */
export const VideoCell = forwardRef<VideoCellHandle, Props>(function VideoCell(
  { row, active, near, onError },
  ref,
) {
  // iOS 播放器生命周期与 near 无关，不随其重建
  const key = Platform.OS === 'android' ? (near ? 'near' : 'far') : 'fixed';
  return <CellPlayer key={key} row={row} active={active} near={near} onError={onError} ref={ref} />;
});

const CellPlayer = forwardRef<VideoCellHandle, Props>(function CellPlayer(
  { row, active, near, onError },
  ref,
) {
  const player = useVideoPlayer(
    Platform.OS === 'ios' ? '' : near ? row.localIdentifier : '',
    (p) => {
      p.loop = true;
    },
  );
  const [cloud, setCloud] = useState<boolean | null>(null);
  // loaded=源真正装载完成（replaceAsync resolve）。play() 必须等它，否则 iOS 上
  // 装载前 play 形成"就绪即播"意图、装载中 pause 又可能不生效 → 划走后隐形播放器出声
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    setLoaded(false);
    setCloud(null);
    (async () => {
      try {
        if (Platform.OS === 'android') {
          // 远格空源：不装载、不上报 '' 构造期原生错误
          if (!near) {
            setCloud(false);
            return;
          }
          loadedRef.current = true;
          setCloud(false);
          setLoaded(true);
          return;
        }
        // 新 API Asset() 必须传带 ph:// 前缀的完整 id：原生构造是无条件 dropFirst(5)，
        // 传剥掉前缀的原始 id 会被砍头成错误 localIdentifier 导致查不到资产
        const isInCloud = await new Asset(row.localIdentifier).getIsInCloud();
        if (!alive) return;
        setCloud(isInCloud);
        if (!isInCloud) {
          loadedRef.current = true;
          await player.replaceAsync(row.localIdentifier);
          if (!alive) return;
          setLoaded(true);
          // 装载完成瞬间补偿：若期间已划走，补一次 pause 清掉残留的原生播放意图
          if (loadedAction(activeRef.current) === 'pause') player.pause();
        }
      } catch (e: any) {
        if (alive) onError(String(e?.message ?? e).slice(0, 60));
      }
    })();
    return () => {
      alive = false;
    };
  }, [row.localIdentifier, player, near]);

  useEffect(() => {
    const action = playbackAction({ active, cloud, loaded });
    if (action === 'play') void player.play();
    if (action === 'pause') {
      player.pause();
      player.playbackRate = 1;
    }
  }, [active, cloud, loaded, player]);

  useEffect(() => {
    // 兜底：非当前格一旦真正进入播放态（任何残留原生意图），立即静音
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying && !activeRef.current) player.pause();
    });
    // 空源 '' 在构造时即触发一次原生加载错误——装载真实视频后的 error 才上报
    const statusSub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && loadedRef.current) {
        onError(String(error?.message ?? '未知').slice(0, 60));
      }
    });
    return () => {
      playingSub.remove();
      statusSub.remove();
    };
  }, [player]);

  useImperativeHandle(ref, () => ({
    setRate: (n: number) => {
      player.playbackRate = n;
    },
  }));

  if (cloud === null) return <View style={styles.root} />;
  if (cloud) {
    return (
      <View style={styles.root}>
        <Text style={styles.cloudText}>该视频存储在 iCloud 云端，无法本地播放</Text>
      </View>
    );
  }
  // 同屏最多一个播放器层（用户裁决：消除"两个视频同屏+下一条提前播"）：
  // 非当前格不挂 VideoView，只留黑底占位；播放器仍已装载，定格即 active 秒起播。
  // contain：保持视频原始比例（用户裁决：不做全出血裁切），竖屏视频上下留黑边
  if (!active) return <View style={styles.root} />;
  // 用户最终裁决：播放控制直接用系统原生控件（轻点弹出进度条/暂停/±15s 快进快退），
  // 不来自绘控制层
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
    />
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cloudText: { color: C.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
