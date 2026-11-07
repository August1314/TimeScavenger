import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Asset } from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import { rawId } from '../lib/videoFeed';
import { C } from '../theme/colors';
import type { MediaRow } from '../db/repo';

export interface VideoCellHandle {
  seekTo(ratio: number): void;
  setRate(n: number): void;
}

interface Props {
  row: MediaRow;
  active: boolean;
  onError: (msg: string) => void;
  onTick: (t: number, d: number) => void;
}

/**
 * 单格视频：独立播放器，播停完全由 active 驱动（不用 shouldPlay，避免列表回收误播）。
 * 构造空源，iCloud 守卫判定为本地后才 replaceAsync 装载 ph:// URI（云端视频不触发下载）。
 */
export const VideoCell = forwardRef<VideoCellHandle, Props>(function VideoCell(
  { row, active, onError, onTick },
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
        const isInCloud = await new Asset(rawId(row.localIdentifier)).getIsInCloud();
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

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') onError(String(error?.message ?? '未知').slice(0, 60));
    });
    return () => sub.remove();
  }, [player]);

  // 仅当前格上报进度，省掉离屏轮询
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const d = player.duration;
      if (d > 0) onTick(player.currentTime, d);
    }, 400);
    return () => clearInterval(t);
  }, [active, player]);

  useImperativeHandle(ref, () => ({
    seekTo: (ratio: number) => {
      const d = player.duration;
      if (d > 0) player.currentTime = ratio * d;
    },
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
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" />;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  cloudText: { color: C.textDim, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
