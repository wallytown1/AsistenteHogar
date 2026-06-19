import React, { useState, useEffect, useCallback } from 'react';
import { View, Modal, Alert, Pressable } from 'react-native';
import { useAuthStore } from '../state/authStore';
import { usePantrySettingsStore, OPCIONES_UMBRAL } from '../state/pantrySettingsStore';
import { PerfilIndividual } from '../types/types';
import { apiRequest } from '../api/api';
import { colors, radius, spacing } from '../theme/tokens';
import { Screen, Card, Button, Field, AppText, Icon, Chip } from '../components/ui';
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

  const diasUmbral = usePantrySettingsStore((s) => s.diasUmbral);
  const setDiasUmbral = usePantrySettingsStore((s) => s.setDiasUmbral);

  // --- Perfiles individuales ---
  const [perfiles, setPerfiles] = useState<PerfilIndividual[]>([]);
  const [perfilModalVisible, setPerfilModalVisible] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState<PerfilIndividual | null>(null);
  const [perfilNombre, setPerfilNombre] = useState('');
  const [perfilDieta, setPerfilDieta] = useState('');
  const [perfilExcluir, setPerfilExcluir] = useState('');
  const [savingPerfil, setSavingPerfil] = useState(false);

  const cargarPerfiles = useCallback(async () => {
    try {
      const lista = await apiRequest<PerfilIndividual[]>('/perfiles');
      setPerfiles(lista);
    } catch {
      // silencioso — no bloqueamos la pantalla por esto
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lista = await apiRequest<PerfilIndividual[]>('/perfiles');
        if (!cancelled) setPerfiles(lista);
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const abrirNuevoPerfil = () => {
    setEditandoPerfil(null);
    setPerfilNombre('');
    setPerfilDieta('');
    setPerfilExcluir('');
    setPerfilModalVisible(true);
  };

  const abrirEditarPerfil = (p: PerfilIndividual) => {
    setEditandoPerfil(p);
    setPerfilNombre(p.nombre);
    setPerfilDieta(p.preferencias_dieta.join(', '));
    setPerfilExcluir(p.excluir_ingredientes.join(', '));
    setPerfilModalVisible(true);
  };

  const parseLista = (texto: string) =>
    texto
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const guardarPerfil = async () => {
    if (!perfilNombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del miembro es obligatorio.');
      return;
    }
    setSavingPerfil(true);
    try {
      const body = {
        nombre: perfilNombre.trim(),
        preferencias_dieta: parseLista(perfilDieta),
        excluir_ingredientes: parseLista(perfilExcluir),
      };
      if (editandoPerfil) {
        await apiRequest(`/perfiles/${editandoPerfil.id}`, { method: 'PATCH', json: body });
      } else {
        await apiRequest('/perfiles', { method: 'POST', json: body });
      }
      haptics.success();
      setPerfilModalVisible(false);
      cargarPerfiles();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el perfil.');
    } finally {
      setSavingPerfil(false);
    }
  };

  const eliminarPerfil = (p: PerfilIndividual) => {
    Alert.alert(
      'Eliminar miembro',
      `¿Eliminar el perfil de "${p.nombre}"? Sus preferencias ya no influirán en las recetas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/perfiles/${p.id}`, { method: 'DELETE' });
              haptics.light();
              cargarPerfiles();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar.');
            }
          },
        },
      ]
    );
  };

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

  const filas: { label: string; value: string; icon: React.ComponentProps<typeof Icon>['name'] }[] =
    [
      { label: 'Nombre', value: usuario?.nombre || '—', icon: 'person-outline' },
      { label: 'Email', value: usuario?.email || '—', icon: 'mail-outline' },
      { label: 'Hogar', value: hogar?.nombre || '—', icon: 'home-outline' },
    ];

  return (
    <Screen>
      <AppText variant="display" style={{ marginBottom: spacing.xl }}>
        Ajustes
      </AppText>

      {/* Tarjeta: Cuenta */}
      <Card style={{ marginBottom: spacing.lg }}>
        <AppText variant="h2" style={{ marginBottom: spacing.md }}>
          Cuenta
        </AppText>
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
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.pill,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={f.icon} size={17} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label" color={colors.inkFaint}>
                {f.label}
              </AppText>
              <AppText variant="body" numberOfLines={1}>
                {f.value}
              </AppText>
            </View>
          </View>
        ))}
      </Card>

      {/* Tarjeta: Sesión */}
      <Card style={{ marginBottom: spacing.lg }}>
        <AppText variant="h2" style={{ marginBottom: spacing.md }}>
          Sesión
        </AppText>
        <Button
          label="Cerrar sesión"
          icon="log-out-outline"
          variant="secondary"
          onPress={() => {
            haptics.light();
            logout();
          }}
        />
        <AppText variant="micro" color={colors.inkMuted} center style={{ marginTop: spacing.sm }}>
          Tus datos se conservan; podrás volver a entrar cuando quieras.
        </AppText>
      </Card>

      {/* Tarjeta: Despensa */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}
        >
          <Icon name="time-outline" size={18} color={colors.pantry} />
          <AppText variant="h2">Despensa</AppText>
        </View>
        <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.md }}>
          Mostrar «Consumir pronto» cuando quedan…
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {OPCIONES_UMBRAL.map((dias) => (
            <Chip
              key={dias}
              label={`${dias}d`}
              active={diasUmbral === dias}
              onPress={() => {
                haptics.selection();
                setDiasUmbral(dias);
              }}
              activeColor={colors.pantry}
              flex
            />
          ))}
        </View>
      </Card>

      {/* Tarjeta: Miembros del hogar */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="people-outline" size={18} color={colors.brand} />
            <AppText variant="h2">Miembros del hogar</AppText>
          </View>
          <Button
            label="Añadir"
            icon="add"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={abrirNuevoPerfil}
          />
        </View>
        <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.md }}>
          Las preferencias culinarias de cada miembro influyen en las recetas sugeridas por IA.
        </AppText>
        {perfiles.length === 0 ? (
          <AppText variant="caption" color={colors.inkFaint} center>
            Sin miembros configurados.
          </AppText>
        ) : (
          perfiles.map((p, i) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                }}
              >
                <Icon name="person-outline" size={17} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="captionStrong">{p.nombre}</AppText>
                {p.preferencias_dieta.length > 0 && (
                  <AppText variant="micro" color={colors.inkMuted}>
                    {p.preferencias_dieta.join(', ')}
                  </AppText>
                )}
                {p.excluir_ingredientes.length > 0 && (
                  <AppText variant="micro" color={colors.inkFaint}>
                    Evita: {p.excluir_ingredientes.join(', ')}
                  </AppText>
                )}
              </View>
              <Pressable
                onPress={() => abrirEditarPerfil(p)}
                hitSlop={14}
                style={{ marginRight: spacing.sm }}
                accessibilityLabel={`Editar ${p.nombre}`}
              >
                <Icon name="pencil-outline" size={16} color={colors.inkMuted} />
              </Pressable>
              <Pressable
                onPress={() => eliminarPerfil(p)}
                hitSlop={14}
                accessibilityLabel={`Eliminar ${p.nombre}`}
              >
                <Icon name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {/* Modal: añadir / editar miembro */}
      <Modal
        visible={perfilModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPerfilModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.xl,
              paddingBottom: spacing.xxxl,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.borderStrong,
                }}
              />
            </View>
            <AppText variant="h2" style={{ marginBottom: spacing.lg }}>
              {editandoPerfil ? 'Editar miembro' : 'Nuevo miembro'}
            </AppText>
            <Field
              label="Nombre o apodo *"
              placeholder="Ej: Mamá, El peque, Abuelo..."
              value={perfilNombre}
              onChangeText={setPerfilNombre}
              containerStyle={{ marginBottom: spacing.md }}
            />
            <Field
              label="Preferencias de dieta"
              placeholder="Ej: vegetariana, sin gluten preferido"
              value={perfilDieta}
              onChangeText={setPerfilDieta}
              containerStyle={{ marginBottom: spacing.md }}
            />
            <AppText
              variant="micro"
              color={colors.inkFaint}
              style={{ marginBottom: spacing.md, marginTop: -spacing.sm }}
            >
              Separa con comas. Solo preferencias culinarias — no uses este campo para alergias
              medicas.
            </AppText>
            <Field
              label="Ingredientes a evitar"
              placeholder="Ej: cilantro, picante, cebolla"
              value={perfilExcluir}
              onChangeText={setPerfilExcluir}
              containerStyle={{ marginBottom: spacing.lg }}
            />
            <Button
              label={savingPerfil ? 'Guardando...' : 'Guardar'}
              loading={savingPerfil}
              onPress={guardarPerfil}
              style={{ marginBottom: spacing.sm }}
            />
            <Button label="Cancelar" variant="ghost" onPress={() => setPerfilModalVisible(false)} />
          </View>
        </View>
      </Modal>

      {/* Tarjeta: Zona de peligro */}
      <Card borderColor={colors.dangerSoft} tint={colors.card}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}
        >
          <Icon name="warning-outline" size={18} color={colors.danger} />
          <AppText variant="h2" color={colors.danger}>
            Zona de peligro
          </AppText>
        </View>
        <AppText
          variant="caption"
          color={colors.inkMuted}
          style={{ lineHeight: 18, marginBottom: spacing.lg }}
        >
          Al eliminar la cuenta se destruyen de forma permanente el hogar y todos sus datos:
          usuarios, despensa e historial de recetas. Esta acción no se puede deshacer.
        </AppText>

        {!confirmando ? (
          <Button
            label="Eliminar cuenta permanentemente"
            variant="ghost"
            icon="trash-outline"
            onPress={() => {
              haptics.warning();
              setConfirmando(true);
            }}
            style={{ borderColor: colors.danger }}
          />
        ) : (
          <View
            style={{
              backgroundColor: colors.dangerSoft,
              borderWidth: 1,
              borderColor: colors.dangerSoft,
              borderRadius: radius.lg,
              padding: spacing.lg,
            }}
          >
            <AppText
              variant="captionStrong"
              color={colors.danger}
              style={{ marginBottom: spacing.md, lineHeight: 17 }}
            >
              Confirmación irreversible: introduce tu contraseña para eliminar definitivamente la
              cuenta y todos los datos del hogar.
            </AppText>
            <Field
              placeholder="Contraseña actual"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={(t: string) => {
                setPassword(t);
                setError(null);
              }}
              editable={!borrando}
              accessibilityLabel="Contraseña actual para confirmar la eliminación"
              inputStyle={{ backgroundColor: colors.white, borderColor: colors.danger }}
            />
            {error ? (
              <AppText variant="micro" color={colors.danger} style={{ marginBottom: spacing.sm }}>
                {error}
              </AppText>
            ) : null}
            <Button
              label="Confirmar eliminación definitiva"
              variant="danger"
              loading={borrando}
              disabled={!password}
              onPress={handleEliminarCuenta}
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={cancelarEliminacion}
              disabled={borrando}
            />
          </View>
        )}
      </Card>
    </Screen>
  );
}
