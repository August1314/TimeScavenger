import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStats, type StatGroup } from '../../../db/repo';
import { formatBytes, totalFreed } from '../../../lib/statsModel';

const GROUP_META: Record<StatGroup['group'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  photos: { label: '照片', icon: 'images' },
  screenshots: { label: '截屏', icon: 'scan' },
  videos: { label: '视频', icon: 'play' },
};

const VIEW_BLUE = '#7B95FF';
const DEL_RED = '#E0645A';
const OK_GREEN = '#7ED08F';

export default function StatsHome() {
  const [groups, setGroups] = useState<StatGroup[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getStats().then((g) => {
        if (alive) setGroups(g);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const freed = totalFreed(groups);
  const totalDeleted = groups.reduce((s, g) => s + g.deleted, 0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>使用统计</Text>
        <TouchableOpacity style={styles.gear} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {groups.map((g) => {
          const meta = GROUP_META[g.group];
          return (
            <View key={g.group} style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name={meta.icon} size={17} color="#fff" />
                <Text style={styles.cardName}>{meta.label}</Text>
              </View>
              <View style={styles.metrics}>
                <Metric icon="eye" color={VIEW_BLUE} label="查看" value={String(g.viewed)} />
                <Metric icon="trash" color={DEL_RED} label="删除" value={String(g.deleted)} />
                <Metric icon="save" color={OK_GREEN} label="清理" value={formatBytes(g.freedBytes)} />
              </View>
            </View>
          );
        })}

        {/* 腾出空间卡（规范 §4：大数字 + 底部细进度条） */}
        <View style={styles.card}>
          <Text style={styles.freedLabel}>已腾出空间</Text>
          <Text style={styles.freedBig}>{formatBytes(freed)}</Text>
          <Text style={styles.freedSub}>共删除 {totalDeleted} 项</Text>
          <View style={styles.freedTrack}>
            {groups.map((g) =>
              freed > 0 && g.freedBytes > 0 ? (
                <View key={g.group} style={{ flex: g.freedBytes, backgroundColor: groupColor(g.group) }} />
              ) : null,
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function groupColor(g: StatGroup['group']): string {
  return g === 'photos' ? VIEW_BLUE : g === 'screenshots' ? DEL_RED : OK_GREEN;
}

function Metric({ icon, color, label, value }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricLabelRow}>
        <Ionicons name={icon} size={11} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#18191E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 74, paddingHorizontal: 22 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, paddingHorizontal: 22, paddingTop: 20, gap: 14 },
  card: { backgroundColor: '#15151A', borderRadius: 16, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  metrics: { flexDirection: 'row' },
  metric: { flex: 1, gap: 4 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  metricValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  freedLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  freedBig: { color: '#fff', fontSize: 30, fontWeight: '800' },
  freedSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  freedTrack: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', gap: 2 },
});
