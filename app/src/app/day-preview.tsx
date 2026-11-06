import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
      const uri = await new Asset(id ?? '').getUri();
      if (Platform.OS === 'ios' && uri) await Share.share({ url: uri });
      else await Share.share({ message: uri ?? '' });
    } catch {
      // 用户取消
    }
  };

  const isPortrait = (row?.height ?? 1) >= (row?.width ?? 1);

  return (
    <View style={styles.root}>
      {/* 左上：省市区 + 日期大字（原版 IMG_1517） */}
      <View style={styles.header}>
        <Text style={styles.region}>{region ?? ''}</Text>
        <Text style={styles.date}>{row ? dayTitle(row.creationDate) : ''}</Text>
      </View>

      {/* 照片：保留宽高比居中 */}
      <View style={styles.photoWrap}>
        {row && (
          <>
            {playing && liveSrc ? (
              <LivePhotoView
                ref={liveRef}
                source={liveSrc}
                style={isPortrait ? styles.photoPortrait : styles.photoLandscape}
                contentFit="cover"
                useDefaultGestureRecognizer={false}
                onLoadComplete={() => liveRef.current?.startPlayback('full')}
                onPlaybackStop={() => setPlaying(false)}
                onLoadError={() => setPlaying(false)}
              />
            ) : (
              <Image
                source={{ uri: row.localIdentifier }}
                style={isPortrait ? styles.photoPortrait : styles.photoLandscape}
                contentFit="cover"
                recyclingKey={row.localIdentifier}
              />
            )}
            {row.mediaType === 'live' && (
              <TouchableOpacity
                style={[styles.liveBadge, isPortrait ? styles.liveBadgePortrait : styles.liveBadgeLandscape]}
                onPress={() => liveSrc && setPlaying(true)}
              >
                <Text style={styles.liveBadgeText}>◉ 实况</Text>
              </TouchableOpacity>
            )}
          </>
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 66, paddingHorizontal: 20 },
  region: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  date: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },

  photoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoPortrait: { width: '86%', height: '72%', borderRadius: 14, overflow: 'hidden' },
  photoLandscape: { width: '92%', height: '52%', borderRadius: 14, overflow: 'hidden' },
  liveBadge: {
    position: 'absolute', backgroundColor: 'rgba(20,20,28,0.6)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  liveBadgePortrait: { top: '14%', left: '8%' },
  liveBadgeLandscape: { top: '24%', left: '5%' },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  bottomBar: { flexDirection: 'row', justifyContent: 'center', gap: 22, paddingBottom: 16 },
  roundBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1c1c22',
    alignItems: 'center', justifyContent: 'center',
  },
  dismissHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', paddingBottom: 18 },
});
