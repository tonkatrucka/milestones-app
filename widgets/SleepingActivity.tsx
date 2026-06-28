import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type SleepingActivityProps = {
  startedAtMs: number;
};

function SleepingActivity(props: SleepingActivityProps, environment: LiveActivityEnvironment) {
  'widget';

  const startedAt = new Date(props.startedAtMs);
  const farFuture = new Date(props.startedAtMs + 365 * 24 * 60 * 60 * 1000);
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#9B8EC4';
  const timerProps = {
    timerInterval: { lower: startedAt, upper: farFuture } as const,
    countsDown: false as const,
  };

  return {
    banner: (
      <HStack modifiers={[padding({ all: 12 })]}>
        <VStack>
          <Text modifiers={[font({ weight: 'bold' }), foregroundStyle(accent)]}>Sleeping</Text>
          <Text
            {...timerProps}
            modifiers={[font({ size: 28, weight: 'bold' }), foregroundStyle(accent)]}
          />
        </VStack>
      </HStack>
    ),
    compactLeading: <Image systemName="moon.zzz.fill" color={accent} />,
    compactTrailing: (
      <Text
        {...timerProps}
        modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(accent)]}
      />
    ),
    minimal: <Image systemName="moon.zzz.fill" color={accent} />,
    expandedCenter: (
      <Text
        {...timerProps}
        modifiers={[font({ size: 32, weight: 'bold' }), foregroundStyle(accent)]}
      />
    ),
  };
}

export default createLiveActivity('SleepingActivity', SleepingActivity);
