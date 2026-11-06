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
  cards: CardData[];
  index: number;
  badge?: React.ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
}

const SWIPE_UP_THRESHOLD = -110;
const SWIPE_DOWN_THRESHOLD = 110;
const SWIPE_SIDE_THRESHOLD = 90;

function TopCard({ card, badge, onSwipe, onDoubleTap, onPinchOut }: {
  card: CardData;
  badge?: React.ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const gone = useSharedValue(0);

  useEffect(() => {
    x.value = 0; y.value = 0; scale.value = 1; gone.value = 0;
  }, [card.id, x, y, scale, gone]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${x.value * 0.02}deg` },
      { scale: scale.value },
    ],
    opacity: withTiming(gone.value === 1 ? 0 : 1, { duration: 200 }),
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
        gone.value = 1;
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
      if (e.scale < 1) scale.value = Math.max(0.75, e.scale);
    })
    .onEnd((e) => {
      if (e.scale < 0.85) runOnJS(onPinchOut)();
      scale.value = withSpring(1, { damping: 14 });
    });

  const composed = Gesture.Race(pan, doubleTap, pinch);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, style]}>
        <Image
          source={{ uri: card.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={card.id}
        />
        {badge}
      </Animated.View>
    </GestureDetector>
  );
}

export function CardStack({ cards, index, badge, onSwipe, onDoubleTap, onPinchOut }: Props) {
  const visible = cards.slice(index, index + 2);
  const top = visible[0];
  const behind = visible[1];
  return (
    <View style={styles.stack} pointerEvents="box-none">
      {behind && (
        <View style={[styles.card, styles.behind]}>
          <Image source={{ uri: behind.uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={behind.id} />
        </View>
      )}
      {top && (
        <TopCard card={top} badge={badge} onSwipe={onSwipe} onDoubleTap={onDoubleTap} onPinchOut={onPinchOut} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#222',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  behind: {
    position: 'absolute',
    transform: [{ scale: 0.94 }, { translateY: 18 }],
    opacity: 0.55,
  },
});
