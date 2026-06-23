import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, TIMEOUT } from '../api/api';
import { ChefMensaje, ChefChatResponse, ConsumoAplicado } from '../types/types';
import { useToast } from '../components/ui/Toast';

const SALUDO_INICIAL: ChefMensaje = {
  rol: 'chef',
  texto:
    '¡Hola! Soy Marce, tu chef. ¿Qué te apetece cocinar hoy? Dime qué tienes o qué te apetece y te echo una mano.',
};

// Solo se reenvían los últimos N turnos al backend (el servidor no persiste el chat).
const MAX_TURNOS_CONTEXTO = 12;

export function useChefChat() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const queryClient = useQueryClient();
  const toast = useToast();
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
            consumos_detalle: res.consumos_detalle,
          },
        ]);
        if (res.consumos_aplicados?.length) {
          queryClient.invalidateQueries({ queryKey: ['pantry'] });
        }
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
    [mensajes, enviando, navigation, queryClient]
  );

  const deshacerConsumos = useCallback(
    async (detalle: ConsumoAplicado[]) => {
      try {
        await Promise.all(
          detalle.map((c) =>
            c.fue_agotado
              ? apiRequest(`/pantry/${c.item_id}/restaurar`, { method: 'POST' })
              : apiRequest(`/pantry/${c.item_id}`, {
                  method: 'PATCH',
                  json: { cantidad: c.cantidad_anterior },
                })
          )
        );
        queryClient.invalidateQueries({ queryKey: ['pantry'] });
        toast.show({ tipo: 'success', mensaje: 'Descuento de stock revertido' });
      } catch {
        toast.show({ tipo: 'error', mensaje: 'No se pudo deshacer el descuento' });
      }
    },
    [queryClient, toast]
  );

  return { mensajes, enviando, enviar, deshacerConsumos };
}
