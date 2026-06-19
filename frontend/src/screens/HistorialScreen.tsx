import React, { useEffect, memo } from 'react';
import { FlatList, View } from 'react-native';
import { RecetaHistorial } from '../types/types';
import { useRecetaHistorial } from '../hooks/useRecetaHistorial';
import { colors, spacing, radius } from '../theme/tokens';
import { Screen, Card, AppText, EmptyState, LoadingView } from '../components/ui';

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const HistorialRow = memo(function HistorialRow({
  item,
  isFirst,
}: {
  item: RecetaHistorial;
  isFirst: boolean;
}) {
  const esCocinada = item.accion === 'cocinada';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: esCocinada ? colors.success : colors.inkFaint,
          flexShrink: 0,
          marginTop: 1,
        }}
      />
      <AppText variant="captionStrong" style={{ flex: 1 }} numberOfLines={2}>
        {item.nombre_receta}
      </AppText>
      <View
        style={{
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 3,
          borderRadius: radius.sm,
          backgroundColor: esCocinada ? colors.successSoft : colors.pantrySoft,
        }}
      >
        <AppText variant="micro" color={esCocinada ? colors.success : colors.pantry}>
          {esCocinada ? 'Cocinada' : 'Rechazada'}
        </AppText>
      </View>
      <AppText variant="micro" color={colors.inkFaint} style={{ minWidth: 58, textAlign: 'right' }}>
        {formatFecha(item.cocinada_en)}
      </AppText>
    </View>
  );
});

export default function HistorialScreen() {
  const { historial, loadingHistorial, fetchHistorial } = useRecetaHistorial();

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  if (loadingHistorial && historial.length === 0) {
    return <LoadingView />;
  }

  return (
    <Screen onRefresh={fetchHistorial} refreshing={loadingHistorial}>
      <AppText variant="display" style={{ marginBottom: spacing.sm }}>
        Historial
      </AppText>
      <AppText variant="caption" color={colors.inkMuted} style={{ marginBottom: spacing.xl }}>
        Recetas cocinadas y rechazadas. Se usan para mejorar las sugerencias de IA.
      </AppText>

      {historial.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="Sin historial aún"
          subtitle="Las recetas que marques como cocinadas o rechazadas aparecerán aquí."
        />
      ) : (
        <Card>
          <FlatList
            data={historial}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <HistorialRow item={item} isFirst={index === 0} />}
            scrollEnabled={false}
          />
        </Card>
      )}
    </Screen>
  );
}
