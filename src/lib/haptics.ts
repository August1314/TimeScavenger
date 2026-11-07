import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(v: boolean): void {
  enabled = v;
}

export function hapticWarn(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function hapticSuccess(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticLight(): void {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticSelect(): void {
  if (enabled) void Haptics.selectionAsync();
}
