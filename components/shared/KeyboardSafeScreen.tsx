import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

const ANDROID_NAV_FALLBACK = 48;

/**
 * Bottom safe-area padding for chrome that sits on the screen edge.
 * KeyboardProvider + Android edge-to-edge can report insets.bottom as 0,
 * which is why the assistant composer also falls back to 48 on Android.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, Platform.OS === 'android' ? ANDROID_NAV_FALLBACK : 0);
}

type KeyboardSafeScreenProps = {
  children: ReactNode;
  footer?: ReactNode;
  backgroundColor: string;
  footerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Form layout that keeps a sticky footer clear of the system nav bar and
 * scrolls the focused field above the keyboard on iOS and Android.
 */
export function KeyboardSafeScreen({
  children,
  footer,
  backgroundColor,
  footerStyle,
  contentContainerStyle,
}: KeyboardSafeScreenProps) {
  const bottomInset = useBottomInset();
  const keyboardHeight = useKeyboardState((state) =>
    state.isVisible ? state.height : 0,
  );
  const footerPad = Spacing.md + Math.max(keyboardHeight, bottomInset);

  return (
    <View style={[styles.flex, { backgroundColor }]}>
      <KeyboardAwareScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bottomOffset={footer ? 72 : Spacing.lg}
        extraKeyboardSpace={0}
        contentContainerStyle={[
          !footer && { paddingBottom: Spacing.xl + bottomInset },
          contentContainerStyle,
        ]}>
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <View style={[footerStyle, { paddingBottom: footerPad }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
