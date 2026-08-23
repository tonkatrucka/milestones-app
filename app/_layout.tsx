import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DefaultTheme, DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { LaunchErrorBoundary } from '@/components/shared/LaunchErrorBoundary';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getPendingInviteToken } from '@/lib/pending-invite';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { usePendingMealQuickLogStore } from '@/store/pending-meal-quick-log-store';
import { usePendingSleepQuickLogStore } from '@/store/pending-sleep-quick-log-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

function useNavigationTheme() {
  const scheme = useColorScheme();
  const palette = Colors[scheme] ?? Colors.light;
  const base = scheme === 'dark' || scheme === 'night' ? DarkTheme : DefaultTheme;

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
  }, [router]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    }).catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [handleUrl]);
}

function useActivityDeepLinks() {
  const setPendingMeal = usePendingMealQuickLogStore((s) => s.setPending);
  const setPendingSleep = usePendingSleepQuickLogStore((s) => s.setPending);

  const handleUrl = useCallback((url: string) => {
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.open === 'meal') {
      setPendingMeal(true);
    } else if (parsed.queryParams?.open === 'sleep') {
      setPendingSleep(true);
    }
  }, [setPendingMeal, setPendingSleep]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    }).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [handleUrl]);
}

function ConfigErrorScreen() {
  return (
    <View style={configErrorStyles.container}>
      <Text style={configErrorStyles.title}>App configuration missing</Text>
      <Text style={configErrorStyles.body}>
        This build was not packaged with Supabase credentials. Rebuild with EAS after setting
        EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY on expo.dev for the preview
        environment, then install the new Play Store internal test build.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const navigationTheme = useNavigationTheme();
  const colorScheme = useColorScheme();
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useDeepLinkAuth();
  useActivityDeepLinks();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void import('@/services/breast-feeding-timer')
      .then((mod) => {
        try {
          mod.configureBreastFeedingNotifications();
          mod.initBreastFeedingTimerListeners();
        } catch (error) {
          console.warn('[timers] breast init failed', error);
        }
      })
      .catch((error) => console.warn('[timers] breast import failed', error));

    void import('@/services/sleep-timer')
      .then((mod) => {
        try {
          mod.initSleepTimerListeners();
        } catch (error) {
          console.warn('[timers] sleep init failed', error);
        }
      })
      .catch((error) => console.warn('[timers] sleep import failed', error));
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    void import('@/services/push-notifications')
      .then((mod) => mod.registerPushToken(session.user.id).catch(() => {}))
      .catch(() => {});
  }, [session?.user.id]);

  useEffect(() => {
    if (isLoading) return;

    const isAuthScreen =
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password';
    const isInviteScreen = pathname.startsWith('/invite/');
    const isResetPassword = pathname === '/reset-password';

    if (!session && !isAuthScreen && !isInviteScreen) {
      router.replace('/login' as never);
    } else if (session && isAuthScreen && !isResetPassword) {
      getPendingInviteToken().then((pending) => {
        router.replace((pending ? `/invite/${pending}` : '/') as never);
      }).catch(() => {
        router.replace('/' as never);
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
    }).catch(() => {});
  }, [session, isLoading, pathname, router]);

  if (!isSupabaseConfigured) {
    return <ConfigErrorScreen />;
  }

  return (
    <LaunchErrorBoundary>
    <GestureHandlerRootView style={styles.root}>
    <KeyboardProvider>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="assistant" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="onboarding/add-child" options={{ presentation: 'modal', title: 'Add a child' }} />
        <Stack.Screen name="log/[type]" options={{ presentation: 'modal', title: 'Log event' }} />
        <Stack.Screen name="milestone/new" options={{ presentation: 'modal', title: 'New milestone' }} />
        <Stack.Screen name="milestone/[id]" options={{ title: 'Edit milestone' }} />
        <Stack.Screen name="memory/new" options={{ presentation: 'modal', title: 'New memory' }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Edit memory' }} />
        <Stack.Screen name="share/card" options={{ presentation: 'modal', title: 'Share' }} />
        <Stack.Screen name="invite/[token]" options={{ presentation: 'modal', title: 'Accept invite' }} />
        <Stack.Screen name="growth/index" options={{ title: 'Growth' }} />
        <Stack.Screen name="growth/add" options={{ presentation: 'modal', title: 'Add measurement' }} />
        <Stack.Screen name="foods/index" options={{ title: 'Foods' }} />
        <Stack.Screen name="vaccinations/index" options={{ title: 'Vaccinations' }} />
        <Stack.Screen name="capsule/index" options={{ title: 'Time capsule' }} />
        <Stack.Screen name="words/index" options={{ title: 'First words' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
    </ThemeProvider>
    </SafeAreaProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
    </LaunchErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

const configErrorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: '#F0EBE3',
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.serif,
    marginBottom: Spacing.md,
    color: '#2c2825',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5c554d',
  },
});
