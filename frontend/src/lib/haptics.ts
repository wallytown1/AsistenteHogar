import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Wrapper seguro sobre expo-haptics. En web (donde no existe API háptica) y ante
 * cualquier error, degrada a no-op silencioso. Da el "tacto" nativo a las acciones.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  light: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  selection: () => { if (enabled) Haptics.selectionAsync().catch(() => {}); },
  success: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
  error: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};
