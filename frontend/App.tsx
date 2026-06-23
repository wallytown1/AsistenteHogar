import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { queryClient } from './src/api/queryClient';
import { ToastProvider } from './src/components/ui/Toast';
import { requestNotificationPermissions } from './src/lib/notifications';

export default function App() {
  useEffect(() => {
    requestNotificationPermissions().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ToastProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor="#0f172a" />
            <AppNavigator />
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
