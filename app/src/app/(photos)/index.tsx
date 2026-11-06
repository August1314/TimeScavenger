import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../theme/GradientBackground';
import { C } from '../../theme/colors';
import { countUnreviewed } from '../../db/repo';
import { groupSizeLabel } from '../../lib/session';
import { pendingQueue } from '../../lib/deletion';
import { getSuppressionLevel } from '../../lib/binSuppression';

export default function PhotosHome() {
  const [n, setN] = useState(0);
  const [size, setSize] = useState('15');
  const [pendingN, setPendingN] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [count, label] = await Promise.all([countUnreviewed('photo'), groupSizeLabel('photo')]);
        const pn = await pendingQueue.count();
        if (!alive) return;
        setN(count);
        setSize(label);
        setPendingN(pn);
        // R2：回首页且队列超过抑制水位 → 自动弹确认页
        if (pn > getSuppressionLevel()) {
          router.push({ pathname: '/pending', params: { from: 'home' } });
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const openBin = () => {
    if (pendingN === 0) return; // 空态无动作（图标即提示）
    router.push({ pathname: '/pending', params: { from: 'home' } });
  };

  return (
    <View style={styles.root}>
      <GradientBackground seed={String(n)} />
      <View style={styles.topRow}>
        <View style={styles.capsule}>
          <Text style={styles.chev}>⌄</Text>
          <Text style={styles.capsuleText}>照片</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{size}</Text></View>
        </View>
        <TouchableOpacity style={styles.binBtn} onPress={openBin}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          {pendingN > 0 && (
            <View style={styles.binBadge}><Text style={styles.binBadgeText}>{pendingN}</Text></View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>去留复刻</Text>
        <Text style={styles.sub}>轻触开始回顾</Text>
        <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/review')}>
          <Text style={styles.startText}>开始回顾 · 剩 {n}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.spikeLink} onPress={() => router.push('/spike')}>
          <Text style={styles.spikeText}>设备验证页</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 62, paddingHorizontal: 20 },
  capsule: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: C.capsule, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  chev: { color: C.textDim, fontSize: 13 },
  capsuleText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, minWidth: 22, alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12 },
  binBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.capsule, alignItems: 'center', justifyContent: 'center' },
  binBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  binBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 90 },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  sub: { color: C.textDim, fontSize: 14, marginTop: 8, marginBottom: 28 },
  startBtn: { backgroundColor: C.accent, borderRadius: 28, paddingHorizontal: 44, paddingVertical: 16 },
  startText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  spikeLink: { marginTop: 18, padding: 10 },
  spikeText: { color: C.textDim, fontSize: 13 },
});
