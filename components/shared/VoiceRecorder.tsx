/**
 * VoiceRecorder — a self-contained record/play/delete audio note component.
 * Uses expo-av for recording; uploads to Supabase Storage via the parent's
 * onRecordingComplete callback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
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

export function VoiceRecorder({ existingAudioUri, onRecordingComplete, onRecordingDeleted }: VoiceRecorderProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  // Lazy initializers so we read prop only once at mount — avoids render-phase side effects
  const [state, setState] = useState<RecorderState>(() => existingAudioUri ? 'recorded' : 'idle');
  const [localUri, setLocalUri] = useState<string | null>(() => existingAudioUri ?? null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => null);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => null);
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  // No render-phase sync needed — state is lazily initialised from existingAudioUri above

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (uri) {
        setLocalUri(uri);
        setState('recorded');
        onRecordingComplete(uri);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  }, [onRecordingComplete]);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Voice notes are not available on web.');
      return;
    }
    setState('requesting');
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone access required',
          'Please allow microphone access in your device settings to record a voice note.',
        );
        setState('idle');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState('recording');
      setRecordingDuration(0);
      // Use a ref to stopRecording so the interval always calls the latest version
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= 60) {
            // Fire-and-forget via ref to avoid stale closure
            void stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
      setState('idle');
    }
  }, [stopRecording]);

  const playRecording = useCallback(async () => {
    if (!localUri) return;
    setState('playing');
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPlaybackPosition(Math.round(status.positionMillis / 1000));
          setPlaybackDuration(Math.round((status.durationMillis ?? 0) / 1000));
          if (status.didJustFinish) {
            setState('recorded');
            setPlaybackPosition(0);
          }
        },
      );
      soundRef.current = sound;
    } catch {
      Alert.alert('Error', 'Could not play recording.');
      setState('recorded');
    }
  }, [localUri]);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => null);
      await soundRef.current.unloadAsync().catch(() => null);
      soundRef.current = null;
    }
    setState('recorded');
    setPlaybackPosition(0);
  }, []);

  const deleteRecording = useCallback(() => {
    Alert.alert('Delete voice note', 'Remove this voice note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (soundRef.current) {
            await soundRef.current.unloadAsync().catch(() => null);
            soundRef.current = null;
          }
          setLocalUri(null);
          setRecordingDuration(0);
          setPlaybackPosition(0);
          setState('idle');
          onRecordingDeleted();
        },
      },
    ]);
  }, [onRecordingDeleted]);

  const formatSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
          onPress={stopRecording}>
          <Text style={styles.emoji}>⏹️</Text>
          <Text style={[styles.label, { color: '#FF4444' }]}>
            Recording {formatSecs(recordingDuration)} — tap to stop
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
                ? `${formatSecs(playbackPosition)} / ${formatSecs(playbackDuration)}`
                : recordingDuration > 0 ? formatSecs(recordingDuration) : '…'}
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
