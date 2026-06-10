import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { ActivityIndicator, Text, View } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import PantryScreen from '../screens/PantryScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AuthScreen from '../screens/AuthScreen';
import { useAuthStore } from '../state/authStore';

type RootTabParamList = {
  Inicio: undefined;
  Despensa: undefined;
  Calendario: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Inicio: '🏠',
    Despensa: '🥫',
    Calendario: '📅',
  };
  return (
    <View className="items-center justify-center">
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{icons[label]}</Text>
    </View>
  );
}

export default function AppNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Restaurando la sesión persistida desde SecureStore
  if (!hydrated) {
    return (
      <View className="flex-1 bg-[#fafafa] justify-center items-center">
        <ActivityIndicator size="large" color="#000000" />
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
          backgroundColor: '#ffffff',
          borderTopColor: '#f1f5f9',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIcon: ({ focused }: { focused: boolean }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Despensa" component={PantryScreen} />
      <Tab.Screen name="Calendario" component={CalendarScreen} />
    </Tab.Navigator>
  );
}
