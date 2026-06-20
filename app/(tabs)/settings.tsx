import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useAppStore } from '@/store/app-store';
import { createInvite } from '@/services/invites';
import type { MemberRole } from '@/lib/database.types';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { activeChild, children } = useActiveChild(session?.user.id ?? null);
  const setActiveChildId = useAppStore((s) => s.setActiveChildId);
  const activeChildId = useAppStore((s) => s.activeChildId);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('caregiver');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeChildId || !session?.user.id) return;
    setIsInviting(true);
    try {
      await createInvite({
        childId: activeChildId,
        email: inviteEmail.trim(),
        role: inviteRole,
        userId: session.user.id,
      });
      setInviteEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + Spacing.md }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Settings
        </Text>

        {/* Account */}
        <Section title="Account" colors={colors}>
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Signed in as</Text>
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
              {session?.user.email ?? '—'}
            </Text>
          </View>
          <Pressable
            style={[styles.dangerButton, { borderColor: colors.danger }]}
            onPress={handleSignOut}>
            <Text style={[styles.dangerButtonText, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </Section>

        {/* Children */}
        <Section title="Your children" colors={colors}>
          {children.map((child) => (
            <Pressable
              key={child.id}
              style={[
                styles.childRow,
                child.id === activeChildId && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setActiveChildId(child.id)}>
              <Text style={styles.childEmoji}>👶</Text>
              <View style={styles.childInfo}>
                <Text style={[styles.childName, { color: colors.text }]}>{child.name}</Text>
                <Text style={[styles.childDob, { color: colors.muted }]}>
                  Born {child.date_of_birth}
                </Text>
              </View>
              {child.id === activeChildId && (
                <Text style={[styles.activeLabel, { color: colors.primary }]}>Active</Text>
              )}
            </Pressable>
          ))}
          <Pressable
            style={[styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/onboarding/add-child' as any)}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>+ Add child</Text>
          </Pressable>
        </Section>

        {/* Invite */}
        {activeChild && (
          <Section title={`Invite someone to ${activeChild.name}'s profile`} colors={colors}>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              Caregivers can log events and add milestones. Viewers can only view.
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.roleRow}>
              {(['caregiver', 'viewer'] as MemberRole[]).map((role) => (
                <Pressable
                  key={role}
                  style={[
                    styles.roleChip,
                    inviteRole === role
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.inputBackground },
                  ]}
                  onPress={() => setInviteRole(role)}>
                  <Text
                    style={[
                      styles.roleChipText,
                      { color: inviteRole === role ? '#fff' : colors.muted },
                    ]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {inviteSuccess ? (
              <Text style={[styles.successText, { color: colors.secondary }]}>
                ✓ Invite sent!
              </Text>
            ) : (
              <Pressable
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  isInviting && { opacity: 0.7 },
                ]}
                onPress={handleInvite}
                disabled={isInviting}>
                {isInviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send invite</Text>
                )}
              </Pressable>
            )}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    paddingTop: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionContent: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.sm,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  childEmoji: { fontSize: 28 },
  childInfo: { flex: 1 },
  childName: { fontSize: 15, fontWeight: '600' },
  childDob: { fontSize: 12 },
  activeLabel: { fontSize: 12, fontWeight: '700' },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleChip: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  roleChipText: { fontSize: 14, fontWeight: '600' },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  outlineButton: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  outlineButtonText: { fontWeight: '700', fontSize: 15 },
  dangerButton: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  dangerButtonText: { fontWeight: '700', fontSize: 15 },
  successText: { fontWeight: '600', textAlign: 'center', fontSize: 15 },
});
