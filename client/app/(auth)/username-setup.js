import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Legacy route kept for old deep links. The canonical onboarding flow is
// register -> verify-otp -> profile-setup; passwords must never travel in URLs.
export default function UsernameSetupPage() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/(auth)/profile-setup',
      params: {
        name: typeof params.name === 'string' ? params.name : 'User',
        email: typeof params.email === 'string' ? params.email : '',
      },
    });
  }, [router, params.name, params.email]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
