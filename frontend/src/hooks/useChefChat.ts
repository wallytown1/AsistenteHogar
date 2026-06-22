import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiRequest, TIMEOUT } from '../api/api';
import { ChefMensaje, ChefChatResponse } from '../types/types';

const SALUDO_INICIAL: ChefMensaje = {
  rol: 'chef',
  texto:
    '¡Hola! Soy Marce, tu chef. ¿Qué te apetece cocinar hoy? Dime qué tienes o qué te apetece y te echo una mano.',
};

// Solo se reenvían los últimos N turnos al backend (el servidor no persiste el chat).
const MAX_TURNOS_CONTEXTO = 12;

export function useChefChat() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [mensajes, setMensajes] = useState<ChefMensaje[]>([SALUDO_INICIAL]);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || enviando) return;

      const nuevoUsuario: ChefMensaje = { rol: 'usuario', texto: limpio };
      const conUsuario = [...mensajes, nuevoUsuario];
      setMensajes(conUsuario);
      setEnviando(true);

      try {
        // Reenviar solo turnos reales (sin el saludo inicial sintético) y acotados.
        const contexto = conUsuario
          .filter((m, i) => !(i === 0 && m === SALUDO_INICIAL))
          .slice(-MAX_TURNOS_CONTEXTO);
        const res = await apiRequest<ChefChatResponse>('/chef/chat', {
          method: 'POST',
          json: { mensajes: contexto },
          timeoutMs: TIMEOUT.AI,
        });
        const respuesta =
          res.respuesta?.trim() ||
          res.mensaje ||
          'No he podido responder ahora mismo. Inténtalo de nuevo en un momento.';
        setMensajes((prev) => [
          ...prev,
          {
            rol: 'chef',
            texto: respuesta,
            platos: res.platos,
            consumos_aplicados: res.consumos_aplicados,
          },
        ]);
      } catch (err: any) {
        if (err.name === 'ApiError' && err.status === 402) {
          navigation.navigate('Paywall');
          // Retiramos el mensaje fallido del usuario de la lista visual
          setMensajes((prev) => prev.slice(0, prev.length - 1));
          return;
        }
        setMensajes((prev) => [
          ...prev,
          {
            rol: 'chef',
            texto: 'Uy, no he podido contestar ahora mismo. Inténtalo de nuevo en un momento.',
          },
        ]);
      } finally {
        setEnviando(false);
      }
    },
    [mensajes, enviando, navigation]
  );

  return { mensajes, enviando, enviar };
}
