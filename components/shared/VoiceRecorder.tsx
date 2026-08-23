/**
 * VoiceRecorder — record / play / delete an audio note.
 * Uses expo-audio (SDK 56). expo-av is removed — it crashes Android on launch.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface VoiceRecorderProps {
  /** Existing audio URI/URL to show in playback-only mode */
  existingAudioUri?: string | null;
  /** Called with the local file URI after a recording completes */
  onRecordingComplete: (localUri: string) => void;
  /** Called when the user deletes the current recording */
  onRecordingDeleted: () => void;
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'playing';

export function VoiceRecorder({
  existingAudioUri,
  onRecordingComplete,
  onRecordingDeleted,
}: VoiceRecorderProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme] ?? Colors.light;

  const [state, setState] = useState<RecorderState>(() =>
    existingAudioUri ? 'recorded' : 'idle',
  );
  const [localUri, setLocalUri] = useState<string | null>(() => existingAudioUri ?? null);

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(localUri);
  const playerStatus = useAudioPlayerStatus(player);

  const finishRecording = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (uri) {
        setLocalUri(uri);
        player.replace(uri);
        setState('recorded');
        onRecordingComplete(uri);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  }, [onRecordingComplete, player, recorder]);

  // Hard cap voice notes at 60s.
  useEffect(() => {
    if (state !== 'recording') return;
    if (recorderState.durationMillis >= 60_000) {
      void finishRecording();
    }
  }, [state, recorderState.durationMillis, finishRecording]);

  useEffect(() => {
    if (state !== 'playing') return;
    if (playerStatus.didJustFinish) {
      setState('recorded');
      player.seekTo(0);
    }
  }, [state, playerStatus.didJustFinish, player]);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Voice notes are not available on web.');
      return;
    }
    setState('requesting');
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone access required',
          'Please allow microphone access in your device settings to record a voice note.',
        );
        setState('idle');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
      setState('idle');
    }
  }, [recorder]);

  const playRecording = useCallback(() => {
    if (!localUri) return;
    setState('playing');
    player.seekTo(0);
    player.play();
  }, [localUri, player]);

  const stopPlayback = useCallback(() => {
    player.pause();
    player.seekTo(0);
    setState('recorded');
  }, [player]);

  const deleteRecording = useCallback(() => {
    Alert.alert('Delete voice note', 'Remove this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          player.pause();
          setLocalUri(null);
          setState('idle');
          onRecordingDeleted();
        },
      },
    ]);
  }, [onRecordingDeleted, player]);

  const formatMillis = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const recordedDurationMs =
    recorderState.durationMillis > 0
      ? recorderState.durationMillis
      : (playerStatus.duration ?? 0) * 1000;

  return (
    <View style={styles.container}>
      {state === 'idle' && (
        <Pressable
          style={[styles.button, { backgroundColor: colors.elevated, borderColor: colors.border }]}
          onPress={startRecording}>
          <Text style={styles.emoji}>🎙️</Text>
          <Text style={[styles.label, { color: colors.text }]}>Add voice note</Text>
        </Pressable>
      )}

      {state === 'requesting' && (
        <View style={[styles.button, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.label, { color: colors.muted }]}>Requesting access…</Text>
        </View>
      )}

      {state === 'recording' && (
        <Pressable
          style={[styles.button, styles.recording, { backgroundColor: '#FF444422', borderColor: '#FF4444' }]}
          onPress={finishRecording}>
          <Text style={styles.emoji}>⏹️</Text>
          <Text style={[styles.label, { color: '#FF4444' }]}>
            Recording {formatMillis(recorderState.durationMillis)} — tap to stop
          </Text>
          <View style={[styles.recordingDot, { backgroundColor: '#FF4444' }]} />
        </Pressable>
      )}

      {(state === 'recorded' || state === 'playing') && (
        <View style={[styles.playRow, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Pressable
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            onPress={state === 'playing' ? stopPlayback : playRecording}>
            <Text style={styles.playEmoji}>{state === 'playing' ? '⏹' : '▶️'}</Text>
          </Pressable>
          <View style={styles.playInfo}>
            <Text style={[styles.playLabel, { color: colors.text }]}>Voice note</Text>
            <Text style={[styles.playTime, { color: colors.muted }]}>
              {state === 'playing'
                ? `${formatMillis((playerStatus.currentTime ?? 0) * 1000)} / ${formatMillis((playerStatus.duration ?? 0) * 1000)}`
                : recordedDurationMs > 0
                  ? formatMillis(recordedDurationMs)
                  : '…'}
            </Text>
          </View>
          <Pressable onPress={deleteRecording} hitSlop={8}>
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  recording: { gap: Spacing.sm },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playEmoji: { fontSize: 14 },
  playInfo: { flex: 1 },
  playLabel: { fontSize: 13, fontWeight: '600' },
  playTime: { fontSize: 11, marginTop: 2 },
  deleteText: { fontSize: 13, fontWeight: '600' },
});
