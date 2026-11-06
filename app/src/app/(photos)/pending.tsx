import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { C } from '../../theme/colors';
import { pendingQueue, commitPending, nativeDeps } from '../../lib/deletion';
import { toggleId, selectedIdsOf } from '../../lib/selection';

export default function PendingScreen() {
  const [items, setItems] = useState(() => pendingQueue.list());
  const [sel, setSel] = useState<string[]>(() => pendingQueue.list().map((r) => r.localIdentifier));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setSel((s) => toggleId(s, id));

  const confirmDelete = async () => {
    if (busy) return;
    const ids = selectedIdsOf(items.map((r) => ({ id: r.localIdentifier })), sel);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await commitPending(ids, nativeDeps());
      if (res.failed.length > 0) {
        Alert.alert('删除未完成', res.failed[0].error);
      }
      const left = pendingQueue.list();
      setItems(left);
      setSel(left.map((r) => r.localIdentifier));
      if (left.length === 0) router.back();
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    pendingQueue.discardAll();
    router.back();
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>有待删除的照片</Text>
        <TouchableOpacity style={styles.close} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        numColumns={4}
        keyExtractor={(r) => r.localIdentifier}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        renderItem={({ item }) => {
          const on = sel.includes(item.localIdentifier);
          return (
            <TouchableOpacity style={styles.thumbWrap} onPress={() => toggle(item.localIdentifier)}>
              <Image source={{ uri: item.localIdentifier }} style={styles.thumb} recyclingKey={item.localIdentifier} />
              {on && (
                <View style={styles.check}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>没有待删除的项目</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.discardBtn} onPress={discard}>
          <Text style={styles.discardText}>放弃，返回首页</Text>
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
