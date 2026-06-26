import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DefaultTheme, DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { getPendingInviteToken } from '@/lib/pending-invite';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function useNavigationTheme() {
  const scheme = useColorScheme();
  const palette = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.elevated,
      text: palette.text,
      border: palette.border,
      notification: palette.primary,
    },
  };
}

/**
 * Handles Supabase deep links for email confirmation and password recovery.
 *
 * Supabase appends tokens as a URL hash fragment, e.g.:
 *   milestones://#access_token=xxx&refresh_token=yyy&type=recovery
 *
 * We parse that fragment manually (URLSearchParams on hash), call setSession
 * to hydrate Supabase's auth state, then navigate to the appropriate screen.
 */
function useDeepLinkAuth() {
  const router = useRouter();

  const handleUrl = useCallback(async (url: string) => {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return;

    const params = new URLSearchParams(url.slice(hashIndex + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (!accessToken || !refreshToken) return;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) return;

    if (type === 'recovery') {
      router.push('/reset-password' as any);
    }
    // type === 'signup' means email confirmed — session is now live and
    // the route guard will redirect to (tabs) automatically.
  }, [router]);

  useEffect(() => {
    // URL that cold-launched the app
    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    // URL received while app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [handleUrl]);
}

export default function RootLayout() {
  const navigationTheme = useNavigationTheme();
  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useDeepLinkAuth();

  useEffect(() => {
    if (isLoading) return;

    // Auth screens live at /login, /register, /forgot-password, /reset-password
    // (Expo Router 6 strips route-group prefixes from the URL, so we check
    // the actual pathname rather than useSegments() which can omit group names.)
    const isAuthScreen =
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password';
    const isInviteScreen = pathname.startsWith('/invite/');

    // Keep the user on /reset-password while they set a new password
    // even though they have a valid (recovery) session.
    const isResetPassword = pathname === '/reset-password';

    if (!session && !isAuthScreen && !isInviteScreen) {
      router.replace('/login' as never);
    } else if (session && isAuthScreen && !isResetPassword) {
      getPendingInviteToken().then((pending) => {
        router.replace((pending ? `/invite/${pending}` : '/') as never);
      });
    }
  }, [session, isLoading, pathname]);

  useEffect(() => {
    if (isLoading || !session) return;
    if (pathname.startsWith('/invite/')) return;

    getPendingInviteToken().then((pending) => {
      if (pending) {
        router.replace(`/invite/${pending}` as never);
      }
    });
  }, [session, isLoading, pathname, router]);

  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/add-child" options={{ presentation: 'modal', title: 'Add a child' }} />
        <Stack.Screen name="log/[type]" options={{ presentation: 'modal', title: 'Log event' }} />
        <Stack.Screen name="milestone/new" options={{ presentation: 'modal', title: 'New milestone' }} />
        <Stack.Screen name="milestone/[id]" options={{ title: 'Edit milestone' }} />
        <Stack.Screen name="memory/new" options={{ presentation: 'modal', title: 'New memory' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Edit memory' }} />
        <Stack.Screen name="share/card" options={{ presentation: 'modal', title: 'Share' }} />
        <Stack.Screen name="invite/[token]" options={{ presentation: 'modal', title: 'Accept invite' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
