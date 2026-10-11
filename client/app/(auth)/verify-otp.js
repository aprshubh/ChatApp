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
import { Colors } from '../../src/theme/colors';
import { useUIStore } from '../../src/stores/uiStore';
import { authApi } from '../../src/services/apiService';

export default function VerifyOtpPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode] || Colors.dark;

  const email = params.email || 'your email';
  const name = params.name || 'User';

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

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

  // Countdown timer for resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    const cleanToken = otpCode.trim();
    if (!cleanToken) {
      setError('Please enter the verification code or token');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await authApi.verifyEmail(cleanToken);
      setIsLoading(false);

      // On successful verification, move to profile setup step
      router.replace({
        pathname: '/(auth)/profile-setup',
        params: {
          name,
          email,
        },
      });
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Invalid or expired verification code. Please try again.');
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      setSuccessMsg('');
      setError('');
      await authApi.resendVerification(email);
      setSuccessMsg('A new verification code has been sent to your email.');
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
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
          <View style={[styles.brandIcon, { backgroundColor: theme.primaryMuted, borderColor: theme.border }]}>
            <Feather name="shield" size={24} color={theme.primary} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Verify Your Email</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter the verification code or token sent to{'\n'}
            <Text style={{ color: theme.text, fontWeight: '600' }}>{email}</Text>
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted, borderColor: theme.danger }]}>
              <Feather name="alert-circle" size={16} color={theme.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.successBox, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10B981' }]}>
              <Feather name="check-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={[styles.successText, { color: '#10B981' }]}>{successMsg}</Text>
            </View>
          ) : null}

          {/* OTP / Token Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Verification Code / Token</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather name="key" size={18} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Paste code or token from email"
                placeholderTextColor={theme.textMuted}
                value={otpCode}
                onChangeText={setOtpCode}
                autoCapitalize="none"
                autoFocus
              />
            </View>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={handleVerify}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Verify & Continue</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Resend Row */}
          <View style={styles.resendRow}>
            {canResend ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: theme.primary }]}>Resend verification code</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.resendWait, { color: theme.textMuted }]}>
                Resend code in {countdown}s
              </Text>
            )}
          </View>

          {/* Back to sign in */}
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.replace('/(auth)/signin')}
          >
            <Feather name="arrow-left" size={16} color={theme.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.backText, { color: theme.textSecondary }]}>Back to Sign In</Text>
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  successText: {
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
  submitButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendWait: {
    fontSize: 13.5,
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
