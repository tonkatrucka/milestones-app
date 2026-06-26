import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(v: string): string | null {
  if (!v.trim()) return 'Email is required';
  if (!EMAIL_REGEX.test(v.trim())) return 'Enter a valid email address';
  return null;
}

function validatePassword(v: string): string | null {
  if (!v) return 'Password is required';
  if (v.length < 6) return 'Password must be at least 6 characters';
  return null;
}

function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

export default function RegisterScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const runValidation = (
    currentEmail = email,
    currentPassword = password,
    currentConfirm = confirmPassword,
  ): FieldErrors => ({
    email: validateEmail(currentEmail) ?? undefined,
    password: validatePassword(currentPassword) ?? undefined,
    confirm: validateConfirm(currentPassword, currentConfirm) ?? undefined,
  });

  const handleBlur = (field: keyof FieldErrors) => {
    setTouched(t => ({ ...t, [field]: true }));
    setFieldErrors(e => ({ ...e, ...runValidation() }));
  };

  const handleRegister = async () => {
    setTouched({ email: true, password: true, confirm: true });
    const errors = runValidation();
    setFieldErrors(errors);
    if (errors.email || errors.password || errors.confirm) return;

    setIsLoading(true);
    setServerError(null);
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: Linking.createURL('/') },
    });
    setIsLoading(false);
    if (err) {
      setServerError(err.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Text style={styles.successEmoji}>📬</Text>
        <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Check your email
        </Text>
        <Text style={[styles.successText, { color: colors.muted }]}>
          We've sent a confirmation link to {email.trim()}. Open it to activate your account.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const isFormValid =
    !fieldErrors.email && !fieldErrors.password && !fieldErrors.confirm &&
    email.trim() && password && confirmPassword;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets>

        <Text style={styles.heroEmoji}>✨</Text>
        <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Create your account
        </Text>
        <Text style={[styles.subheading, { color: colors.muted }]}>
          Start tracking your little one's journey.
        </Text>

        <View style={styles.fields}>
          {/* Email */}
          <View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: touched.email && fieldErrors.email ? colors.danger : colors.border,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              onBlur={() => handleBlur('email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
            {touched.email && fieldErrors.email ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.email}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View>
            <View style={styles.inputRow}>
              <TextInput
                ref={passwordRef}
                style={[
                  styles.input,
                  styles.inputFlex,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: touched.password && fieldErrors.password ? colors.danger : colors.border,
                  },
                ]}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                onBlur={() => handleBlur('password')}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
              />
              <Pressable
                style={[styles.eyeButton, { backgroundColor: colors.inputBackground, borderColor: touched.password && fieldErrors.password ? colors.danger : colors.border }]}
                onPress={() => setShowPassword(v => !v)}
                hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>
            {touched.password && fieldErrors.password ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          {/* Confirm Password */}
          <View>
            <View style={styles.inputRow}>
              <TextInput
                ref={confirmRef}
                style={[
                  styles.input,
                  styles.inputFlex,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: touched.confirm && fieldErrors.confirm ? colors.danger : colors.border,
                  },
                ]}
                placeholder="Confirm password"
                placeholderTextColor={colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => handleBlur('confirm')}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <Pressable
                style={[styles.eyeButton, { backgroundColor: colors.inputBackground, borderColor: touched.confirm && fieldErrors.confirm ? colors.danger : colors.border }]}
                onPress={() => setShowConfirm(v => !v)}
                hitSlop={8}>
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>
            {touched.confirm && fieldErrors.confirm ? (
              <Text style={[styles.fieldError, { color: colors.danger }]}>{fieldErrors.confirm}</Text>
            ) : null}
          </View>
        </View>

        {serverError ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{serverError}</Text>
        ) : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            (isLoading || !isFormValid) && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.switchLink}>
            <Text style={[styles.switchText, { color: colors.muted }]}>
              Already have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </Pressable>
        </Link>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  heroEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  successText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  fields: {
    gap: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  switchText: { fontSize: 15 },
});
