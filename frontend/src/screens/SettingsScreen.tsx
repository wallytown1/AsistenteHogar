import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../state/authStore';
import { colors, radius, spacing } from '../theme/tokens';
import {
  Screen,
  Card,
  Button,
  Field,
  AppText,
  Icon,
} from '../components/ui';
import { haptics } from '../lib/haptics';

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
      haptics.success();
      // Éxito: el store queda vacío y AppNavigator navega solo al Login.
    } catch (err: any) {
      haptics.error();
      setError(err.message || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      setBorrando(false);
    }
  };

  const filas: { label: string; value: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
    { label: 'Nombre', value: usuario?.nombre || '—', icon: 'person-outline' },
    { label: 'Email', value: usuario?.email || '—', icon: 'mail-outline' },
    { label: 'Hogar', value: hogar?.nombre || '—', icon: 'home-outline' },
  ];

  return (
    <Screen>
      <AppText variant="display" style={{ marginBottom: spacing.xl }}>Ajustes</AppText>

      {/* Tarjeta: Cuenta */}
      <Card style={{ marginBottom: spacing.lg }}>
        <AppText variant="h2" style={{ marginBottom: spacing.md }}>Cuenta</AppText>
        {filas.map((f, i) => (
          <View
            key={f.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={f.icon} size={17} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label" color={colors.inkFaint}>{f.label}</AppText>
              <AppText variant="body" numberOfLines={1}>{f.value}</AppText>
            </View>
          </View>
        ))}
      </Card>

      {/* Tarjeta: Sesión */}
      <Card style={{ marginBottom: spacing.lg }}>
        <AppText variant="h2" style={{ marginBottom: spacing.md }}>Sesión</AppText>
        <Button label="Cerrar sesión" icon="log-out-outline" variant="secondary" onPress={() => { haptics.light(); logout(); }} />
        <AppText variant="micro" color={colors.inkMuted} center style={{ marginTop: spacing.sm }}>
          Tus datos se conservan; podrás volver a entrar cuando quieras.
        </AppText>
      </Card>

      {/* Tarjeta: Zona de peligro */}
      <Card borderColor={colors.dangerSoft} tint={colors.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
          <Icon name="warning-outline" size={18} color={colors.danger} />
          <AppText variant="h2" color={colors.danger}>Zona de peligro</AppText>
        </View>
        <AppText variant="caption" color={colors.inkMuted} style={{ lineHeight: 18, marginBottom: spacing.lg }}>
          Al eliminar la cuenta se destruyen de forma permanente el hogar y todos sus datos:
          usuarios, despensa, tareas y calendario. Esta acción no se puede deshacer.
        </AppText>

        {!confirmando ? (
          <Button
            label="Eliminar cuenta permanentemente"
            variant="ghost"
            icon="trash-outline"
            onPress={() => { haptics.warning(); setConfirmando(true); }}
            style={{ borderColor: colors.danger }}
          />
        ) : (
          <View style={{ backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerSoft, borderRadius: radius.lg, padding: spacing.lg }}>
            <AppText variant="captionStrong" color={colors.danger} style={{ marginBottom: spacing.md, lineHeight: 17 }}>
              Confirmación irreversible: introduce tu contraseña para eliminar definitivamente la cuenta y todos los datos del hogar.
            </AppText>
            <Field
              placeholder="Contraseña actual"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={(t: string) => { setPassword(t); setError(null); }}
              editable={!borrando}
              accessibilityLabel="Contraseña actual para confirmar la eliminación"
              inputStyle={{ backgroundColor: colors.white, borderColor: '#F3C8C8' }}
            />
            {error ? <AppText variant="micro" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</AppText> : null}
            <Button
              label="Confirmar eliminación definitiva"
              variant="danger"
              loading={borrando}
              disabled={!password}
              onPress={handleEliminarCuenta}
              style={{ marginBottom: spacing.sm }}
            />
            <Button label="Cancelar" variant="ghost" onPress={cancelarEliminacion} disabled={borrando} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
