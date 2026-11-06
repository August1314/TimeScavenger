import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Modal, PanResponder } from 'react-native';
import { C } from '../theme/colors';

const MIN = 5;
const MAX = 100;
const STEP = 5;

function snap(v: number): number {
  return Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
}

interface Props {
  visible: boolean;
  initial: number;
  onCommit: (n: number) => void;
  onClose: () => void;
}

/** 每组数量滑杆（5–100，步进 5），无第三方依赖的自绘滑杆 */
export function GroupSizeSheet({ visible, initial, onCommit, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const trackW = useRef(0);
  const valueRef = useRef(initial);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setValue(snap((e.nativeEvent.locationX / trackW.current) * (MAX - MIN) + MIN));
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(trackW.current, e.nativeEvent.locationX));
        setValue(snap((x / trackW.current) * (MAX - MIN) + MIN));
      },
    }),
  ).current;

  const pct = ((value - MIN) / (MAX - MIN)) * 100;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>调整每组数量</Text>
          <Text style={styles.value}>{value}</Text>
          <View style={styles.rangeRow}>
            <Text style={styles.range}>{MIN}</Text>
            <Text style={styles.range}>{MAX}</Text>
          </View>
          <View
            style={styles.trackWrap}
            onLayout={(e) => {
              trackW.current = e.nativeEvent.layout.width;
            }}
            {...pan.panHandlers}
          >
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <View style={[styles.knob, { left: `${pct}%` }]} />
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.ghost} onPress={onClose}>
              <Text style={styles.ghostText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={() => onCommit(value)}>
              <Text style={styles.primaryText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#23232C', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 28, paddingTop: 26, paddingBottom: 44, gap: 6,
  },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  value: { color: '#fff', fontSize: 40, fontWeight: '800', textAlign: 'center', marginVertical: 8 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: -2 },
  range: { color: C.textDim, fontSize: 13 },
  trackWrap: { height: 40, justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { height: 5, borderRadius: 3, backgroundColor: C.accent },
  knob: {
    position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
    marginLeft: -13, top: 7,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  btnRow: { flexDirection: 'row', gap: 14, marginTop: 18 },
  ghost: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
  ghostText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  primary: { flex: 1, backgroundColor: C.accent, borderRadius: 26, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
