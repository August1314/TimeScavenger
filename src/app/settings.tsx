import { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { getSetting, setSetting } from '../db/repo';
import { GroupSizeSheet } from '../components/GroupSizeSheet';
import { ResetSheet } from '../components/ResetSheet';
import { setHapticsEnabled, hapticSelect } from '../lib/haptics';
import { C } from '../theme/colors';

type Seg = { key: string; label: string };

export default function SettingsScreen() {
  const [photosPerGroup, setPhotosPerGroup] = useState('15');
  const [hapticsOn, setHapticsOn] = useState(true);
  const [doubleTap, setDoubleTap] = useState<'favorite' | 'zoom'>('favorite');
  const [timeFormat, setTimeFormat] = useState<'relative' | 'date'>('relative');
  const [sizeOpen, setSizeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  const rescan = async () => {
    setScanning(true);
    setScanMsg('');
    try {
      const { startImport } = require('../lib/scan');
      const res = await startImport(() => {});
      setScanMsg(`已更新 ${res.imported} 项`);
    } finally {
      setScanning(false);
    }
  };

  const reload = useCallback(async () => {
    const [pg, hp, dt, tf] = await Promise.all([
      getSetting('photosPerGroup'),
      getSetting('haptics'),
      getSetting('doubleTapAction'),
      getSetting('timeFormat'),
    ]);
    setPhotosPerGroup(pg ?? '15');
    setHapticsOn(hp !== 'off');
    setDoubleTap(dt === 'zoom' ? 'zoom' : 'favorite');
    setTimeFormat(tf === 'date' ? 'date' : 'relative');
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const seg = async (key: string, value: string, setter: (v: string) => void) => {
    hapticSelect();
    setter(value);
    await setSetting(key, value);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* 浏览 */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={() => setSizeOpen(true)}>
            <Text style={styles.rowTitle}>每组照片数量</Text>
            <Text style={styles.rowValue}>{photosPerGroup} 张 ›</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>双击手势</Text>
            <Segment
              opts={[{ key: 'favorite', label: '收藏' }, { key: 'zoom', label: '放大' }]}
              value={doubleTap}
              onChange={(v) => void seg('doubleTapAction', v, (x) => setDoubleTap(x as 'favorite' | 'zoom'))}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>时间显示</Text>
            <Segment
              opts={[{ key: 'relative', label: '相对' }, { key: 'date', label: '日期' }]}
              value={timeFormat}
              onChange={(v) => void seg('timeFormat', v, (x) => setTimeFormat(x as 'relative' | 'date'))}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>震动反馈</Text>
            <Switch
              value={hapticsOn}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: C.accent }}
              onValueChange={async (v) => {
                setHapticsOn(v);
                setHapticsEnabled(v);
                await setSetting('haptics', v ? 'on' : 'off');
              }}
            />
          </View>
        </View>

        {/* 数据 */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.row} onPress={() => setResetOpen(true)}>
            <Text style={styles.rowTitle}>重置浏览记录</Text>
            <Text style={styles.rowValue}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} disabled={scanning} onPress={() => void rescan()}>
            <Text style={styles.rowTitle}>重新扫描照片库</Text>
            <Text style={styles.rowValue}>{scanMsg || (scanning ? '扫描中…' : '›')}</Text>
          </TouchableOpacity>
        </View>

        {/* 关于 */}
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>版本</Text>
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
          <View style={styles.about}>
            <Text style={styles.aboutText}>
              拾光仅在本机访问与处理你的照片数据，不会上传任何内容。所有删除操作都会先进入待删除队列，由你最终确认。
            </Text>
          </View>
        </View>
      </ScrollView>

      <GroupSizeSheet
        visible={sizeOpen}
        initial={parseInt(photosPerGroup, 10) || 15}
        onCommit={async (num) => {
          await setSetting('photosPerGroup', String(num));
          setPhotosPerGroup(String(num));
          setSizeOpen(false);
        }}
        onClose={() => setSizeOpen(false)}
      />
      <ResetSheet visible={resetOpen} onClose={() => setResetOpen(false)} />
    </View>
  );
}

function Segment({ opts, value, onChange }: { opts: Seg[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segWrap}>
      {opts.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[styles.segItem, value === o.key && styles.segOn]}
          onPress={() => onChange(o.key)}
        >
          <Text style={[styles.segText, value === o.key && styles.segTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 74, paddingHorizontal: 22 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { color: '#fff', fontSize: 17, fontWeight: '700' },
  list: { padding: 22, gap: 16, paddingBottom: 60 },
  group: { backgroundColor: '#23232C', borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowValue: { color: C.textDim, fontSize: 15 },
  segWrap: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 3 },
  segItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 13 },
  segOn: { backgroundColor: C.accent },
  segText: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  segTextOn: { color: '#fff' },
  about: { paddingVertical: 14 },
  aboutText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19 },
});
