import { Stack } from 'expo-router';
import { C } from '../../theme/colors';

export default function PhotosLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
      }}
    />
  );
}
