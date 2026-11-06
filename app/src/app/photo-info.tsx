import { useEffect, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme/colors';
import { formatTime } from '../lib/time';
import { readExif, type ExifInfo } from '../lib/exif';
import { getAssetLocation, type AssetLocation } from '../lib/assets';
import { placeParts, type PlaceParts } from '../lib/place';
import { getMediaById, type MediaRow } from '../db/repo';
import { nativeDeps } from '../lib/deletion';
import { formatBytes } from '../lib/statsModel';

function fullDate(ms: number): string {
  const d = new Date(ms);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${week} ${hh}:${mm}`;
}

export default function PhotoInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<MediaRow | null>(null);
  const [exif, setExif] = useState<ExifInfo | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [loc, setLoc] = useState<AssetLocation | null>(null);
  const [parts, setParts] = useState<PlaceParts | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const r = await getMediaById(id);
      const [e, s, l] = await Promise.all([readExif(id), nativeDeps().measureSize(id), getAssetLocation(id)]);
      if (!alive) return;
      setRow(r);
      setExif(e);
      setSize(s);
      setLoc(l);
      if (l) {
        const p = await placeParts(l.latitude, l.longitude);
        if (alive) setParts(p);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const params = exif
    ? [
        exif.aperture && { v: exif.aperture, k: '光圈' },
        exif.shutter && { v: exif.shutter, k: '快门' },
        exif.iso && { v: exif.iso, k: '感光度' },
        exif.focal && { v: exif.focal, k: '焦距' },
      ].filter(Boolean) as { v: string; k: string }[]
    : [];
  const hasExif = params.length > 0 || exif?.camera || exif?.fileName;

  return (
    <View style={styles.root}>
      {/* 原版 live_after 采样：照片为整页背景（延伸到状态栏后），标题叠在照片上，向下渐隐入黑 */}
      <Image source={{ uri: id }} style={styles.photoBg} contentFit="cover" recyclingKey={id} />
      <LinearGradient
        colors={['rgba(14,14,18,0)', 'rgba(14,14,18,0.35)', '#0e0e12']}
        locations={[0, 0.5, 1]}
        style={styles.photoFade}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 时间标题（相对时间大字 + 完整日期） */}
        {row && (
          <>
            <Text style={styles.bigTime}>{formatTime(row.creationDate, 'relative')}</Text>
            <Text style={styles.fullDate}>{fullDate(row.creationDate)}</Text>
          </>
        )}

        {/* 相片信息 */}
        <View style={styles.sectionHead}>
          <Ionicons name="camera-outline" size={15} color={C.textDim} />
          <Text style={styles.sectionTitle}>相片信息</Text>
        </View>

        {!hasExif ? (
          <Text style={styles.noExif}>这张照片没有拍摄参数（截屏或编辑过的照片）</Text>
        ) : (
          <>
            {!!exif?.camera && (
              <View style={styles.deviceRow}>
                <Text style={styles.deviceKey}>设备</Text>
                <Text style={styles.deviceVal}>{exif.camera}</Text>
              </View>
            )}
            {params.length > 0 && (
              <View style={styles.paramRow}>
                {params.map((p) => (
                  <View key={p.k} style={styles.paramCard}>
                    <Text style={styles.paramVal}>{p.v}</Text>
                    <Text style={styles.paramKey}>{p.k}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.kvList}>
              {!!exif?.fileName && (
                <View style={styles.kv}>
                  <Text style={styles.kvKey}>• 文件名</Text>
                  <Text style={styles.kvVal}>{exif.fileName}</Text>
                </View>
              )}
              {!!row && (
                <View style={styles.kv}>
                  <Text style={styles.kvKey}>• 分辨率</Text>
                  <Text style={styles.kvVal}>{row.width} × {row.height}</Text>
                </View>
              )}
              {size != null && (
                <View style={styles.kv}>
                  <Text style={styles.kvKey}>• 文件大小</Text>
                  <Text style={styles.kvVal}>{formatBytes(size)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* 拍摄位置 */}
        <View style={styles.sectionHead}>
          <Ionicons name="navigate-outline" size={15} color={C.textDim} />
          <Text style={styles.sectionTitle}>拍摄位置</Text>
        </View>
        {loc ? (
          <>
            <View style={styles.mapWrap}>
              <MapView
                style={styles.map}
                initialRegion={{ latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
              >
                <Marker coordinate={{ latitude: loc.latitude, longitude: loc.longitude }} />
              </MapView>
            </View>
            <View style={styles.placeRow}>
              <Text style={styles.placeText}>{parts?.street ?? (parts || loc ? '' : '定位中…')}</Text>
              <Text style={styles.placeRegion}>{parts?.region ?? ''}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noExif}>这张照片没有位置信息</Text>
        )}
      </ScrollView>

      {/* 底部：关闭 + 去相册 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.roundBtn} onPress={() => router.back()}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={() => {
            if (Platform.OS === 'ios') void Linking.openURL('photos-redirect://');
          }}
        >
          <Ionicons name="images-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e12' },
  photoBg: { position: 'absolute', top: 0, left: 0, right: 0, height: Dimensions.get('window').height * 0.46 },
  photoFade: { position: 'absolute', top: 0, left: 0, right: 0, height: Dimensions.get('window').height * 0.46 },
  scroll: { paddingHorizontal: 22, paddingTop: Dimensions.get('window').height * 0.24, paddingBottom: 24 },
  bigTime: { color: '#fff', fontSize: 28, fontWeight: '800' },
  fullDate: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '600', marginTop: 4 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26, marginBottom: 10 },
  sectionTitle: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  noExif: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  deviceKey: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deviceVal: { color: '#fff', fontSize: 17, fontWeight: '700' },
  paramRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  paramCard: {
    flex: 1, backgroundColor: 'rgba(20,20,28,0.55)', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center', gap: 3,
  },
  paramVal: { color: '#fff', fontSize: 14, fontWeight: '800' },
  paramKey: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  kvList: { gap: 10 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kvKey: { color: '#fff', fontSize: 15 },
  kvVal: { color: '#fff', fontSize: 15, fontWeight: '700' },

  mapWrap: { height: 170, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  map: { flex: 1 },
  placeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  placeText: { color: '#fff', fontSize: 15, flexShrink: 1 },
  placeRegion: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'right' },

  bottomBar: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingBottom: 34, paddingTop: 8 },
  roundBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.capsuleDark,
    alignItems: 'center', justifyContent: 'center',
  },
  closeGlyph: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
