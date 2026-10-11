import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/authStore';
import { useUIStore } from '../src/stores/uiStore';
import { sqliteService } from '../src/database/sqliteService';
import { Colors } from '../src/theme/colors';

// Create a single TanStack QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NavigationProtector({ children }) {
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();
  const { initTheme, themeMode } = useUIStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize SQLite, Auth, and Theme on application mount
  useEffect(() => {
    async function setupApp() {
      await sqliteService.init();
      await initTheme();
      await initAuth();
    }
    setupApp();
  }, []);

  // Protected route enforcement
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isProfileSetup = inAuthGroup && segments[1] === 'profile-setup';

    if (!isAuthenticated && !inAuthGroup) {
      // User is not logged in and trying to access protected screen -> Redirect to signin
      router.replace('/(auth)/signin');
    } else if (isAuthenticated && inAuthGroup && !isProfileSetup) {
      // User is already logged in and on an auth screen (except profile setup) -> Redirect to main chats
      router.replace('/(tabs)/chats');
    }
  }, [isAuthenticated, isLoading, segments]);

  const theme = Colors[themeMode] || Colors.dark;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} translucent />
      {children}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationProtector>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal/new-chat"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
        </NavigationProtector>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
