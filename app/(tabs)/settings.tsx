import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDateInput, formatDobForInput, parseDateInput } from '@/lib/calendar-date';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useAppStore } from '@/store/app-store';
import { useThemeStore, type ColorSchemePreference } from '@/store/theme-store';
import { buildInviteUrl } from '@/lib/invite-links';
import { updateChild } from '@/services/children';
import { supabase } from '@/lib/supabase';
import {
  createInvite,
  getPendingInvitesForChild,
  listChildMembers,
  removeMember,
  revokeInvite,
  shareInviteLink,
  updateInviteRole,
  updateMemberRole,
  type ChildMemberWithEmail,
} from '@/services/invites';
import type { Child, Invite, MemberRole } from '@/lib/database.types';

function teamErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: string }).message);
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

function manageableRoles(): Array<'caregiver' | 'viewer'> {
  return ['caregiver', 'viewer'];
}

function roleLabel(role: MemberRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type TeamManageTarget =
  | { kind: 'member'; data: ChildMemberWithEmail }
  | { kind: 'invite'; data: Invite };

function TeamManageModal({
  target,
  colors,
  onClose,
  onSaveRole,
  onRemove,
  onShare,
  onCopyLink,
  isSaving,
}: {
  target: TeamManageTarget | null;
  colors: typeof Colors.light;
  onClose: () => void;
  onSaveRole: (role: 'caregiver' | 'viewer') => void;
  onRemove: () => void;
  onShare?: () => void;
  onCopyLink?: () => void;
  isSaving: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<'caregiver' | 'viewer'>('caregiver');

  useEffect(() => {
    if (!target) return;
    const role = target.data.role;
    if (role === 'caregiver' || role === 'viewer') {
      setSelectedRole(role);
    }
  }, [target]);

  if (!target) return null;

  const email = target.data.email;
  const currentRole = target.data.role;
  const isInvite = target.kind === 'invite';
  const roleChanged =
    (currentRole === 'caregiver' || currentRole === 'viewer') && selectedRole !== currentRole;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
            {email}
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
            {isInvite
              ? `Pending invite · expires ${format(new Date(target.data.expires_at), 'd MMM yyyy')}`
              : `Current role: ${roleLabel(currentRole)}`}
          </Text>

          {(currentRole === 'caregiver' || currentRole === 'viewer' || isInvite) && (
            <>
              <Text style={[styles.modalLabel, { color: colors.muted }]}>Role</Text>
              <View style={styles.roleRow}>
                {manageableRoles().map((role) => (
                  <Pressable
                    key={role}
                    style={[
                      styles.roleChip,
                      selectedRole === role
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.inputBackground },
                    ]}
                    onPress={() => setSelectedRole(role)}>
                    <Text
                      style={[
                        styles.roleChipText,
                        { color: selectedRole === role ? '#fff' : colors.muted },
                      ]}>
                      {roleLabel(role)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {roleChanged && (
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}
              onPress={() => onSaveRole(selectedRole)}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save role</Text>
              )}
            </Pressable>
          )}

          {isInvite && onShare && (
            <Pressable
              style={[styles.outlineButton, { borderColor: colors.primary }]}
              onPress={onShare}>
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Share link</Text>
            </Pressable>
          )}

          {isInvite && onCopyLink && (
            <Pressable
              style={[styles.outlineButton, { borderColor: colors.border }]}
              onPress={onCopyLink}>
              <Text style={[styles.outlineButtonText, { color: colors.text }]}>Copy link</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.dangerButton, { borderColor: colors.danger }]}
            onPress={onRemove}
            disabled={isSaving}>
            <Text style={[styles.dangerButtonText, { color: colors.danger }]}>
              {isInvite ? 'Revoke invite' : 'Remove from team'}
            </Text>
          </Pressable>

          <Pressable style={styles.modalCancel} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EditChildModal({
  child,
  colors,
  onClose,
  onSaved,
}: {
  child: Child | null;
  colors: typeof Colors.light;
  onClose: () => void;
  onSaved: (updated: Child) => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!child) return;
    setName(child.name);
    setDob(formatDobForInput(child.date_of_birth));
  }, [child]);

  if (!child) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', "Please enter your child's name.");
      return;
    }
    const dateOfBirth = parseDateInput(dob);
    if (!dateOfBirth) {
      Alert.alert('Invalid date', 'Please enter a valid date of birth (DD/MM/YYYY).');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateChild(child.id, {
        name: trimmedName,
        date_of_birth: dateOfBirth,
      });
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update child.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Edit child</Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
            Update name and date of birth.
          </Text>

          <Text style={[styles.modalLabel, { color: colors.muted }]}>Name</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={[styles.modalLabel, { color: colors.muted }]}>Date of birth</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.muted}
            value={dob}
            onChangeText={(v) => setDob(formatDateInput(v))}
            keyboardType="numeric"
          />

          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save changes</Text>
            )}
          </Pressable>

          <Pressable style={styles.modalCancel} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { activeChild, children } = useActiveChild(session?.user.id ?? null);
  const setActiveChildId = useAppStore((s) => s.setActiveChildId);
  const patchChild = useAppStore((s) => s.patchChild);
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { isOwner, canWrite, isLoading: isRoleLoading } = useMemberRole(
    activeChildId,
    session?.user.id ?? null,
  );

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('caregiver');
  const [isInviting, setIsInviting] = useState(false);
  const [members, setMembers] = useState<ChildMemberWithEmail[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [manageTarget, setManageTarget] = useState<TeamManageTarget | null>(null);
  const [isTeamSaving, setIsTeamSaving] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [childRoles, setChildRoles] = useState<Record<string, MemberRole>>({});

  useEffect(() => {
    if (!session?.user.id) {
      setChildRoles({});
      return;
    }
    supabase
      .from('child_members')
      .select('child_id, role')
      .eq('user_id', session.user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Settings] child roles:', error.message);
          return;
        }
        const roles: Record<string, MemberRole> = {};
        for (const row of data ?? []) {
          roles[row.child_id] = row.role as MemberRole;
        }
        setChildRoles(roles);
      });
  }, [session?.user.id]);

  const loadTeam = useCallback(async () => {
    if (!activeChildId || !isOwner || isRoleLoading) return;
    setIsTeamLoading(true);
    try {
      const [memberRows, inviteRows] = await Promise.all([
        listChildMembers(activeChildId),
        getPendingInvitesForChild(activeChildId),
      ]);
      setMembers(memberRows);
      setPendingInvites(inviteRows);
    } catch (e: unknown) {
      console.error('[Settings] loadTeam failed:', e);
      Alert.alert('Error', teamErrorMessage(e, 'Failed to load team'));
    } finally {
      setIsTeamLoading(false);
    }
  }, [activeChildId, isOwner, isRoleLoading]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeChildId || !session?.user.id || !activeChild) return;
    setIsInviting(true);
    try {
      const invite = await createInvite({
        childId: activeChildId,
        email: inviteEmail.trim(),
        role: inviteRole,
        userId: session.user.id,
      });
      setInviteEmail('');
      await shareInviteLink({
        token: invite.token,
        childName: activeChild.name,
        role: inviteRole,
      });
      await loadTeam();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleShareInvite = async (invite: Invite) => {
    if (!activeChild) return;
    try {
      await shareInviteLink({
        token: invite.token,
        childName: activeChild.name,
        role: invite.role,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleCopyInviteLink = async (invite: Invite) => {
    const url = buildInviteUrl(invite.token);
    try {
      await Share.share({ message: url });
    } catch {
      Alert.alert('Invite link', url);
    }
  };

  const handleManageMember = (member: ChildMemberWithEmail) => {
    if (member.role === 'owner' || member.user_id === session?.user.id) return;
    setManageTarget({ kind: 'member', data: member });
  };

  const handleManageInvite = (invite: Invite) => {
    setManageTarget({ kind: 'invite', data: invite });
  };

  const handleSaveManagedRole = async (role: 'caregiver' | 'viewer') => {
    if (!manageTarget) return;
    setIsTeamSaving(true);
    try {
      if (manageTarget.kind === 'member' && activeChildId) {
        await updateMemberRole(activeChildId, manageTarget.data.user_id, role);
      } else if (manageTarget.kind === 'invite') {
        await updateInviteRole(manageTarget.data.id, role);
      }
      await loadTeam();
      setManageTarget(null);
    } catch (e: unknown) {
      Alert.alert('Error', teamErrorMessage(e, 'Failed to update role'));
    } finally {
      setIsTeamSaving(false);
    }
  };

  const handleRemoveManaged = () => {
    if (!manageTarget) return;
    const isInvite = manageTarget.kind === 'invite';
    const email = manageTarget.data.email;
    Alert.alert(
      isInvite ? 'Revoke invite' : 'Remove from team',
      isInvite ? `Cancel the invite for ${email}?` : `Remove ${email} from this profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isInvite ? 'Revoke' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsTeamSaving(true);
            try {
              if (manageTarget.kind === 'member' && activeChildId) {
                await removeMember(activeChildId, manageTarget.data.user_id);
              } else if (manageTarget.kind === 'invite') {
                await revokeInvite(manageTarget.data.id);
              }
              await loadTeam();
              setManageTarget(null);
            } catch (e: unknown) {
              Alert.alert(
                'Error',
                teamErrorMessage(e, isInvite ? 'Failed to revoke invite' : 'Failed to remove member'),
              );
            } finally {
              setIsTeamSaving(false);
            }
          },
        },
      ],
    );
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

        <Section title="Appearance" colors={colors}>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            Choose how Milestones looks on this device.
          </Text>
          <View style={[styles.schemeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['light', 'dark'] as ColorSchemePreference[]).map((option) => {
              const active = scheme === option;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.schemeOption,
                    active && {
                      backgroundColor: colors.elevated,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setColorScheme(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Ionicons
                    name={option === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={20}
                    color={active ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.schemeOptionText,
                      { color: active ? colors.text : colors.muted },
                      active && styles.schemeOptionTextActive,
                    ]}>
                    {option === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

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

        <Section title="Your children" colors={colors}>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            {Object.values(childRoles).includes('owner')
              ? 'Tap a child to edit their details or switch profiles.'
              : 'Tap a child to switch profiles.'}
          </Text>
          {children.map((child) => {
            const isOwner = childRoles[child.id] === 'owner';
            return (
              <Pressable
                key={child.id}
                style={[
                  styles.childRow,
                  child.id === activeChildId && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => {
                  setActiveChildId(child.id);
                  if (isOwner) setEditChild(child);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isOwner ? `Edit ${child.name}` : `Select ${child.name}`
                }>
                <Text style={styles.childEmoji}>👶</Text>
                <View style={styles.childInfo}>
                  <Text style={[styles.childName, { color: colors.text }]}>{child.name}</Text>
                  <Text style={[styles.childDob, { color: colors.muted }]}>
                    Born {formatDobForInput(child.date_of_birth)}
                  </Text>
                </View>
                {child.id === activeChildId && (
                  <Text style={[styles.activeLabel, { color: colors.primary }]}>Active</Text>
                )}
                {isOwner && (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                )}
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.outlineButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/onboarding/add-child' as never)}>
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>+ Add child</Text>
          </Pressable>
        </Section>

        {activeChild && !canWrite && (
          <Section title="Your access" colors={colors}>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              You have view-only access to {activeChild.name}'s profile. Ask the owner if you need
              to log events or add milestones.
            </Text>
          </Section>
        )}

        {activeChild && isOwner && (
          <>
            <Section title={`Invite someone to ${activeChild.name}'s profile`} colors={colors}>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                Caregivers can log events and add milestones. Viewers can only view. You'll share a
                link after creating the invite.
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
                      {roleLabel(role)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  isInviting && { opacity: 0.7 },
                ]}
                onPress={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create & share invite</Text>
                )}
              </Pressable>
            </Section>

            <Section title={`${activeChild.name}'s team`} colors={colors}>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                Use Edit on a member or pending invite to change their role or remove them.
              </Text>
              {isTeamLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  {members.map((member) => {
                    const isSelf = member.user_id === session?.user.id;
                    const canManage = member.role !== 'owner' && !isSelf;
                    return (
                      <View key={member.user_id} style={styles.teamRow}>
                        <View style={styles.teamInfo}>
                          <Text style={[styles.teamEmail, { color: colors.text }]} numberOfLines={1}>
                            {member.email}
                          </Text>
                          <Text style={[styles.teamRole, { color: colors.muted }]}>
                            {roleLabel(member.role)}
                            {isSelf ? ' · You' : ''}
                          </Text>
                        </View>
                        {canManage ? (
                          <Pressable
                            style={[styles.editButton, { borderColor: colors.primary }]}
                            onPress={() => handleManageMember(member)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${member.email}`}>
                            <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}

                  {pendingInvites.length > 0 && (
                    <>
                      <Text style={[styles.teamSubheading, { color: colors.muted }]}>
                        PENDING INVITES
                      </Text>
                      {pendingInvites.map((invite) => (
                        <View key={invite.id} style={styles.teamRow}>
                          <View style={styles.teamInfo}>
                            <Text style={[styles.teamEmail, { color: colors.text }]} numberOfLines={1}>
                              {invite.email}
                            </Text>
                            <Text style={[styles.teamRole, { color: colors.muted }]}>
                              {roleLabel(invite.role)} · expires{' '}
                              {format(new Date(invite.expires_at), 'd MMM')}
                            </Text>
                          </View>
                          <Pressable
                            style={[styles.editButton, { borderColor: colors.primary }]}
                            onPress={() => handleManageInvite(invite)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit invite for ${invite.email}`}>
                            <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
                          </Pressable>
                        </View>
                      ))}
                    </>
                  )}

                  {members.length === 0 && pendingInvites.length === 0 && (
                    <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
                      No team members yet.
                    </Text>
                  )}
                </>
              )}
            </Section>
          </>
        )}
      </ScrollView>

      <TeamManageModal
        target={manageTarget}
        colors={colors}
        isSaving={isTeamSaving}
        onClose={() => setManageTarget(null)}
        onSaveRole={handleSaveManagedRole}
        onRemove={handleRemoveManaged}
        onShare={
          manageTarget?.kind === 'invite' && activeChild
            ? () => handleShareInvite(manageTarget.data)
            : undefined
        }
        onCopyLink={
          manageTarget?.kind === 'invite'
            ? () => handleCopyInviteLink(manageTarget.data)
            : undefined
        }
      />

      <EditChildModal
        child={editChild}
        colors={colors}
        onClose={() => setEditChild(null)}
        onSaved={(updated) => patchChild(updated.id, updated)}
      />
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
  schemeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
  },
  schemeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  schemeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  schemeOptionTextActive: {
    fontWeight: '700',
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  teamInfo: {
    flex: 1,
    gap: 2,
  },
  teamEmail: {
    fontSize: 15,
    fontWeight: '600',
  },
  teamRole: {
    fontSize: 12,
  },
  editButton: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    flexShrink: 0,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  teamSubheading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
