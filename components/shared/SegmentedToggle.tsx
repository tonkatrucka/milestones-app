import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius } from '@/constants/theme';

export interface SegmentedToggleOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedToggleOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  colors: typeof Colors.light;
}

export function SegmentedToggle<T extends string>({
  options,
  selected,
  onSelect,
  colors,
}: SegmentedToggleProps<T>) {
  return (
    <View style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[styles.option, active && { backgroundColor: colors.elevated }]}
            onPress={() => onSelect(opt.key)}>
            <Text
              style={[
                styles.label,
                { color: active ? colors.text : colors.muted },
                active && styles.labelActive,
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts!.rounded,
  },
  labelActive: {
    fontWeight: '700',
  },
});
