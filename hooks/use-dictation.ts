/**
 * On-device speech-to-text for the assistant and voice log.
 *
 * expo-speech-recognition is loaded with a dynamic import so it never runs
 * during app startup (same isolation pattern as expo-audio / VoiceRecorder).
 * If this binary was built before the native module was added, start() fails
 * softly and the keyboard dictation fallback still works.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type SpeechModule = typeof import('expo-speech-recognition');
type Subscription = { remove: () => void };

const CONTEXT_PHRASES = [
  'nappy',
  'wet nappy',
  'dirty nappy',
  'nap',
  'woke up',
  'bottle',
  'breastfeed',
  'pumped',
  'temperature',
  'medication',
];

export function useDictation(onTranscript: (text: string, isFinal: boolean) => void) {
  const [isListening, setIsListening] = useState(false);
  const modRef = useRef<SpeechModule | null>(null);
  const subsRef = useRef<Subscription[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const clearSubs = useCallback(() => {
    for (const sub of subsRef.current) {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    }
    subsRef.current = [];
  }, []);

  const stop = useCallback(async () => {
    try {
      await modRef.current?.ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const mod = await import('expo-speech-recognition');
      modRef.current = mod;
      const { ExpoSpeechRecognitionModule } = mod;

      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        Alert.alert(
          'Microphone needed',
          'Allow microphone and speech recognition in Settings to dictate a log.',
        );
        return;
      }

      clearSubs();
      subsRef.current = [
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const first = event.results?.[0];
          if (first?.transcript) {
            onTranscriptRef.current(first.transcript, event.isFinal);
          }
        }),
        ExpoSpeechRecognitionModule.addListener('error', () => {
          setIsListening(false);
        }),
        ExpoSpeechRecognitionModule.addListener('end', () => {
          setIsListening(false);
        }),
      ];

      ExpoSpeechRecognitionModule.start({
        lang: 'en-GB',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        contextualStrings: CONTEXT_PHRASES,
        iosTaskHint: 'dictation',
      });
      setIsListening(true);
    } catch {
      Alert.alert(
        'Voice dictation',
        'In-app dictation needs the next TestFlight / Play Store build. Until then, tap the text field and use the microphone on your keyboard.',
      );
    }
  }, [clearSubs]);

  const toggle = useCallback(() => {
    if (isListening) {
      void stop();
    } else {
      void start();
    }
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      void stop();
      clearSubs();
    };
  }, [stop, clearSubs]);

  return { isListening, start, stop, toggle };
}
