import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { paletteFor } from '../lib/palette';

export function GradientBackground({ seed }: { seed?: string }) {
  const [top, bottom] = paletteFor(seed ?? '');
  return <LinearGradient colors={[top, bottom, '#0d0d14']} style={StyleSheet.absoluteFill} />;
}
