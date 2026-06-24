import React, { useRef } from 'react';
import { Alert, View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { RechazarIngredienteResponse, RecetaSugerida, Valoracion } from '../types/types';
import { useRecetaHistorial } from '../hooks/useRecetaHistorial';
import { usePerfiles } from '../hooks/usePerfiles';
import { apiRequest } from '../api/api';
import { colors, spacing, radius } from '../theme/tokens';
import {
  Card,
  Button,
  IconButton,
  AppText,
  SectionHeader,
  ShareRecipeCard,
} from '../components/ui';
import { haptics } from '../lib/haptics';
import { compartirRecetaImagen, compartirRecetaTexto } from '../lib/share';

type NavProp = NativeStackNavigationProp<any>;

export default function RecipeDetailScreen() {
  const route =
    useRoute<RouteProp<{ RecetaDetalle: { receta: RecetaSugerida } }, 'RecetaDetalle'>>();
  const navigation = useNavigation<NavProp>();
  const { receta } = route.params;
  const { registrarAccion, isLoading } = useRecetaHistorial();
  const { perfiles } = usePerfiles();
  const shotRef = useRef<ViewShot>(null);

  const handleCompartir = async () => {
    haptics.light();
    try {
      if (shotRef.current) {
        const uri = await (shotRef.current as any).capture();
        await compartirRecetaImagen(uri);
      } else {
        await compartirRecetaTexto(receta.titulo, receta.ingredientes_usados, receta.tiempo_min);
      }
    } catch {
      // Fallback silencioso a texto si la captura falla
      try {
        await compartirRecetaTexto(receta.titulo, receta.ingredientes_usados, receta.tiempo_min);
      } catch {
        /* el usuario canceló */
      }
    }
  };

  const guardarCocinada = async (valoracion: Valoracion) => {
    await registrarAccion(receta.titulo, 'cocinada', valoracion);
    // Al máximo nivel de satisfacción, ofrecemos compartir antes de salir
    if (valoracion === 'me_encanto') {
      await handleCompartir();
    }
    navigation.goBack();
  };

  const handleCocinada = () => {
    haptics.success();
    // Capturamos la valoración en el momento natural: alimenta la memoria de gustos
    // para que el chef te conozca mejor con el uso.
    Alert.alert('¿Qué te ha parecido?', 'Tu opinión ayuda a Marce a conocerte mejor.', [
      { text: '¡Me encantó!', onPress: () => guardarCocinada('me_encanto') },
      { text: 'Estuvo bien', onPress: () => guardarCocinada('gusto') },
      { text: 'No tanto', onPress: () => guardarCocinada('no_me_gusto') },
    ]);
  };

  const enviarRechazo = async (perfilId: string) => {
    try {
      const res = await apiRequest<RechazarIngredienteResponse>(
        '/pantry/recetas/rechazar-ingrediente',
        {
          method: 'POST',
          json: {
            nombre_receta: receta.titulo,
            ingredientes_receta: receta.ingredientes_usados,
            perfil_id: perfilId,
          },
        }
      );
      if (res.ingredientes_anadidos.length > 0) {
        const lista = res.ingredientes_anadidos.join(', ');
        Alert.alert('Preferencia guardada', `Evitaré "${lista}" para ${res.nombre_perfil}.`, [
          {
            text: 'Deshacer',
            onPress: async () => {
              const revertida = res.excluir_ingredientes_actualizado.filter(
                (i) => !res.ingredientes_anadidos.includes(i)
              );
              try {
                await apiRequest(`/perfiles/${perfilId}`, {
                  method: 'PATCH',
                  json: { excluir_ingredientes: revertida },
                });
              } catch {
                /* silent — el undo falla silenciosamente */
              }
              navigation.goBack();
            },
          },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    } catch {
      /* silent — el rechazo de ingrediente es best-effort */
    }
    navigation.goBack();
  };

  const handleRechazada = async () => {
    haptics.light();
    await registrarAccion(receta.titulo, 'rechazada');
    if (perfiles.length === 0) {
      navigation.goBack();
      return;
    }
    if (perfiles.length === 1) {
      await enviarRechazo(perfiles[0].id);
      return;
    }
    Alert.alert('¿Para quién no gusta?', 'Apuntaré el ingrediente problemático en su perfil.', [
      ...perfiles.map((p) => ({ text: p.nombre, onPress: () => enviarRechazo(p.id) })),
      { text: 'Nadie en concreto', style: 'cancel' as const, onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <AppText variant="h2" style={styles.headerTitle} numberOfLines={2}>
          {receta.titulo}
        </AppText>
        <IconButton name="share-social-outline" onPress={handleCompartir} />
      </View>

      {/* Tarjeta capturada para compartir en TikTok/Instagram — renderizada fuera de pantalla */}
      <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.offscreen}>
        <ShareRecipeCard
          titulo={receta.titulo}
          ingredientes={receta.ingredientes_usados}
          tiempoMin={receta.tiempo_min}
        />
      </ViewShot>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={14} color={colors.brand} />
            <AppText variant="captionStrong" color={colors.brand} style={styles.badgeText}>
              {receta.tiempo_min} min
            </AppText>
          </View>
          <View style={[styles.badge, { marginLeft: spacing.sm }]}>
            <Ionicons name="leaf-outline" size={14} color={colors.success} />
            <AppText variant="captionStrong" color={colors.success} style={styles.badgeText}>
              {receta.ingredientes_usados.length} ingredientes
            </AppText>
          </View>
        </View>

        <SectionHeader title="Ingredientes" style={{ marginTop: spacing.lg }} />
        <Card>
          {receta.ingredientes_usados.map((ing, idx) => (
            <View key={idx} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="body" style={styles.rowText}>
                {ing}
              </AppText>
            </View>
          ))}
        </Card>

        <SectionHeader title="Preparación" style={{ marginTop: spacing.lg }} />
        <Card>
          {receta.pasos.map((paso, idx) => (
            <View key={idx} style={[styles.row, styles.rowTop, idx > 0 && styles.rowBorder]}>
              <View style={styles.stepBubble}>
                <AppText variant="label" color={colors.onBrand}>
                  {idx + 1}
                </AppText>
              </View>
              <AppText variant="body" style={[styles.rowText, { flex: 1 }]}>
                {paso}
              </AppText>
            </View>
          ))}
        </Card>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Marcar como cocinada"
          icon="checkmark-circle-outline"
          variant="primary"
          loading={isLoading(receta.titulo, 'cocinada')}
          onPress={handleCocinada}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label="No me gusta"
            icon="close-circle-outline"
            variant="ghost"
            loading={isLoading(receta.titulo, 'rechazada')}
            onPress={handleRechazada}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowTop: {
    alignItems: 'flex-start',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  stepBubble: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0,
  },
});
