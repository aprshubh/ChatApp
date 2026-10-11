import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { ChatsTab } from './tabs/ChatsTab';
import { StatusTab } from './tabs/StatusTab';
import { CallsTab } from './tabs/CallsTab';
import { SettingsTab } from './tabs/SettingsTab';

export const MainNavigationScreen = () => {
  const { themeMode, activeTab, setActiveTab } = useApp();
  const theme = Colors[themeMode];
  const insets = useSafeAreaInsets();

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'chats':
        return <ChatsTab />;
      case 'status':
        return <StatusTab />;
      case 'calls':
        return <CallsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ChatsTab />;
    }
  };

  const navItems = [
    { key: 'chats', label: 'Chats', icon: 'message-circle' },
    { key: 'status', label: 'Status', icon: 'compass' },
    { key: 'calls', label: 'Calls', icon: 'phone' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const activeColor = theme.primaryAccent || '#3B82F6';
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 6);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Content Area */}
      <View style={styles.content}>{renderActiveScreen()}</View>

      {/* Solid Static Bottom Bar (Zero JS Animations = Zero Glitches) */}
      <View
        style={[
          styles.footerWrapper,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <View style={styles.bottomBar}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                onPress={() => setActiveTab(item.key)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBox,
                    isActive && {
                      backgroundColor: theme.primaryMuted || '#F4F4F5',
                    },
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={20}
                    color={isActive ? activeColor : theme.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.navLabel,
                    {
                      color: isActive ? activeColor : theme.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  footerWrapper: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    backgroundColor: '#FFFFFF',
  },
  bottomBar: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 52,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  iconBox: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
