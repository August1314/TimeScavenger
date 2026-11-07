import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GradientBackground } from '../../../theme/GradientBackground';
import { C } from '../../../theme/colors';
import { countUnreviewed, fetchUnreviewedRandom, setSetting, type Category, type MediaRow } from '../../../db/repo';
import { CategoryMenu, CATEGORY_LABELS } from '../../../components/CategoryMenu';
import { GroupSizeSheet } from '../../../components/GroupSizeSheet';
import { groupSizeLabel } from '../../../lib/session';
import { pendingQueue } from '../../../lib/deletion';
import { getSuppressionLevel } from '../../../lib/binSuppression';

const W = Dimensions.get('window').width;
const CENTER_W = Math.round(W * 0.38); // 中卡宽
const CENTER_H = Math.round(W * 0.62); // 中卡高
const SIDE_W = Math.round(W * 0.4); // 侧卡宽
const SIDE_H = Math.round(W * 0.58); // 侧卡高

export default function PhotosHome() {
  const [n, setN] = useState(0);
  const [size, setSize] = useState('15');
  const [pendingN, setPendingN] = useState(0);
  const [preview, setPreview] = useState<MediaRow[]>([]);
  const [category, setCategory] = useState<Category>('photo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [count, label, prev, pn] = await Promise.all([
          countUnreviewed(category),
          groupSizeLabel(category),
          fetchUnreviewedRandom(category, 3),
          pendingQueue.count(),
        ]);
        if (!alive) return;
        setN(count);
        setSize(label);
        setPendingN(pn);
        setPreview(prev);
        // R2：回首页且队列超过抑制水位 → 自动弹确认页
        if (pn > getSuppressionLevel()) {
          router.push({ pathname: '/pending', params: { from: 'home' } });
        }
      })();
      return () => {
        alive = false;
      };
    }, [category]),
  );

  const openBin = () => {
    if (pendingN === 0) return; // 空态无动作（图标即提示）
    router.push({ pathname: '/pending', params: { from: 'home' } });
  };

  const start = () => router.push({ pathname: '/review', params: { category } });

  const commitSize = async (num: number) => {
    await setSetting(category === 'video' ? 'videosPerGroup' : 'photosPerGroup', String(num));
    setSize(String(num));
    setSizeOpen(false);
  };

  const [left, center, right] = preview;

  return (
    <View style={styles.root}>
      <GradientBackground seed={center?.localIdentifier ?? String(n)} />

      {/* 顶栏：左分类胶囊（点开菜单） + 右垃圾桶（待删除常驻入口） */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.capsule} onPress={() => setMenuOpen(true)}>
          <Text style={styles.chev}>⌄</Text>
          <Text style={styles.capsuleText}>{CATEGORY_LABELS[category]}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{size}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.binBtn} onPress={openBin}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          {pendingN > 0 && (
            <View style={styles.binBadge}><Text style={styles.binBadgeText}>{pendingN}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* 中央卡组预览：中卡 + ±8° 白边侧卡 */}
      <View style={styles.deck}>
        {n === 0 ? (
          <Text style={styles.emptyText}>这一轮都回顾完啦{'\n'}可在设置中重置再来一轮</Text>
        ) : (
          <>
            {!!left && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={start}
                style={[styles.sideCard, styles.sideLeft]}
              >
                <Image source={{ uri: left.localIdentifier }} style={styles.sidePhoto} contentFit="cover" recyclingKey={left.localIdentifier} />
              </TouchableOpacity>
            )}
            {!!right && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={start}
                style={[styles.sideCard, styles.sideRight]}
              >
                <Image source={{ uri: right.localIdentifier }} style={styles.sidePhoto} contentFit="cover" recyclingKey={right.localIdentifier} />
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.9} onPress={start} style={styles.centerCard}>
              {center ? (
                <Image
                  source={{ uri: center.localIdentifier }}
                  style={styles.sidePhoto}
                  contentFit="cover"
                  recyclingKey={center.localIdentifier}
                />
              ) : (
                <View style={styles.sidePhoto} />
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 中卡下方的轻提示 */}
      {n > 0 && (
        <Text style={styles.hint} onPress={start}>
          轻触照片开始回顾 · 剩 {n} 张
        </Text>
      )}

      <TouchableOpacity style={styles.spikeLink} onPress={() => router.push('/spike')}>
        <Text style={styles.spikeText}>设备验证页</Text>
      </TouchableOpacity>

      <CategoryMenu
        visible={menuOpen}
        current={category}
        onSelect={(c) => {
          setCategory(c);
          setMenuOpen(false);
        }}
        onGroupSize={() => {
          setMenuOpen(false);
          setSizeOpen(true);
        }}
        onClose={() => setMenuOpen(false)}
      />
      <GroupSizeSheet
        visible={sizeOpen}
        initial={parseInt(size, 10) || 15}
        onCommit={(num) => void commitSize(num)}
        onClose={() => setSizeOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 62, paddingHorizontal: 20,
  },
  capsule: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: C.capsuleLight, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  chev: { color: C.textDim, fontSize: 13 },
  capsuleText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, minWidth: 22, alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12 },
  binBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.capsuleLight, alignItems: 'center', justifyContent: 'center' },
  binBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  binBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textDim, fontSize: 16, textAlign: 'center', lineHeight: 26 },

  // 侧卡：白边圆角照片卡，外翻 ±8°、上移、缩 0.92，从后方上下探出
  sideCard: {
    position: 'absolute', width: SIDE_W, height: SIDE_H,
    backgroundColor: C.cardBase, borderRadius: 22, padding: 5,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  // 侧卡顶缘高出中卡约 40pt，从后上方探出
  sideLeft: { transform: [{ translateX: -W * 0.19 }, { translateY: -W * 0.16 }, { rotate: '-7deg' }, { scale: 0.92 }] },
  sideRight: { transform: [{ translateX: W * 0.19 }, { translateY: -W * 0.16 }, { rotate: '7deg' }, { scale: 0.92 }] },
  sidePhoto: { flex: 1, borderRadius: 18, backgroundColor: '#222' },

  // 中卡：与侧卡同款薄白边（用户裁决 2026-11-06：不要拍立得卡纸边），更大、正立、居前
  centerCard: {
    width: CENTER_W, height: CENTER_H,
    backgroundColor: C.cardBase, borderRadius: 22, padding: 5,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },

  hint: { position: 'absolute', bottom: 96, alignSelf: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  spikeLink: { position: 'absolute', right: 16, bottom: 132, padding: 8 },
  spikeText: { color: 'rgba(255,255,255,0.28)', fontSize: 11 },
});
