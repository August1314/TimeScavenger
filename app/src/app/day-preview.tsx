import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Share, Platform, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Asset } from 'expo-media-library';
import { LivePhotoView, type LivePhotoViewType } from 'expo-live-photo';
import { C } from '../theme/colors';
import { dayTitle } from '../lib/sameDay';
import { getMediaById } from '../db/repo';
import { setFavoriteSafe } from '../lib/assets';
import { getLiveSource, type LiveSource } from '../lib/live';
import { getAssetLocation } from '../lib/assets';
import { placeParts } from '../lib/place';
import { hapticSelect, hapticSuccess, hapticWarn } from '../lib/haptics';
import { shareAssetAndroid } from '../lib/share';
import type { MediaRow } from '../db/repo';

export default function DayPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<MediaRow | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [liveSrc, setLiveSrc] = useState<LiveSource | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fav, setFav] = useState(false);
  const liveRef = useRef<LivePhotoViewType>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const r = await getMediaById(id);
      if (!alive || !r) return;
      setRow(r);
      setFav(r.favorite);
      const loc = await getAssetLocation(id);
      if (loc && alive) {
        const p = await placeParts(loc.latitude, loc.longitude);
        if (alive) setRegion(p?.region ?? p?.street ?? null);
      }
      if (r.mediaType === 'live') {
        const src = await getLiveSource(id);
        if (alive) setLiveSrc(src);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const toggleFav = async () => {
    if (!id || !row) return;
    const next = !fav;
    const res = await setFavoriteSafe(id, next);
    if (res.ok) {
      setFav(next);
      next ? hapticSuccess() : hapticWarn();
    } else {
      hapticSelect();
    }
  };

  const doShare = async () => {
    try {
      if (Platform.OS === 'ios') {
        const uri = await new Asset(id ?? '').getUri();
        if (uri) await Share.share({ url: uri });
      } else if (id && row) {
        await shareAssetAndroid(id, row.mediaType === 'video' ? 'video' : 'image');
      }
    } catch {
      // 用户取消
    }
  };

  // 照片盒按实际宽高比计算（RN0.88 禁模块顶层 Dimensions.get → useWindowDimensions）：
  // 横版图完整显示不裁两侧，竖版图不超过可用高度
  const { width: W, height: H } = useWindowDimensions();
  const aspect = row && row.width > 0 && row.height > 0 ? row.width / row.height : 0.75;
  const photoW = Math.min(W * 0.92, H * 0.58 * aspect);
  const photoH = photoW / aspect;

  // "下滑返回"手势（提示文案承诺过但从未实现；Android 无 iOS 式侧滑返回，必须补上）：
  // 纵向下滑 >80px 或甩速 >500px/s 即 router.back；横向意图不拦截（activeOffsetY 门槛）
  const goBack = useCallback(() => router.back(), []);
  const dismissPan = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 500) runOnJS(goBack)();
    });

  return (
    <GestureDetector gesture={dismissPan}>
    <View style={styles.root}>
      {/* 左上：省市区 + 日期大字 */}
      <View style={styles.header}>
        <Text style={styles.region}>{region ?? ''}</Text>
        <Text style={styles.date}>{row ? dayTitle(row.creationDate) : ''}</Text>
      </View>

      {/* 照片：按实际比例完整显示（不裁切） */}
      <View style={styles.photoWrap}>
        {row && (
          <View style={{ width: photoW, height: photoH, borderRadius: 14, overflow: 'hidden', backgroundColor: '#0a0a0f' }}>
            {playing && liveSrc ? (
              <LivePhotoView
                ref={liveRef}
                source={liveSrc}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                useDefaultGestureRecognizer={false}
                onLoadComplete={() => liveRef.current?.startPlayback('full')}
                onPlaybackStop={() => setPlaying(false)}
                onLoadError={() => setPlaying(false)}
              />
            ) : (
              <Image
                source={{ uri: row.localIdentifier }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                recyclingKey={row.localIdentifier}
              />
            )}
            {row.mediaType === 'live' && (
              <TouchableOpacity style={styles.liveBadge} onPress={() => liveSrc && setPlaying(true)}>
                <Text style={styles.liveBadgeText}>◉ 实况</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* 底部三圆钮：♡ 收藏 / ⓘ 信息 / ↑ 分享 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.roundBtn} onPress={() => void toggleFav()}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={() => id && router.push({ pathname: '/photo-info', params: { id } })}
        >
          <Ionicons name="information-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundBtn} onPress={() => void doShare()}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.dismissHint}>下滑返回</Text>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 66, paddingHorizontal: 20 },
  region: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  date: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },

  photoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  liveBadge: {
    position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  bottomBar: { flexDirection: 'row', justifyContent: 'center', gap: 22, paddingBottom: 16 },
  roundBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1c1c22',
    alignItems: 'center', justifyContent: 'center',
  },
  dismissHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', paddingBottom: 18 },
});
