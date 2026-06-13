import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../state/authStore';

/**
 * Pantalla de ajustes: datos de la cuenta, cierre de sesión y zona de peligro
 * con la eliminación definitiva de la cuenta (RGPD art. 17 + requisito de
 * App Store 5.1.1(v) y Google Play de poder borrar la cuenta desde la app).
 *
 * La confirmación es inline en dos pasos (no Alert nativo) para que funcione
 * igual en iOS, Android y web, y porque el backend exige re-autenticar con la
 * contraseña: el campo tiene que estar en pantalla de todos modos.
 */
export default function SettingsScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const hogar = useAuthStore((s) => s.hogar);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const [confirmando, setConfirmando] = useState(false);
  const [password, setPassword] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelarEliminacion = () => {
    setConfirmando(false);
    setPassword('');
    setError(null);
  };

  const handleEliminarCuenta = async () => {
    if (!password || borrando) return;
    setBorrando(true);
    setError(null);
    try {
      await deleteAccount(password);
      // Éxito: el store queda vacío y AppNavigator navega solo al Login.
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      setBorrando(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#fafafa]" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="px-5 pt-14 pb-6">

        {/* Cabecera */}
        <Text className="text-black text-2xl font-bold mb-6">Ajustes</Text>

        {/* Tarjeta: Cuenta */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
          <Text className="text-black text-sm font-bold mb-3">Cuenta</Text>
          <View className="mb-2">
            <Text className="text-gray-400 text-[10px] font-semibold">Nombre</Text>
            <Text className="text-black text-xs font-medium">{usuario?.nombre || '—'}</Text>
          </View>
          <View className="mb-2">
            <Text className="text-gray-400 text-[10px] font-semibold">Email</Text>
            <Text className="text-black text-xs font-medium">{usuario?.email || '—'}</Text>
          </View>
          <View>
            <Text className="text-gray-400 text-[10px] font-semibold">Hogar</Text>
            <Text className="text-black text-xs font-medium">{hogar?.nombre || '—'}</Text>
          </View>
        </View>

        {/* Tarjeta: Sesión */}
        <View className="bg-white border border-gray-100 rounded-3xl p-5 mb-4 shadow-sm">
          <Text className="text-black text-sm font-bold mb-3">Sesión</Text>
          <TouchableOpacity
            className="bg-gray-100 rounded-full py-3 items-center"
            onPress={() => { logout(); }}
            accessibilityLabel="Cerrar sesión en este dispositivo"
          >
            <Text className="text-black text-xs font-bold">Cerrar sesión</Text>
          </TouchableOpacity>
          <Text className="text-gray-400 text-[10px] mt-2 text-center">
            Tus datos se conservan; podrás volver a entrar cuando quieras.
          </Text>
        </View>

        {/* Tarjeta: Zona de peligro */}
        <View className="bg-white border border-red-200 rounded-3xl p-5 shadow-sm">
          <Text className="text-red-600 text-sm font-bold mb-2">Zona de peligro</Text>
          <Text className="text-gray-500 text-[11px] leading-4 mb-4">
            Al eliminar la cuenta se destruyen de forma permanente el hogar y todos sus
            datos: usuarios, despensa, tareas y calendario. Esta acción no se puede deshacer.
          </Text>

          {!confirmando ? (
            <TouchableOpacity
              className="border border-red-300 rounded-full py-3 items-center"
              onPress={() => setConfirmando(true)}
              accessibilityLabel="Eliminar cuenta permanentemente"
            >
              <Text className="text-red-600 text-xs font-bold">Eliminar cuenta permanentemente</Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <Text className="text-red-700 text-[11px] font-bold mb-3">
                ⚠️ Confirmación irreversible: introduce tu contraseña para eliminar
                definitivamente la cuenta y todos los datos del hogar.
              </Text>
              <TextInput
                className="bg-white border border-red-200 rounded-xl px-4 py-3 text-xs text-black mb-3"
                placeholder="Contraseña actual"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={(t: string) => { setPassword(t); setError(null); }}
                editable={!borrando}
                accessibilityLabel="Contraseña actual para confirmar la eliminación"
              />
              {error && (
                <Text className="text-red-600 text-[10px] font-semibold mb-3">{error}</Text>
              )}
              <TouchableOpacity
                className={`rounded-full py-3 items-center mb-2 ${password && !borrando ? 'bg-red-600' : 'bg-red-300'}`}
                onPress={handleEliminarCuenta}
                disabled={!password || borrando}
                accessibilityLabel="Confirmar eliminación definitiva de la cuenta"
              >
                {borrando ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white text-xs font-bold">Confirmar eliminación definitiva</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full py-3 items-center"
                onPress={cancelarEliminacion}
                disabled={borrando}
                accessibilityLabel="Cancelar la eliminación de la cuenta"
              >
                <Text className="text-gray-500 text-xs font-bold">Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </ScrollView>
  );
}
