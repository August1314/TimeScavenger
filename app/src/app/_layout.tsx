import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb, getSetting } from '../db/repo';
import { pendingQueue } from '../lib/deletion';

export default function RootLayout() {
  useEffect(() => {
    void initDb()
      .then(() => pendingQueue.hydrate())
      .then(async () => {
        const done = await getSetting('onboarded');
        if (done !== '1') router.replace('/onboarding');
      });
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#151520' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ fullScreenGestureEnabled: false }} />
        {/* 全屏流程页：不在 tab 栏内（对齐原版：浏览/信息页无底部 tab） */}
        <Stack.Screen name="review" />
        <Stack.Screen name="settings" />
        {/* 当天预览：modal，下滑手势返回（对齐原版） */}
        <Stack.Screen name="day-preview" options={{ presentation: 'modal', sheetAllowedDetents: [1.0], contentStyle: { backgroundColor: '#000' } }} />
        {/* 信息页：底部滑出 modal，顶部露出照片本体（原版 live_info 采样） */}
        <Stack.Screen name="photo-info" options={{ presentation: 'modal', sheetAllowedDetents: [1.0] }} />
        <Stack.Screen name="back-to-day" />
        {/* 回收站：底部滑出的卡片式 modal（对齐原版 IMG_1498） */}
        <Stack.Screen name="pending" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spike" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
