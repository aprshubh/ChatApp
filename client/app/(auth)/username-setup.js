import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { UserAvatar } from '../../src/components/UserAvatar';

export default function UsernameSetupPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { register } = useAuthStore();
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode] || Colors.dark;

  const initialName = params.name || 'User';
  const initialEmail = params.email || '';
  const initialPassword = params.password || '';

  const suggested = initialName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const [username, setUsername] = useState(suggested);
  const [bio, setBio] = useState('Available');
  const [avatarUri, setAvatarUri] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Allow photo library access to choose a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Avatar picker error:', e);
    }
  };

  const onFinish = async () => {
    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setError('');
    setIsLoading(true);

    const res = await register({
      name: initialName,
      email: initialEmail,
      password: initialPassword,
      username: cleanUsername,
      bio: bio.trim(),
      avatar: avatarUri,
    });

    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Failed to complete registration');
    } else {
      router.replace('/(tabs)/chats');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Avatar selector */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarButton}>
              <UserAvatar uri={avatarUri} name={initialName} size={76} />
              <View style={[styles.avatarBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Complete Profile</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Step 2 of 2: Pick your unique username and bio
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted, borderColor: theme.danger }]}>
              <Feather name="alert-circle" size={16} color={theme.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'username' ? theme.primary : theme.border,
                },
              ]}
            >
              <Text style={[styles.prefix, { color: theme.textSecondary }]}>@</Text>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="yourname"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
                autoCapitalize="none"
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Status / Bio</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'bio' ? theme.primary : theme.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Available"
                placeholderTextColor={theme.textMuted}
                value={bio}
                onChangeText={setBio}
                maxLength={80}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Complete Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={onFinish}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Finish & Start Chatting</Text>
            )}
          </TouchableOpacity>

          {/* Back button */}
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.backText, { color: theme.textSecondary }]}>Back to details</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
  },
  avatarRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    height: 48,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
