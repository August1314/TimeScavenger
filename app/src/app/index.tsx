import { Text, View, StyleSheet } from 'react-native';

export default function HelloScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>去留复刻 · Hello</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151520' },
  text: { color: '#fff', fontSize: 20 },
});
