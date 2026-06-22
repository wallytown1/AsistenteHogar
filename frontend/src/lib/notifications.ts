import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDiasParaCaducar } from '../hooks/usePantry';
import { AlimentoItem } from '../types/types';

const ID_URGENTE = 'caducidad-urgente';
const ID_PRONTO = 'caducidad-pronto';
const CANAL_ID = 'caducidad';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ID, {
      name: 'Alertas de caducidad',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function proxima9am(): Date {
  const t = new Date();
  t.setHours(9, 0, 0, 0);
  if (t <= new Date()) t.setDate(t.getDate() + 1);
  return t;
}

function cuerpo(primero: string, total: number, sufijo: string): string {
  if (total === 1) return `${primero} ${sufijo}.`;
  return `${primero} y ${total - 1} alimento${total > 2 ? 's' : ''} más ${sufijo}.`;
}

export async function programarNotificacionMarce(texto: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(ID_URGENTE),
    Notifications.cancelScheduledNotificationAsync(ID_PRONTO),
  ]);

  if (!texto) return;

  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: proxima9am(),
  };

  await Notifications.scheduleNotificationAsync({
    identifier: ID_URGENTE, // Reusamos el ID para asegurar unicidad
    content: {
      title: 'Marce 🧑‍🍳',
      body: texto,
      data: {
        screen: 'ChefChat',
        isFromPush: true,
      },
    },
    trigger,
  });
}
