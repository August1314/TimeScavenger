// 占位首页：T7 卡组页落地后替换
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { GradientBackground } from '../../theme/GradientBackground';
import { C } from '../../theme/colors';

export default function PhotosHome() {
  return (
    <View style={styles.root}>
      <GradientBackground />
      <View style={styles.center}>
        <Text style={styles.title}>去留复刻</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/spike')}>
          <Text style={styles.btnText}>设备验证页</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 90 },
  title: { color: C.text, fontSize: 26, fontWeight: '800', marginBottom: 24 },
  btn: { backgroundColor: C.capsule, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 24 },
  btnText: { color: C.text, fontSize: 16 },
});
