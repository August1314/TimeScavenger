import { useCallback, useEffect, useReducer, useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { GradientBackground } from '../theme/GradientBackground';
import { C } from '../theme/colors';
import { nextOnboarding, type OnbEvent, type OnbState } from '../lib/onboarding';
import { startImport } from '../lib/scan';
import { setSetting } from '../db/repo';

function reducer(s: OnbState, e: OnbEvent): OnbState {
  return nextOnboarding(s, e);
}

export default function OnboardingScreen() {
  const [st, dispatch] = useReducer(reducer, { phase: 'unknown' });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    void getPermissionsAsync().then((r) =>
      dispatch({ type: 'check', status: r.status as 'granted' | 'limited' | 'denied' | 'restricted' }),
    );
  }, []);

  const doImport = useCallback(async () => {
    dispatch({ type: 'importStart' });
    const res = await startImport((done, total) => setProgress({ done, total }));
    await setSetting('onboarded', '1');
    dispatch({ type: 'importDone', count: res.imported });
    router.replace('/');
  }, []);

  const ask = useCallback(async () => {
    const r = await requestPermissionsAsync();
    const status = r.status as 'granted' | 'limited' | 'denied' | 'restricted';
    dispatch({ type: 'result', status });
    if (status === 'granted' || status === 'limited') void doImport();
  }, [doImport]);

  return (
    <View style={styles.root}>
      <GradientBackground seed="onboarding" />
      <View style={styles.center}>
        <Text style={styles.logo}>去留复刻</Text>

        {st.phase === 'guide' && (
          <>
            <Text style={styles.body}>
              为了进行照片回顾与清理，需要相册访问权限{'\n'}才能在本机呈现和处理你的照片。
            </Text>
            <Text style={styles.privacy}>我们不会上传你的数据，也不会用作任何其它用途。</Text>
            <BigBtn label="继续" onPress={() => void ask()} />
            <SmallBtn label="前往系统设置" onPress={() => { dispatch({ type: 'openSettings' }); void Linking.openURL('app-settings://'); }} />
          </>
        )}

        {(st.phase === 'unknown' || st.phase === 'ask') && (
          <>
            <Text style={styles.body}>像刷短视频一样{'\n'}刷自己的照片</Text>
            <BigBtn label={st.phase === 'unknown' ? '开始' : '开始回顾'} onPress={() => void ask()} />
          </>
        )}

        {st.phase === 'importing' && (
          <>
            <Text style={styles.body}>正在读取相册…</Text>
            <Text style={styles.progress}>
              {progress ? `${progress.done} / ${progress.total}` : '准备中…'}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function BigBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.bigBtn} onPress={onPress}>
      <Text style={styles.bigBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.smallBtn} onPress={onPress}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },
  logo: { color: '#fff', fontSize: 34, fontWeight: '800', marginBottom: 26 },
  body: { color: 'rgba(255,255,255,0.85)', fontSize: 18, textAlign: 'center', lineHeight: 27 },
  privacy: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginTop: 12, marginBottom: 8 },
  progress: { color: C.accent, fontSize: 16, fontWeight: '700', marginTop: 14 },
  bigBtn: { backgroundColor: C.accent, borderRadius: 28, paddingHorizontal: 52, paddingVertical: 15, marginTop: 30 },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  smallBtn: { padding: 14, marginTop: 6 },
  smallBtnText: { color: C.textDim, fontSize: 14 },
});
