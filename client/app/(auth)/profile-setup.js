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

export default function ProfileSetupPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, updateUserProfile, initAuth } = useAuthStore();
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode] || Colors.dark;

  const initialName = params.name || user?.display_name || user?.name || 'User';
  const defaultUsername = user?.username || initialName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const [username, setUsername] = useState(defaultUsername);
  const [bio, setBio] = useState('Hey there! I am using ChatApp.');
  const [avatarUri, setAvatarUri] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  // Email verification happens immediately before this screen. Re-hydrate
  // the session here so the verified account becomes authenticated.
  useEffect(() => {
    initAuth();
  }, [initAuth]);

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

  const handleSaveAndContinue = async () => {
    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await updateUserProfile({
        username: cleanUsername,
        name: initialName,
        bio: bio.trim(),
        avatar: avatarUri,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }

      // Profile is saved successfully; only then open the inbox.
      router.replace('/(tabs)/chats');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Skip feature: skips custom avatar & bio, uses defaults
  const handleSkip = async () => {
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await updateUserProfile({
        username: username.trim().replace(/^@/, ''),
        name: initialName,
        bio: 'Hey there! I am using ChatApp.',
      });
      if (!result.success) {
        setError(result.error || 'Failed to save profile');
        return;
      }
      router.replace('/(tabs)/chats');
    } catch (e) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
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
          {/* Header with Skip Pill Button */}
          <View style={styles.topHeaderBar}>
            <View />
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={[styles.skipBtnText, { color: theme.primary }]}>Skip for now</Text>
              <Feather name="chevron-right" size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>

          {/* Avatar selector */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarButton}>
              <UserAvatar uri={avatarUri} name={initialName} size={88} />
              <View style={[styles.avatarBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                <Feather name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
              Tap to add profile picture
            </Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Profile Setup</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Set your username, photo and bio so friends can recognize you
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted, borderColor: theme.danger }]}>
              <Feather name="alert-circle" size={16} color={theme.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Choose Username</Text>
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
                placeholder="username"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
                maxLength={30}
                autoCapitalize="none"
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>About / Status (Optional)</Text>
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
                placeholder="Hey there! I am using ChatApp."
                placeholderTextColor={theme.textMuted}
                value={bio}
                onChangeText={setBio}
                maxLength={80}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleSaveAndContinue}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Finish & Start Chatting</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Skip Footer Button */}
          <TouchableOpacity onPress={handleSkip} style={styles.bottomSkipRow}>
            <Text style={[styles.bottomSkipText, { color: theme.textSecondary }]}>
              I'll set up profile picture later
            </Text>
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
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  avatarRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12.5,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  bottomSkipRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  bottomSkipText: {
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
});
