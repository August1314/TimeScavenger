import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { C } from '../theme/colors';
import { ALL_BUCKET, filterAggregateBuckets, type Category } from '../db/repo';

// 分类菜单的文案与顺序
export const CATEGORY_LABELS: Record<Category, string> = {
  photo: '照片',
  screenshot: '截屏',
  selfie: '自拍',
  live: '实况',
  gif: '动图',
  long: '长图',
  video: '视频',
};

const ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
  photo: 'images',
  screenshot: 'scan',
  selfie: 'person',
  live: 'radio',
  gif: 'diamond',
  long: 'tablet-portrait',
  video: 'play',
};

const ORDER: Category[] = ['photo', 'screenshot', 'selfie', 'live', 'gif', 'long'];

/** iOS 固定类型菜单（行为与旧版一致） */
export function buildCategoryMenu(): MenuEntry[] {
  return ORDER.map((c) => ({ key: c as string, label: CATEGORY_LABELS[c], icon: ICONS[c] }));
}

/** Android 文件夹菜单：全部 + 降序真实夹（聚合夹剔除）；counts 需已按数量降序 */
export function buildBucketMenu(counts: { bucket: string; count: number }[]): MenuEntry[] {
  const total = counts.reduce((s, c) => s + c.count, 0);
  return [
    { key: ALL_BUCKET, label: '照片', icon: 'images' },
    ...filterAggregateBuckets(counts, total).map((c) => ({ key: c.bucket, label: c.bucket, icon: 'folder-outline' as const })),
  ];
}

export interface MenuEntry {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  visible: boolean;
  items: MenuEntry[];
  currentKey: string;
  onSelectKey: (key: string) => void;
  onGroupSize: () => void;
  onClose: () => void;
}

export function CategoryMenu({ visible, items, currentKey, onSelectKey, onGroupSize, onClose }: Props) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={[styles.panel, { maxHeight: height * 0.6 }]}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {items.map((it) => (
              <TouchableOpacity key={it.key} style={styles.row} onPress={() => onSelectKey(it.key)}>
                <View style={styles.checkCol}>
                  {currentKey === it.key && <Text style={styles.check}>✓</Text>}
                </View>
                <Ionicons name={it.icon} size={20} color="#fff" />
                <Text style={styles.label} numberOfLines={1}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={onGroupSize}>
            <View style={styles.checkCol} />
            <Ionicons name="options" size={20} color="#fff" />
            <Text style={styles.label}>调整每组数量</Text>
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  panel: {
    position: 'absolute', top: 108, left: 20, width: 216,
    borderRadius: 26, overflow: 'hidden',
    backgroundColor: 'rgba(58,58,70,0.55)',
    paddingTop: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  scroll: { paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 12, gap: 12 },
  checkCol: { width: 14 },
  check: { color: '#fff', fontSize: 15, fontWeight: '700' },
  label: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 6, marginHorizontal: 14 },
});
