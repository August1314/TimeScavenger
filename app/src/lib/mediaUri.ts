import { Platform } from 'react-native';

/**
 * expo-image / expo-video 在 Android 只认 content:// URI；
 * DB 存的 localIdentifier 在 iOS 是 ph://…（直接可用），
 * 在 Android 是 MediaStore 数字 id，需拼成 content URI。
 */
export function toDisplayUri(
  id: string,
  mediaType: string,
  os: 'ios' | 'android' = Platform.OS as 'ios' | 'android'
): string {
  if (os !== 'android') return id;
  if (id.startsWith('content://')) return id;
  const kind = mediaType === 'video' ? 'video' : 'images';
  return `content://media/external/${kind}/media/${id}`;
}
