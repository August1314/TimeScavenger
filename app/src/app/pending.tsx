import React, { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { C } from '../theme/colors';
import { pendingQueue, commitPending, nativeDeps } from '../lib/deletion';
import { toggleId, selectedIdsOf } from '../lib/selection';
import { setSuppressionLevel } from '../lib/binSuppression';
import type { MediaRow } from '../db/repo';

export default function PendingScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await pendingQueue.list();
    setItems(list);
    setSel(list.map((r) => r.localIdentifier));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 标题按内容类型（T7.3 裁决6）
  const videoCount = items.filter((r) => r.mediaType === 'video').length;
  const title = items.length > 0 && videoCount > items.length - videoCount ? '有待删除的视频' : '有待删除的照片';

  const closeX = () => {
    setSuppressionLevel(items.length); // 抑制水位：队列不再增长则不自动重弹
    router.back();
  };

  const discard = async () => {
    await pendingQueue.discardAll();
    setSuppressionLevel(0);
    router.back();
  };

  const confirmDelete = async () => {
    if (busy) return;
    const ids = selectedIdsOf(items.map((r) => ({ id: r.localIdentifier })), sel);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await commitPending(ids, nativeDeps());
      if (res.failed.length > 0) {
        const cancelled = res.failed.every((f) => f.error === '已取消删除。');
        setToast(cancelled ? '已取消删除。待删除内容已保留。' : '请稍后重试。待删除内容已保留。');
      }
      await reload();
      const left = await pendingQueue.list();
      if (left.length === 0) {
        setSuppressionLevel(0);
        router.back();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.close} onPress={closeX}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {toast && (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      )}

      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(r) => r.localIdentifier}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
        renderItem={({ item }) => {
          const on = sel.includes(item.localIdentifier);
          return (
            <TouchableOpacity style={styles.thumbWrap} onPress={() => setSel((s) => toggleId(s, item.localIdentifier))}>
              <Image source={{ uri: item.localIdentifier }} style={styles.thumb} recyclingKey={item.localIdentifier} />
              {on && (
                <View style={styles.check}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={loaded ? <Text style={styles.empty}>没有已删除的项目</Text> : <View />}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.discardBtn} onPress={discard}>
          <Text style={styles.discardText}>{from === 'done' ? '放弃，返回' : '放弃，回到首页'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, (busy || sel.length === 0) && styles.disabled]}
          onPress={confirmDelete}
        >
          <Text style={styles.deleteText}>{busy ? '删除中' : '确认删除'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.sheet },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 16, position: 'relative' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  close: {
    position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18 },
  toast: { alignSelf: 'center', backgroundColor: 'rgba(224,90,90,0.25)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 8 },
  toastText: { color: '#FFD1D1', fontSize: 13 },
  thumbWrap: { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb: { flex: 1 },
  check: {
    position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.ok, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  empty: { color: C.textDim, textAlign: 'center', marginTop: 40 },
  footer: { flexDirection: 'row', gap: 14, padding: 24, paddingBottom: 40 },
  discardBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  discardText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { flex: 1, backgroundColor: C.danger, borderRadius: 26, paddingVertical: 15, alignItems: 'center' },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
