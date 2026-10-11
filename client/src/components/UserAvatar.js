import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { useUIStore } from '../stores/uiStore';

export const UserAvatar = ({ uri, name, size = 50, isOnline = false, showBadge = true }) => {
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.inputBg,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: themeMode === 'dark' ? '#27272A' : '#F1F5F9',
            },
          ]}
        >
          <Text style={[styles.fallbackText, { color: theme.text, fontSize: size * 0.38 }]}>
            {name ? name[0].toUpperCase() : '?'}
          </Text>
        </View>
      )}

      {showBadge && isOnline && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: theme.accent,
              borderColor: theme.background,
              width: Math.max(12, size * 0.26),
              height: Math.max(12, size * 0.26),
              borderRadius: Math.max(12, size * 0.26) / 2,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2.2,
  },
});
