import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { C } from '../../theme/colors';

const icon = (name: (f: boolean) => keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue | null; focused: boolean }) => (
    <Ionicons name={name(focused)} size={22} color={(color as string) ?? C.textDim} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        // UI设计规范 §2：悬浮胶囊 tab 栏 #2A2A37/92%，高 62，圆角 31，左右缩进 24
        tabBarStyle: {
          backgroundColor: C.tabbar,
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
          tabBarButtonProps: { testID: 'tab_photos' },
          tabBarIcon: icon((f) => (f ? 'albums' : 'albums-outline')),
        }}
      />
      <Tabs.Screen
        name="(videos)"
        options={{
          title: '视频',
          tabBarButtonProps: { testID: 'tab_videos' },
          tabBarIcon: icon((f) => (f ? 'play' : 'play-outline')),
        }}
      />
      <Tabs.Screen
        name="(stats)"
        options={{
          title: '统计',
          tabBarButtonProps: { testID: 'tab_stats' },
          tabBarIcon: icon(() => 'person'),
        }}
      />
    </Tabs>
  );
}
