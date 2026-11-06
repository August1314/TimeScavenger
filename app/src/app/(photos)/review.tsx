import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GradientBackground } from '../../theme/GradientBackground';
import { C } from '../../theme/colors';
import { CardStack } from '../../components/CardStack';
import { createDeck, deckReducer, type DeckAction, type DeckState } from '../../lib/deckMachine';
import { nextGroup, markSeen } from '../../lib/session';
import { pendingQueue } from '../../lib/deletion';
import { setFavorite } from '../../lib/assets';
import { formatTime } from '../../lib/time';
import { getSetting } from '../../db/repo';
import type { Category, MediaRow } from '../../db/repo';

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'photo') as Category;
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [timeFormat, setTimeFormat] = useState<'relative' | 'date'>('relative');
  const [, force] = useState(0);

  useEffect(() => {
    (async () => {
      const tf = (await getSetting('timeFormat')) as 'relative' | 'date' | null;
      if (tf === 'date') setTimeFormat('date');
      const g = await nextGroup(category);
      setRows(g.items);
      const dta = (await getSetting('doubleTapAction')) === 'zoom' ? 'zoom' : 'favorite';
      setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier })), dta));
    })();
  }, [category]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.localIdentifier, r])), [rows]);

  const dispatch = useCallback(
    (e: Parameters<typeof deckReducer>[1]) => {
      setDeck((prev) => {
        if (!prev) return prev;
        const { state, action } = deckReducer(prev, e);
        if (action) void run(action);
        return state;
      });
    },
    [],
  );

  const run = async (a: DeckAction) => {
    const row = rowById.get(a.id);
    switch (a.kind) {
      case 'delete':
        if (row) {
          pendingQueue.push(row);
          await markSeen(row);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'favorite':
        if (row) await markSeen(row);
        await setFavorite(a.id, true);
        Haptics.selectionAsync();
        break;
      case 'seen':
        if (row) await markSeen(row);
        break;
      case 'undoDelete':
        pendingQueue.remove(a.id);
        Haptics.selectionAsync();
        break;
      case 'backToDay':
        router.push({ pathname: '/back-to-day', params: { id: a.id } });
        break;
      case 'zoom':
        break;
    }
  };

  if (!deck) {
    return (
      <View style={styles.root}>
        <GradientBackground />
        <View style={styles.center}>
          <Text style={styles.loading}>正在载入随机照片…</Text>
        </View>
      </View>
    );
  }

  const currentRow = rowById.get(deck.items[deck.index]?.id ?? '');
  const progress = deck.items.length ? deck.index / deck.items.length : 0;

  const nextSet = async () => {
    const g = await nextGroup(category);
    setRows(g.items);
    setDeck(createDeck(g.items.map((r) => ({ id: r.localIdentifier, uri: r.localIdentifier }))));
  };

  return (
    <View style={styles.root}>
      <GradientBackground seed={deck.items[deck.index]?.id} />

      {/* 顶栏 */}
      <View style={styles.topBar}>
        <RoundBtn label="‹" onPress={() => router.back()} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <RoundBtn
          label="↑"
          onPress={() =>
            Share.share({ message: '像刷短视频一样刷自己的照片 —— 去留复刻' }).catch(() => {})
          }
        />
      </View>

      {/* 卡组 */}
      <View style={styles.deckArea}>
        {deck.done ? (
          <View style={styles.center}>
            <Text style={styles.doneTitle}>回顾完毕</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={nextSet}>
              <Text style={styles.primaryBtnText}>再来一组</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={styles.ghostBtnText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CardStack
            cards={deck.items}
            index={deck.index}
            onSwipe={(dir) => dispatch({ type: 'swipe', dir })}
            onDoubleTap={() => dispatch({ type: 'doubleTap' })}
            onPinchOut={() => dispatch({ type: 'pinch' })}
          />
        )}
      </View>

      {/* 底栏 */}
      <View style={styles.bottomBar}>
        <RoundBtn
          label="♡"
          onPress={() => {
            const id = deck.items[deck.index]?.id;
            if (!id) return;
            void setFavorite(id, true).then(() => Haptics.selectionAsync());
          }}
        />
        <View style={styles.timeCapsule}>
          <Text style={styles.timeText}>
            {currentRow ? formatTime(currentRow.creationDate, timeFormat) : '未知时间'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const id = deck.items[deck.index]?.id;
              if (id) router.push({ pathname: '/photo-info', params: { id } });
            }}
          >
            <Text style={styles.infoGlyph}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        <RoundBtn label="↩" onPress={() => dispatch({ type: 'undo' })} />
      </View>
    </View>
  );
}

function RoundBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.roundBtn} onPress={onPress}>
      <Text style={styles.roundBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: C.textDim, fontSize: 15 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 62, paddingBottom: 8,
  },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, marginHorizontal: 18 },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  deckArea: { flex: 1, paddingHorizontal: 8 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 110, paddingTop: 10,
  },
  roundBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: C.capsule,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnText: { color: '#fff', fontSize: 22 },
  timeCapsule: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,40,0.75)',
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  timeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoGlyph: { color: C.textDim, fontSize: 16 },
  doneTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 28 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 26, paddingHorizontal: 40, paddingVertical: 15, marginBottom: 14 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: C.textDim, fontSize: 16 },
});
