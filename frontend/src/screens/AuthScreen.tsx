import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { apiRequest } from '../api/api';
import { useAuthStore } from '../state/authStore';
import { TokenResponse } from '../types/types';

type Modo = 'login' | 'registro';

export default function AuthScreen() {
  const setSession = useAuthStore((s) => s.setSession);

  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nombreHogar, setNombreHogar] = useState('');
  const [enviando, setEnviando] = useState(false);

  const esRegistro = modo === 'registro';

  const validar = (): string | null => {
    if (!email.trim().includes('@')) return 'Introduce un email válido.';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (esRegistro && nombre.trim().length < 2) return 'Introduce tu nombre (mínimo 2 caracteres).';
    if (esRegistro && nombreHogar.trim().length < 2) return 'Introduce el nombre del hogar (mínimo 2 caracteres).';
    return null;
  };

  const handleSubmit = async () => {
    const errorValidacion = validar();
    if (errorValidacion) {
      Alert.alert('Datos incompletos', errorValidacion);
      return;
    }

    setEnviando(true);
    try {
      const session = esRegistro
        ? await apiRequest<TokenResponse>('/auth/registro', {
            method: 'POST',
            json: {
              nombre_hogar: nombreHogar.trim(),
              nombre: nombre.trim(),
              email: email.trim().toLowerCase(),
              password,
            },
          })
        : await apiRequest<TokenResponse>('/auth/login', {
            method: 'POST',
            json: { email: email.trim().toLowerCase(), password },
          });
      await setSession(session);
    } catch (err: any) {
      Alert.alert(
        esRegistro ? 'No se pudo crear el hogar' : 'No se pudo iniciar sesión',
        err.message || 'Error desconocido de red.'
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#fafafa]"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-12">
          {/* Cabecera de marca */}
          <View className="items-center mb-10">
            <View className="bg-black rounded-full p-4 mb-4">
              <Text className="text-white text-3xl">🏠</Text>
            </View>
            <Text className="text-black text-2xl font-bold">Asistente del Hogar</Text>
            <Text className="text-gray-400 text-sm mt-1">
              {esRegistro ? 'Crea tu hogar y empieza a organizarlo' : 'Inicia sesión en tu hogar'}
            </Text>
          </View>

          {/* Selector login / registro */}
          <View className="flex-row bg-gray-100 rounded-full p-1 mb-8">
            <TouchableOpacity
              className={`flex-1 rounded-full py-2.5 items-center ${modo === 'login' ? 'bg-black' : ''}`}
              onPress={() => setModo('login')}
              accessibilityLabel="Cambiar a inicio de sesión"
            >
              <Text className={`text-sm font-bold ${modo === 'login' ? 'text-white' : 'text-gray-500'}`}>
                Iniciar sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-full py-2.5 items-center ${esRegistro ? 'bg-black' : ''}`}
              onPress={() => setModo('registro')}
              accessibilityLabel="Cambiar a registro de hogar"
            >
              <Text className={`text-sm font-bold ${esRegistro ? 'text-white' : 'text-gray-500'}`}>
                Crear hogar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulario */}
          {esRegistro && (
            <>
              <Text className="text-gray-500 text-xs font-semibold mb-1.5 ml-1">NOMBRE DEL HOGAR</Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-black text-sm mb-4"
                placeholder="Ej: Familia Navarro"
                placeholderTextColor="#9ca3af"
                value={nombreHogar}
                onChangeText={setNombreHogar}
                autoCapitalize="words"
                editable={!enviando}
              />
              <Text className="text-gray-500 text-xs font-semibold mb-1.5 ml-1">TU NOMBRE</Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-black text-sm mb-4"
                placeholder="Ej: María"
                placeholderTextColor="#9ca3af"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                editable={!enviando}
              />
            </>
          )}

          <Text className="text-gray-500 text-xs font-semibold mb-1.5 ml-1">EMAIL</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-black text-sm mb-4"
            placeholder="tu@email.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!enviando}
          />

          <Text className="text-gray-500 text-xs font-semibold mb-1.5 ml-1">CONTRASEÑA</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-black text-sm mb-8"
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!enviando}
          />

          <TouchableOpacity
            className={`rounded-full py-4 items-center ${enviando ? 'bg-gray-300' : 'bg-black'}`}
            onPress={handleSubmit}
            disabled={enviando}
            accessibilityLabel={esRegistro ? 'Crear hogar y cuenta' : 'Iniciar sesión'}
          >
            {enviando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-base font-bold">
                {esRegistro ? 'Crear hogar' : 'Entrar'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
