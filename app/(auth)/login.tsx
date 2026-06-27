import { useEffect, useRef, useState } from 'react';
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
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
} from '@/lib/pending-invite';

const STORAGE_EMAIL_KEY = '@milestones/remembered_email';
const STORAGE_REMEMBER_KEY = '@milestones/remember_me';

function humaniseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid_credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return message;
}

/** Fire-and-forget — never blocks login or navigation. */
function persistRememberedEmail(emailToSave: string, shouldRemember: boolean): void {
  if (shouldRemember) {
    AsyncStorage.multiSet([
      [STORAGE_REMEMBER_KEY, 'true'],
      [STORAGE_EMAIL_KEY, emailToSave],
    ]).catch(() => {});
  } else {
    AsyncStorage.multiRemove([STORAGE_REMEMBER_KEY, STORAGE_EMAIL_KEY]).catch(() => {});
  }
}

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  // Restore remembered email on mount
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_REMEMBER_KEY, STORAGE_EMAIL_KEY])
      .then((results) => {
        const remember = results[0]?.[1];
        const savedEmail = results[1]?.[1];
        const shouldRemember = remember !== 'false';
        setRememberMe(shouldRemember);
        if (shouldRemember && savedEmail) {
          setEmail(savedEmail);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (err) {
        setError(humaniseAuthError(err.message));
        return;
      }

      // Persist email in the background — never blocks navigation.
      persistRememberedEmail(email.trim(), rememberMe);

      const pendingInvite = await getPendingInviteToken();
      if (pendingInvite) {
        await clearPendingInviteToken();
        router.replace(`/invite/${pendingInvite}` as never);
      } else {
        router.replace('/' as never);
      }

    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      // Always clear loading — even if signInWithPassword throws or the
      // component is navigated away mid-flight.
      setIsLoading(false);
    }
  };

  const handleToggleRemember = (next: boolean) => {
    setRememberMe(next);
    persistRememberedEmail(email.trim(), next);
  };

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

        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>👶</Text>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: Fonts!.rounded }]}>
            Milestones
          </Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Every moment, remembered.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Welcome back
          </Text>

          <View style={styles.fields}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <View style={styles.inputRow}>
              <TextInput
                ref={passwordRef}
                style={[
                  styles.input,
                  styles.inputFlex,
                  { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={[styles.eyeButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowPassword(v => !v)}
                hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>
          </View>

          {/* Remember email + Forgot password */}
          <View style={styles.optionsRow}>
            <Pressable
              style={styles.rememberRow}
              onPress={() => handleToggleRemember(!rememberMe)}
              hitSlop={8}>
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: rememberMe ? colors.primary : 'transparent',
                  borderColor: rememberMe ? colors.primary : colors.muted,
                },
              ]}>
                {rememberMe && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={[styles.rememberText, { color: colors.muted }]}>Remember Email</Text>
            </Pressable>

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable hitSlop={8}>
                <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
              </Pressable>
            </Link>
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}

          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>

          <Link href="/(auth)/register" asChild>
            <Pressable style={styles.switchLink}>
              <Text style={[styles.switchText, { color: colors.muted }]}>
                Don't have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign up</Text>
              </Text>
            </Pressable>
          </Link>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroEmoji: {
    fontSize: 64,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
  },
  tagline: {
    fontSize: 16,
  },
  form: {
    gap: Spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: 14,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
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
