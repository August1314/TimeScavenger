import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb } from '../db/repo';
import { pendingQueue } from '../lib/deletion';

export default function RootLayout() {
  useEffect(() => {
    void initDb().then(() => pendingQueue.hydrate());
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
        {/* 全屏流程页：不在 tab 栏内（对齐原版：浏览/信息页无底部 tab） */}
        <Stack.Screen name="review" />
        <Stack.Screen name="photo-info" />
        <Stack.Screen name="back-to-day" />
        {/* 回收站：底部滑出的卡片式 modal（对齐原版 IMG_1498） */}
        <Stack.Screen name="pending" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spike" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
