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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

export default function ResetPasswordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState(false);

  const confirmRef = useRef<TextInput>(null);

  const runValidation = (pw = password, conf = confirmPassword) => ({
    password: validatePassword(pw) ?? undefined,
    confirm: validateConfirm(pw, conf) ?? undefined,
  });

  const handleBlur = (field: 'password' | 'confirm') => {
    setTouched(t => ({ ...t, [field]: true }));
    setFieldErrors(runValidation());
  };

  const handleSave = async () => {
    setTouched({ password: true, confirm: true });
    const errors = runValidation();
    setFieldErrors(errors);
    if (errors.password || errors.confirm) return;

    setIsLoading(true);
    setServerError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      setServerError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Text style={styles.emoji}>✅</Text>
        <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Password updated
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Your password has been changed successfully.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)' as any)}>
          <Text style={styles.buttonText}>Continue to app</Text>
        </Pressable>
      </View>
    );
  }

  const isFormValid = !fieldErrors.password && !fieldErrors.confirm && password && confirmPassword;

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

        <View style={styles.header}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Set new password
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Choose a strong password for your account.
          </Text>
        </View>

        <View style={styles.fields}>
          {/* New password */}
          <View>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputFlex,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: touched.password && fieldErrors.password ? colors.danger : colors.border,
                  },
                ]}
                placeholder="New password (min 6 characters)"
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
                style={[
                  styles.eyeButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: touched.password && fieldErrors.password ? colors.danger : colors.border,
                  },
                ]}
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

          {/* Confirm password */}
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
                placeholder="Confirm new password"
                placeholderTextColor={colors.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => handleBlur('confirm')}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Pressable
                style={[
                  styles.eyeButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: touched.confirm && fieldErrors.confirm ? colors.danger : colors.border,
                  },
                ]}
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
          onPress={handleSave}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </Pressable>

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
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
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
});
