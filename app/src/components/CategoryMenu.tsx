import { Text, View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { C } from '../theme/colors';
import type { Category } from '../db/repo';

// 文案与顺序对齐原版 IMG_1491 / en_localizable.txt
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

interface Props {
  visible: boolean;
  current: Category;
  onSelect: (c: Category) => void;
  onGroupSize: () => void;
  onClose: () => void;
}

export function CategoryMenu({ visible, current, onSelect, onGroupSize, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={styles.panel}>
          {ORDER.map((c) => (
            <TouchableOpacity key={c} style={styles.row} onPress={() => onSelect(c)}>
              <View style={styles.checkCol}>
                {current === c && <Text style={styles.check}>✓</Text>}
              </View>
              <Ionicons name={ICONS[c]} size={20} color="#fff" />
              <Text style={styles.label}>{CATEGORY_LABELS[c]}</Text>
            </TouchableOpacity>
          ))}
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
    paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  row: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 12, gap: 12 },
  checkCol: { width: 14 },
  check: { color: '#fff', fontSize: 15, fontWeight: '700' },
  label: { color: '#fff', fontSize: 17, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 6, marginHorizontal: 14 },
});
