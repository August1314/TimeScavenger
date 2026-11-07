import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Asset } from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../theme/colors';
import type { MediaRow } from '../db/repo';

export interface VideoCellHandle {
  setRate(n: number): void;
}

interface Props {
  row: MediaRow;
  active: boolean;
  onError: (msg: string) => void;
}

/**
 * 单格视频：独立播放器，播停完全由 active 驱动（不用 shouldPlay，避免列表回收误播）。
 * 构造空源，iCloud 守卫判定为本地后才 replaceAsync 装载 ph:// URI（云端视频不触发下载）。
 * 预加载语义（用户裁决）：挂载即 replaceAsync 装载，但 VideoView 与 play() 都只在
 * active=true（列表定格、拖动完成）时发生——同屏最多一个播放器层，杜绝叠画/提前播。
 */
export const VideoCell = forwardRef<VideoCellHandle, Props>(function VideoCell(
  { row, active, onError },
  ref,
) {
  const player = useVideoPlayer('', (p) => {
    p.loop = true;
  });
  const [cloud, setCloud] = useState<boolean | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    setCloud(null);
    (async () => {
      try {
        // 新 API Asset() 必须传带 ph:// 前缀的完整 id：原生构造是无条件 dropFirst(5)，
        // 传剥掉前缀的原始 id 会被砍头成错误 localIdentifier 导致查不到资产
        const isInCloud = await new Asset(row.localIdentifier).getIsInCloud();
        if (!alive) return;
        setCloud(isInCloud);
        if (!isInCloud) {
          loadedRef.current = true;
          await player.replaceAsync(row.localIdentifier);
        }
      } catch (e: any) {
        if (alive) onError(String(e?.message ?? e).slice(0, 60));
      }
    })();
    return () => {
      alive = false;
    };
  }, [row.localIdentifier, player]);

  useEffect(() => {
    if (cloud === false && active) void player.play();
    if (!active) {
      player.pause();
      player.playbackRate = 1;
    }
  }, [active, cloud, player]);

  // 空源 '' 在构造时即触发一次原生加载错误（file:/// Cannot Open，Metro 日志实证）——
  // 只有真正开始装载真实视频后的 error 才上报，避免每格挂载即弹"播放失败"
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && loadedRef.current) {
        onError(String(error?.message ?? '未知').slice(0, 60));
      }
    });
    return () => sub.remove();
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
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cloudText: { color: C.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
