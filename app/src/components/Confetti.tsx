import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const COLORS = ['#7B95FF', '#E0645A', '#7ED08F', '#D49850', '#FFFFFF', '#4C8DFF'];
const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;

function Piece({ seed, size }: { seed: number; size: number }) {
  const fall = useSharedValue(-60);
  const sway = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: sway.value },
      { translateY: fall.value },
      { rotate: `${sway.value * 0.8}deg` },
    ],
  }));
  React.useEffect(() => {
    fall.value = withDelay(
      (seed % 10) * 120,
      withRepeat(withTiming(H + 60, { duration: 2600 + (seed % 7) * 350, easing: Easing.linear }), 2, false),
    );
    sway.value = withRepeat(withTiming(seed % 2 === 0 ? 40 : -40, { duration: 900 + (seed % 5) * 120 }), 6, true);
  }, [seed, fall, sway]);
  return <Animated.View style={[styles.piece, style, { left: (seed * 97) % W, width: size, height: size * 1.6, backgroundColor: COLORS[seed % COLORS.length] }]} />;
}

/** 全部回顾完成时的庆祝彩带（纯装饰，2 秒×2 循环） */
export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => i), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((i) => (
        <Piece key={i} seed={i + 3} size={6 + (i % 3) * 3} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, borderRadius: 2, opacity: 0.9 },
});
