import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** SecureStore value limit on Android; chunk larger session payloads. */
const CHUNK_SIZE = 2000;

async function getChunkCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(`${key}_chunks`);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readChunks(key: string, count: number): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}_${i}`);
    if (part == null) return '';
    parts.push(part);
  }
  return parts.join('');
}

async function writeChunks(key: string, value: string): Promise<void> {
  const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
  for (let i = 0; i < chunkCount; i++) {
    await SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

async function clearChunks(key: string): Promise<void> {
  const count = await getChunkCount(key);
  if (count) {
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`);
    }
  }
  await SecureStore.deleteItemAsync(`${key}_chunks`);
}

async function migrateFromAsyncStorage(key: string): Promise<string | null> {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy == null) return null;
  await writeChunks(key, legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
}

/**
 * Auth session storage: encrypted at rest via SecureStore (chunked when needed).
 * Web falls back to AsyncStorage; existing AsyncStorage sessions migrate on first read.
 */
export const supabaseAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }

    const count = await getChunkCount(key);
    if (count) {
      const value = await readChunks(key, count);
      return value || null;
    }

    return migrateFromAsyncStorage(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await writeChunks(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    await clearChunks(key);
  },
};
