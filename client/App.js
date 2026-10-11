import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { Colors } from './src/theme/colors';

// Screens
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { UsernameSetupScreen } from './src/screens/auth/UsernameSetupScreen';
import { MainNavigationScreen } from './src/screens/MainNavigationScreen';
import { ChatConversationScreen } from './src/screens/ChatConversationScreen';

const RootContent = () => {
  const { themeMode, currentScreen } = useApp();
  const theme = Colors[themeMode];
  const insets = useSafeAreaInsets();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'signin':
        return <SignInScreen />;
      case 'register':
        return <RegisterScreen />;
      case 'username_setup':
        return <UsernameSetupScreen />;
      case 'main':
        return <MainNavigationScreen />;
      case 'conversation':
        return <ChatConversationScreen />;
      default:
        return <SignInScreen />;
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <StatusBar
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {renderScreen()}
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
