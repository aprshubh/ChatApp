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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';

export const UsernameSetupScreen = () => {
  const { themeMode, registerCache, handleCompleteUsername, setCurrentScreen } = useApp();
  const theme = Colors[themeMode];

  const suggested = registerCache.name
    ? registerCache.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'alex_hunter';

  const [username, setUsername] = useState(suggested);
  const [bio, setBio] = useState('Available');
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // Smooth entrance
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

  const [isLoading, setIsLoading] = useState(false);

  const onFinish = async () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    setError('');
    setIsLoading(true);
    const res = await handleCompleteUsername({
      username: clean,
      bio: bio.trim(),
    });
    setIsLoading(false);
    if (res && !res.success) {
      setError(res.error || 'Failed to complete registration. Try a different username.');
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
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
            onPress={() => setCurrentScreen('register')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={17} color={theme.text} />
          </TouchableOpacity>

          <View style={[styles.brandIcon, { backgroundColor: theme.primaryMuted, borderColor: theme.border }]}>
            <Feather name="at-sign" size={24} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Choose a username</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your username is how friends and team members can find and mention you.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.danger + '12', borderColor: theme.danger + '30' }]}>
              <Feather name="alert-circle" size={15} color={theme.danger} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Username</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'username' ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <Text style={[styles.atPrefix, { color: theme.primary }]}>@</Text>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="username"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username.replace(/^@/, '')}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => {
                  setUsername(t);
                  setError('');
                }}
              />
            </View>
            <Text style={[styles.helperText, { color: theme.textMuted }]}>
              Letters, numbers, and underscores only.
            </Text>
          </View>

          {/* Bio Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Bio (Optional)</Text>
            <View
              style={[
                styles.inputWrapperMultiline,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'bio' ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.inputMultiline, { color: theme.text }]}
                placeholder="A short description about yourself"
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                value={bio}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => setFocusedField(null)}
                onChangeText={setBio}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Complete Setup</Text>
            <Feather name="check" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 24,
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
  atPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
  },
  helperText: {
    fontSize: 12,
    marginTop: 5,
    marginLeft: 2,
  },
  inputWrapperMultiline: {
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 12,
    minHeight: 74,
  },
  inputMultiline: {
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
