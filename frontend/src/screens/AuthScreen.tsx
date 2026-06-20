import React, { useState } from 'react';
import { View, KeyboardAvoidingView, ScrollView, Platform, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../api/api';
import { useAuthStore } from '../state/authStore';
import { TokenResponse } from '../types/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Button, Field, Icon } from '../components/ui';
import { haptics } from '../lib/haptics';

type Modo = 'login' | 'registro';

export default function AuthScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const insets = useSafeAreaInsets();

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
    if (esRegistro && nombreHogar.trim().length < 2)
      return 'Introduce el nombre del hogar (mínimo 2 caracteres).';
    return null;
  };

  const handleSubmit = async () => {
    const errorValidacion = validar();
    if (errorValidacion) {
      haptics.warning();
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
      haptics.success();
      await setSession(session);
    } catch (err: any) {
      haptics.error();
      Alert.alert(
        esRegistro ? 'No se pudo crear el hogar' : 'No se pudo iniciar sesión',
        err.message || 'Error desconocido de red.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const seleccionarModo = (m: Modo) => {
    haptics.selection();
    setModo(m);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.xxxl,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera de marca */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.xl,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Icon name="home" size={34} color={colors.white} />
          </View>
          <AppText variant="title">Fogón</AppText>
          <AppText variant="caption" color={colors.inkMuted} center style={{ marginTop: 4 }}>
            {esRegistro ? 'Crea tu hogar y empieza a organizarlo' : 'Inicia sesión en tu hogar'}
          </AppText>
        </View>

        {/* Selector login / registro */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.track,
            borderRadius: radius.pill,
            padding: 4,
            marginBottom: spacing.xxl,
          }}
        >
          {(['login', 'registro'] as Modo[]).map((m) => {
            const activo = modo === m;
            return (
              <Pressable
                key={m}
                onPress={() => seleccionarModo(m)}
                accessibilityLabel={
                  m === 'login' ? 'Cambiar a inicio de sesión' : 'Cambiar a registro de hogar'
                }
                style={{
                  flex: 1,
                  borderRadius: radius.pill,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: activo ? colors.card : 'transparent',
                }}
              >
                <AppText variant="captionStrong" color={activo ? colors.ink : colors.inkMuted}>
                  {m === 'login' ? 'Iniciar sesión' : 'Crear hogar'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Formulario */}
        {esRegistro && (
          <>
            <Field
              label="Nombre del hogar"
              placeholder="Ej: Familia Navarro"
              value={nombreHogar}
              onChangeText={setNombreHogar}
              autoCapitalize="words"
              editable={!enviando}
            />
            <Field
              label="Tu nombre"
              placeholder="Ej: María"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              editable={!enviando}
            />
          </>
        )}

        <Field
          label="Email"
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!enviando}
        />

        <Field
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!enviando}
          containerStyle={{ marginBottom: spacing.xxl }}
        />

        <Button
          label={esRegistro ? 'Crear hogar' : 'Entrar'}
          icon={esRegistro ? 'add-circle-outline' : 'log-in-outline'}
          size="lg"
          loading={enviando}
          onPress={handleSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
