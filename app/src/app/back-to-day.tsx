import { Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { GradientBackground } from '../theme/GradientBackground';
import { C } from '../theme/colors';

export default function BackToDayPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.root}>
      <GradientBackground />
      <View style={styles.center}>
        <Text style={styles.t}>回到那天（T10 落地）</Text>
        <Text style={styles.id}>{id}</Text>
        <Text style={styles.back} onPress={() => router.back()}>返回</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  t: { color: '#fff', fontSize: 18 },
  id: { color: C.textDim, fontSize: 11, marginTop: 8 },
  back: { color: C.accent, marginTop: 24, fontSize: 16 },
});
