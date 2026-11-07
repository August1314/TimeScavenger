import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { paletteFor } from '../lib/palette';

export function GradientBackground({ seed }: { seed?: string }) {
  const [top, bottom] = paletteFor(seed ?? '');
  // 色带：上 1/3 照片主色暗化，中段迅速转暗，下 2/3 恒深蓝黑 #161627
  return (
    <LinearGradient
      colors={[top, '#262636', bottom]}
      locations={[0, 0.45, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
