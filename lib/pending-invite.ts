import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@milestones/pending_invite_token';

export async function setPendingInviteToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, token);
}

export async function getPendingInviteToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function clearPendingInviteToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
