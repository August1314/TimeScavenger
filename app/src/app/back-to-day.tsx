import { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GradientBackground } from '../theme/GradientBackground';
import { C } from '../theme/colors';
import { dayTitle, sameDayItems } from '../lib/sameDay';
import { getMediaById } from '../db/repo';
import { pendingQueue } from '../lib/deletion';
import { markSeen } from '../lib/session';
import { toggleId, selectedIdsOf } from '../lib/selection';
import { hapticSelect } from '../lib/haptics';
import type { MediaRow } from '../db/repo';

const W = Dimensions.get('window').width;
const COL_W = Math.round((W - 40 - 12) / 2); // 两列宽
const PHOTO_H = Math.round(COL_W * (4 / 3));

export default function BackToDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const anchor = await getMediaById(id);
    if (anchor) setItems(await sameDayItems(anchor));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = items.length > 0 && sel.length === items.length;
  const toggleAll = () => {
    hapticSelect();
    setSel(allSelected ? [] : items.map((r) => r.localIdentifier));
  };

  const commitQueue = async () => {
    const ids = selectedIdsOf(items.map((r) => ({ id: r.localIdentifier })), sel);
    for (const it of items) {
      if (ids.includes(it.localIdentifier)) {
        await pendingQueue.push(it);
        await markSeen(it);
      }
    }
    setSel([]);
    setToast(`已加入待删除 · ${ids.length}`);
    setTimeout(() => setToast(null), 2200);
  };

  const columns: MediaRow[][] = [];
  for (let i = 0; i < items.length; i += 2) columns.push(items.slice(i, i + 2));

  return (
    <View style={styles.root}>
      <GradientBackground seed={id} />

      {/* 顶栏（原版 IMG_1493：‹ + 居中标题 + ✓全选圆钮） */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.roundBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.titleSub}>回到那天</Text>
          <Text style={styles.titleMain}>{items.length > 0 ? dayTitle(items[0].creationDate) : '…'}</Text>
        </View>
        <TouchableOpacity style={styles.roundBtn} onPress={toggleAll}>
          <Ionicons name={allSelected ? 'close' : 'checkmark'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 横滑两行照片墙 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.wall}
        onScroll={(e) => {
          const max = e.nativeEvent.contentSize.width - W;
          setProgress(max > 0 ? Math.min(1, e.nativeEvent.contentOffset.x / max) : 0);
        }}
        scrollEventThrottle={32}
      >
        {columns.map((col, ci) => (
          <View key={ci} style={styles.column}>
            {col.map((it) => {
              const on = sel.includes(it.localIdentifier);
              return (
                <TouchableOpacity
                  key={it.localIdentifier}
                  activeOpacity={0.85}
                  style={styles.cell}
                  onPress={() => setSel((s) => toggleId(s, it.localIdentifier))}
                >
                  <Image source={{ uri: it.localIdentifier }} style={styles.photo} contentFit="cover" recyclingKey={it.localIdentifier} />
                  {on && (
                    <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        {items.length === 0 && <Text style={styles.empty}>没有找到当天的照片</Text>}
      </ScrollView>

      {/* 底栏：刻度进度 + 入队按钮 */}
      <View style={styles.bottomBar}>
        {sel.length > 0 ? (
          <TouchableOpacity style={styles.queueBtn} onPress={() => void commitQueue()}>
            <Text style={styles.queueText}>加入待删除 · {sel.length}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ticks}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={[styles.tick, i / 24 <= progress && styles.tickOn]} />
            ))}
          </View>
        )}
      </View>

      {toast && (
        <View style={styles.toastWrap}><View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10,
  },
  roundBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: C.capsuleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: { alignItems: 'center' },
  titleSub: { color: C.textDim, fontSize: 13 },
  titleMain: { color: '#fff', fontSize: 22, fontWeight: '800' },

  wall: { gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  column: { gap: 12 },
  cell: { width: COL_W, height: PHOTO_H, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  photo: { flex: 1 },
  check: {
    position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.ok, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  empty: { color: C.textDim, fontSize: 15, alignSelf: 'center', marginTop: 80 },

  bottomBar: { alignItems: 'center', paddingBottom: 40, paddingTop: 10, minHeight: 80, justifyContent: 'center' },
  ticks: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(30,30,40,0.6)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  tick: { width: 2, height: 12, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  tickOn: { backgroundColor: '#fff', height: 16 },
  queueBtn: { backgroundColor: C.accent, borderRadius: 26, paddingHorizontal: 36, paddingVertical: 14 },
  queueText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  toastWrap: { position: 'absolute', bottom: 130, alignSelf: 'center' },
  toast: { backgroundColor: 'rgba(30,30,40,0.9)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 9 },
  toastText: { color: '#fff', fontSize: 14 },
});
