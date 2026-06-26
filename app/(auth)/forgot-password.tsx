import { useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: Linking.createURL('/'),
    });
    setIsLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Text style={styles.emoji}>🔑</Text>
        <Text style={[styles.heading, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Check your email
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          If an account exists for {email.trim()}, we've sent a link to reset your password.
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

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
            Reset password
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            Enter the email associated with your account and we'll send you a reset link.
          </Text>
        </View>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, color: colors.text, borderColor: error ? colors.danger : colors.border },
          ]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={v => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={handleReset}
        />

        {error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            (isLoading || !email.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleReset}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.backLink}>
            <Text style={[styles.backText, { color: colors.muted }]}>
              Back to{' '}
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
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
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
  backLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backText: { fontSize: 15 },
});
