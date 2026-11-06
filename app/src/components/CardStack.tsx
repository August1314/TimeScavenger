import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import type { SwipeDir } from '../lib/deckMachine';

interface CardData {
  id: string;
  uri: string;
}

interface Props {
  cards: CardData[]; // 当前组
  index: number;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
}

const SWIPE_UP_THRESHOLD = -110;
const SWIPE_DOWN_THRESHOLD = 110;
const SWIPE_SIDE_THRESHOLD = 90;

/** 当前卡手势层 */
function TopCard({ card, onSwipe, onDoubleTap, onPinchOut }: {
  card: CardData;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  const flying = useSharedValue(0); // 0 无 1 飞出

  useEffect(() => {
    x.value = 0; y.value = 0; rot.value = 0; scale.value = 1; flying.value = 0;
  }, [card.id, x, y, rot, scale, flying]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rot.value + x.value * 0.03}deg` },
      { scale: scale.value },
    ],
    opacity: withTiming(flying.value === 1 ? 0 : 1, { duration: 220 }),
  }));

  const pan = Gesture.Pan()
    .onChange((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      const dy = e.translationY;
      const dx = e.translationX;
      let dir: SwipeDir | null = null;
      if (dy < SWIPE_UP_THRESHOLD && Math.abs(dy) > Math.abs(dx)) dir = 'up';
      else if (dy > SWIPE_DOWN_THRESHOLD && Math.abs(dy) > Math.abs(dx)) dir = 'down';
      else if (dx < -SWIPE_SIDE_THRESHOLD) dir = 'left';
      else if (dx > SWIPE_SIDE_THRESHOLD) dir = 'right';

      if (dir) {
        flying.value = 1;
        const target =
          dir === 'up' ? { x: 0, y: -900 }
          : dir === 'down' ? { x: 0, y: 900 }
          : dir === 'left' ? { x: -600, y: 0 }
          : { x: 600, y: 0 };
        x.value = withTiming(target.x, { duration: 200 });
        y.value = withTiming(target.y, { duration: 200 });
        runOnJS(onSwipe)(dir);
      } else {
        x.value = withSpring(0, { damping: 16, stiffness: 160 });
        y.value = withSpring(0, { damping: 16, stiffness: 160 });
      }
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(onDoubleTap)());

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      if (e.scale < 1) scale.value = Math.max(0.7, e.scale);
    })
    .onEnd((e) => {
      if (e.scale < 0.85) runOnJS(onPinchOut)();
      scale.value = withSpring(1, { damping: 14 });
    });

  const composed = Gesture.Race(pan, doubleTap, pinch);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, style]}>
        <View style={styles.polaroid}>
          <Image
            source={{ uri: card.uri }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            recyclingKey={card.id}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export function CardStack({ cards, index, onSwipe, onDoubleTap, onPinchOut }: Props) {
  const visible = cards.slice(index, index + 3);
  return (
    <View style={styles.stack} pointerEvents="box-none">
      {visible.map((c, i) => {
        const depth = visible.length - 1 - i; // 0 = top
        if (depth === 0) {
          return (
            <View key={c.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <TopCard card={c} onSwipe={onSwipe} onDoubleTap={onDoubleTap} onPinchOut={onPinchOut} />
            </View>
          );
        }
        return (
          <Animated.View
            key={c.id}
            style={[
              styles.card,
              styles.behind,
              {
                transform: [
                  { translateY: depth * 14 },
                  { translateX: depth === 1 ? (i % 2 ? 26 : -26) : 0 },
                  { rotate: `${depth === 1 ? (i % 2 ? 5 : -5) : depth * 2}deg` },
                  { scale: 1 - depth * 0.05 },
                ],
              },
            ]}
          >
            <View style={styles.polaroid}>
              <Image source={{ uri: c.uri }} style={styles.photo} contentFit="cover" recyclingKey={c.id} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '82%',
    aspectRatio: 0.82,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  behind: { position: 'absolute' },
  polaroid: { flex: 1, backgroundColor: '#5b5fb0', borderRadius: 10, padding: 10 },
  photo: { flex: 1, borderRadius: 4 },
});
