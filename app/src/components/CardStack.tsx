import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LivePhotoView, type LivePhotoViewType } from 'expo-live-photo';
import type { LiveSource } from '../lib/live';
import type { SwipeDir } from '../lib/deckMachine';

interface CardData {
  id: string;
  uri: string;
}

interface Props {
  cards: CardData[];
  index: number;
  badge?: React.ReactNode;
  live?: boolean;
  liveSource?: LiveSource | null;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
  onLongPress: () => void;
  onLiveEnd: (reason?: string) => void;
}

const SWIPE_UP_THRESHOLD = -110;
const SWIPE_DOWN_THRESHOLD = 110;
const SWIPE_SIDE_THRESHOLD = 90;

function TopCard({ card, badge, live, liveSource, onSwipe, onDoubleTap, onPinchOut, onLongPress, onLiveEnd }: {
  card: CardData;
  badge?: React.ReactNode;
  live?: boolean;
  liveSource?: LiveSource | null;
  onSwipe: (dir: SwipeDir) => void;
  onDoubleTap: () => void;
  onPinchOut: () => void;
  onLongPress: () => void;
  onLiveEnd: (reason?: string) => void;
}) {
  const liveRef = React.useRef<LivePhotoViewType>(null);
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

  // 方向反馈：上拖红光+待删除，下拖蓝光+收藏
  const upOverlay = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -y.value / 140)),
  }));
  const downOverlay = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, y.value / 140)),
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

  // 实况照片：按住 0.35 秒立即在卡内开始播放（onStart 在手指未松开时触发）
  const longPress = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(12)
    .onStart(() => {
      if (live) runOnJS(onLongPress)();
    });

  const composed = Gesture.Race(pan, doubleTap, pinch, longPress);

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
        {!!liveSource && (
          <LivePhotoView
            ref={liveRef}
            source={liveSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            useDefaultGestureRecognizer={false}
            onLoadComplete={() => liveRef.current?.startPlayback('full')}
            onPlaybackStop={() => onLiveEnd()}
            onLoadError={(e) => onLiveEnd(e?.message)}
          />
        )}
        <Animated.View pointerEvents="none" style={[styles.upGlow, upOverlay]}>
          <Text style={styles.upLabel}>待删除</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.downGlow, downOverlay]}>
          <Text style={styles.downLabel}>♡ 收藏</Text>
        </Animated.View>
        {badge}
      </Animated.View>
    </GestureDetector>
  );
}

export function CardStack({ cards, index, badge, live, liveSource, onSwipe, onDoubleTap, onPinchOut, onLongPress, onLiveEnd, testID }: Props & { testID?: string }) {
  const top = cards[index];
  // 浏览页为单张全出血卡（无后层卡边）
  return (
    <View style={styles.stack} pointerEvents="box-none" testID={testID}>
      {top && (
        <TopCard card={top} badge={badge} live={live} liveSource={liveSource} onSwipe={onSwipe} onDoubleTap={onDoubleTap} onPinchOut={onPinchOut} onLongPress={onLongPress} onLiveEnd={onLiveEnd} />
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
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  upGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 130,
    backgroundColor: 'rgba(224,60,60,0.35)',
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 22,
  },
  upLabel: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  downGlow: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 130,
    backgroundColor: 'rgba(76,141,255,0.35)',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22,
  },
  downLabel: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 2 },
});
