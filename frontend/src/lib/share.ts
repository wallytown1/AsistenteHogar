import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { APP_SHARE_URL } from '../config/config';

export async function compartirRecetaTexto(
  titulo: string,
  ingredientes: string[],
  tiempoMin: number
) {
  await Share.share({
    message:
      `🍳 ¡Acabo de cocinar "${titulo}" con lo que tenía en casa!\n\n` +
      `Ingredientes: ${ingredientes.join(', ')}\n\n` +
      `⏱️ Solo ${tiempoMin} minutos · Chef Marce lo sugirió 🥘\n\n` +
      `👇 Prueba AsistenteHogar gratis\n${APP_SHARE_URL}`,
    title: titulo,
  });
}

export async function compartirRecetaImagen(uri: string) {
  const disponible = await Sharing.isAvailableAsync();
  if (disponible) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: '¡Comparte tu receta!',
    });
  }
}
