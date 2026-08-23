import { lazy, Suspense } from 'react';

type VoiceRecorderProps = {
  existingAudioUri?: string | null;
  onRecordingComplete: (localUri: string) => void;
  onRecordingDeleted: () => void;
};

const VoiceRecorderImpl = lazy(() =>
  import('@/components/shared/VoiceRecorder').then((mod) => ({ default: mod.VoiceRecorder })),
);

/** Loads expo-audio only when a milestone screen actually renders the recorder. */
export function VoiceRecorder(props: VoiceRecorderProps) {
  return (
    <Suspense fallback={null}>
      <VoiceRecorderImpl {...props} />
    </Suspense>
  );
}
