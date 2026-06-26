import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { acceptInvite } from '@/services/invites';
import { useActiveChild } from '@/hooks/use-active-child';
import {
  clearPendingInviteToken,
  setPendingInviteToken,
} from '@/lib/pending-invite';

type State = 'idle' | 'loading' | 'success' | 'error';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const { isChildrenLoading, refreshChildren } = useActiveChild(session?.user.id ?? null);

  const [state, setState] = useState<State>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (token && !session) {
      setPendingInviteToken(token).catch(() => {});
    }
  }, [token, session]);

  const handleAccept = async () => {
    if (!token || !session) return;
    setState('loading');
    try {
      await acceptInvite(token);
      await clearPendingInviteToken();
      refreshChildren();
      setState('success');
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Invalid or expired invite link.');
      setState('error');
    }
  };

  const goToSignIn = () => {
    if (token) {
      setPendingInviteToken(token).catch(() => {});
    }
    router.push('/login' as never);
  };

  if (!session) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Sign in to accept
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You need an account to join this child's profile.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={goToSignIn}>
            <Text style={styles.buttonText}>Sign in or create account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'success') {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            You're in!
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            You now have access to this child's milestones and events.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={async () => {
              await clearPendingInviteToken();
              router.replace('/(tabs)' as never);
            }}>
            <Text style={styles.buttonText}>Open Milestones</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text style={styles.emoji}>❌</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Invite failed
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>{errorMessage}</Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={async () => {
              await clearPendingInviteToken();
              router.replace('/(tabs)' as never);
            }}>
            <Text style={styles.buttonText}>Go to home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={styles.emoji}>👨‍👩‍👧</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          You've been invited!
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Accept this invite to start tracking milestones together.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, state === 'loading' && { opacity: 0.7 }]}
          onPress={handleAccept}
          disabled={state === 'loading'}>
          {state === 'loading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Accept invite</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  emoji: { fontSize: 72 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
