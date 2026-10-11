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

export const RegisterScreen = () => {
  const { themeMode, handleRegisterDetails, setCurrentScreen } = useApp();
  const theme = Colors[themeMode];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // Subtle smooth entrance animation
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

  const onContinue = () => {
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    handleRegisterDetails({
      name: name.trim(),
      email: email.trim(),
      password,
    });
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
          {/* Minimal professional brand header */}
          <View style={[styles.brandIcon, { backgroundColor: theme.primaryMuted, borderColor: theme.border }]}>
            <Feather name="message-square" size={24} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign up to connect with colleagues and teams
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.danger + '12', borderColor: theme.danger + '30' }]}>
              <Feather name="alert-circle" size={15} color={theme.danger} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'name' ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <Feather
                name="user"
                size={17}
                color={focusedField === 'name' ? theme.primary : theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="John Doe"
                placeholderTextColor={theme.textMuted}
                value={name}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => {
                  setName(t);
                  setError('');
                }}
              />
            </View>
          </View>

          {/* Email Address */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'email' ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <Feather
                name="mail"
                size={17}
                color={focusedField === 'email' ? theme.primary : theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="name@company.com"
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => {
                  setEmail(t);
                  setError('');
                }}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: focusedField === 'password' ? theme.primary : theme.inputBorder,
                },
              ]}
            >
              <Feather
                name="lock"
                size={17}
                color={focusedField === 'password' ? theme.primary : theme.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Minimum 6 characters"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => {
                  setPassword(t);
                  setError('');
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={16}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Create Account</Text>
            <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Direct Switch to Sign In */}
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => setCurrentScreen('signin')}>
              <Text style={[styles.switchLink, { color: theme.primary }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
