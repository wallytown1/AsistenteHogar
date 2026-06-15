import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AlimentoItem } from '../types/types';

// Ask permission once; schedule/cancel local notifications for expiring items.
// Called from PantryScreen when items load.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
}

async function scheduleExpiryNotifications(items: AlimentoItem[]) {
  // Cancel all previous expiry notifications before rescheduling
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith('expiry-')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  for (const item of items) {
    const days = daysUntil(item.fecha_caducidad);
    if (days === null || days < 0 || days > 3) continue;

    const triggerDate = new Date();
    triggerDate.setHours(9, 0, 0, 0); // Notify at 9am
    if (days > 0) triggerDate.setDate(triggerDate.getDate() + (days - 1)); // day before expiry

    // Don't schedule in the past
    if (triggerDate <= new Date()) continue;

    const body =
      days === 0
        ? `${item.nombre} caduca hoy — úsalo antes de que sea tarde.`
        : days === 1
          ? `${item.nombre} caduca mañana.`
          : `${item.nombre} caduca en ${days} días.`;

    await Notifications.scheduleNotificationAsync({
      identifier: `expiry-${item.id}`,
      content: {
        title: 'Despensa — caduca pronto',
        body,
        data: { itemId: item.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
  }
}

export function useExpiryNotifications(items: AlimentoItem[]) {
  useEffect(() => {
    if (items.length === 0) return;
    requestPermission().then((granted) => {
      if (granted) scheduleExpiryNotifications(items);
    });
  }, [items]);
}
