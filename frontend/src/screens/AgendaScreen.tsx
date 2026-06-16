import React, { useState } from 'react';
import { View } from 'react-native';
import { colors, spacing, radius } from '../theme/tokens';
import { IconButton } from '../components/ui';
import TasksScreen from './TasksScreen';
import CalendarScreen from './CalendarScreen';

export default function AgendaScreen() {
  const [tab, setTab] = useState<'tareas' | 'calendario'>('tareas');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.card,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xxxl,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            backgroundColor: colors.bg,
            borderRadius: radius.md,
            padding: 4,
          }}
        >
          <IconButton
            name="checkbox"
            size={18}
            color={tab === 'tareas' ? colors.brand : colors.inkMuted}
            bg={tab === 'tareas' ? colors.card : 'transparent'}
            diameter={36}
            onPress={() => setTab('tareas')}
            accessibilityLabel="Tareas"
            style={{ flex: 1, borderRadius: radius.sm }}
          />
          <IconButton
            name="calendar"
            size={18}
            color={tab === 'calendario' ? colors.brand : colors.inkMuted}
            bg={tab === 'calendario' ? colors.card : 'transparent'}
            diameter={36}
            onPress={() => setTab('calendario')}
            accessibilityLabel="Calendario"
            style={{ flex: 1, borderRadius: radius.sm }}
          />
        </View>
      </View>
      <View style={{ flex: 1 }}>{tab === 'tareas' ? <TasksScreen /> : <CalendarScreen />}</View>
    </View>
  );
}
