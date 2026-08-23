/**
 * TappableChip — a pressable chip that always meets the 44pt minimum touch target
 * recommended by Apple HIG and WCAG 2.5.5. Use wherever a small pill-shaped button
 * is needed, instead of raw Pressable + Text.
 */

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Radius } from '@/constants/theme';

interface TappableChipProps {
  label?: string;
  children?: ReactNode;
  onPress: () => void;
  /** Background colour of the chip */
  backgroundColor?: string;
  /** Border colour (omit for no border) */
  borderColor?: string;
  /** Text colour */
  textColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab';
  accessibilityState?: { selected?: boolean };
}

export function TappableChip({
  label,
  children,
  onPress,
  backgroundColor,
  borderColor,
  textColor,
  disabled,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: TappableChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        backgroundColor ? { backgroundColor } : undefined,
        borderColor ? { borderWidth: 1, borderColor } : undefined,
        style,
      ]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState}>
      {children ?? (
        <Text style={[styles.label, textColor ? { color: textColor } : undefined, textStyle]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,        // WCAG 2.5.5 / Apple HIG minimum touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
