import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import PantryScreen from '../screens/PantryScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TasksScreen from '../screens/TasksScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import { useAuthStore } from '../state/authStore';
import { colors } from '../theme/tokens';

type RootTabParamList = {
  Inicio: undefined;
  Despensa: undefined;
  Calendario: undefined;
  Tareas: undefined;
  Ajustes: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Par de iconos (relleno cuando está activo, contorno cuando no) por pestaña.
const ICONS: Record<keyof RootTabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Inicio: { on: 'home', off: 'home-outline' },
  Despensa: { on: 'basket', off: 'basket-outline' },
  Calendario: { on: 'calendar', off: 'calendar-outline' },
  Tareas: { on: 'checkbox', off: 'checkbox-outline' },
  Ajustes: { on: 'settings', off: 'settings-outline' },
};

export default function AppNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Restaurando la sesión persistida desde SecureStore
  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // Sin sesión: pantalla de acceso (login / crear hogar)
  if (!token) {
    return <AuthScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: RouteProp<RootTabParamList> }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
          <Ionicons name={focused ? ICONS[route.name].on : ICONS[route.name].off} size={23} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Despensa" component={PantryScreen} />
      <Tab.Screen name="Calendario" component={CalendarScreen} />
      <Tab.Screen name="Tareas" component={TasksScreen} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
