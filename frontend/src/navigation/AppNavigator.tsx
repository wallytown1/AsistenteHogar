import React, { useEffect, useState } from 'react';
import {
  createBottomTabNavigator,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import PantryScreen from '../screens/PantryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen, { hasSeenOnboarding } from '../screens/OnboardingScreen';
import OnboardingProfileScreen from '../screens/OnboardingProfileScreen';
import PaywallScreen from '../screens/PaywallScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import { RecetaSugerida } from '../types/types';
import { useAuthStore } from '../state/authStore';
import { usePurchasesStore } from '../state/purchasesStore';
import { useOnboarding } from '../hooks/useOnboarding';
import { colors } from '../theme/tokens';

type RootTabParamList = {
  Inicio: undefined;
  Despensa: undefined;
  Ajustes: undefined;
};

type RootStackParamList = {
  MainTabs: undefined;
  Paywall: undefined;
  RecetaDetalle: { receta: RecetaSugerida };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<
  keyof RootTabParamList,
  { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }
> = {
  Inicio: { on: 'home', off: 'home-outline' },
  Despensa: { on: 'basket', off: 'basket-outline' },
  Ajustes: { on: 'settings', off: 'settings-outline' },
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }: {
        route: RouteProp<RootTabParamList>;
      }): BottomTabNavigationOptions => ({
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
          <Ionicons
            name={focused ? ICONS[route.name].on : ICONS[route.name].off}
            size={23}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Despensa" component={PantryScreen} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function CenteredLoader() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

/**
 * Capa post-autenticación. Solo se monta cuando hay sesión activa, de modo que el
 * gate de la encuesta de perfil (que consulta GET /onboarding con token) nunca
 * se ejecuta sin credenciales.
 */
function AuthedApp() {
  const { needsProfile, checked, savePerfil, skip } = useOnboarding();

  if (!checked) {
    return <CenteredLoader />;
  }

  if (needsProfile) {
    return <OnboardingProfileScreen onSave={savePerfil} onSkip={skip} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="RecetaDetalle"
        component={RecipeDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const configure = usePurchasesStore((s) => s.configure);
  const isConfigured = usePurchasesStore((s) => s.isConfigured);
  const logIn = usePurchasesStore((s) => s.logIn);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Inicializar RevenueCat globalmente
  useEffect(() => {
    configure();
  }, [configure]);

  // Si hay usuario logueado, sincronizarlo con RevenueCat SOLO DESPUÉS de configurar
  useEffect(() => {
    if (isConfigured && usuario) {
      logIn(usuario.id);
    }
  }, [isConfigured, usuario, logIn]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      setShowOnboarding(!seen);
      setOnboardingChecked(true);
    });
  }, []);

  if (!hydrated || !onboardingChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!token) {
    return <AuthScreen />;
  }

  return <AuthedApp />;
}
