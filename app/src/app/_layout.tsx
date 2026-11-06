import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../theme/colors';
import { initDb } from '../db/repo';
import { pendingQueue } from '../lib/deletion';

const icon = (name: (f: boolean) => keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue | null; focused: boolean }) => (
    <Ionicons name={name(focused)} size={22} color={(color as string) ?? C.textDim} />
  );

export default function RootLayout() {
  useEffect(() => {
    void initDb().then(() => pendingQueue.hydrate());
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: {
          backgroundColor: 'rgba(20,20,28,0.92)',
          borderTopWidth: 0,
          height: 62,
          position: 'absolute',
          marginHorizontal: 24,
          marginBottom: 12,
          borderRadius: 31,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textDim,
      }}
    >
      <Tabs.Screen
        name="(photos)"
        options={{
          title: '照片',
          tabBarIcon: icon((f) => (f ? 'albums' : 'albums-outline')),
        }}
      />
      <Tabs.Screen
        name="(videos)"
        options={{
          title: '视频',
          tabBarIcon: icon((f) => (f ? 'play' : 'play-outline')),
        }}
      />
      <Tabs.Screen
        name="(stats)"
        options={{
          title: '统计',
          tabBarIcon: icon(() => 'person'),
        }}
      />
      <Tabs.Screen name="spike" options={{ href: null }} />
    </Tabs>
    </GestureHandlerRootView>
  );
}
