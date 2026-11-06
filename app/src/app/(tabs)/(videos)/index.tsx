import { Text, View, StyleSheet } from 'react-native';
import { GradientBackground } from '../../../theme/GradientBackground';
import { C } from '../../../theme/colors';

export default function VideosHome() {
  return (
    <View style={styles.root}>
      <GradientBackground />
      <View style={styles.center}>
        <Text style={styles.t}>视频回顾（T11 落地）</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 90 },
  t: { color: C.textDim, fontSize: 16 },
});
