import * as Linking from 'expo-linking';

export function buildInviteUrl(token: string): string {
  return Linking.createURL(`invite/${token}`);
}
