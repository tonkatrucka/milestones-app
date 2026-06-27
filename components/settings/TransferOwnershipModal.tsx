import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/error-message';
import type { Child } from '@/lib/database.types';
import {
  listChildMembers,
  transferChildOwnership,
  type ChildMemberWithEmail,
} from '@/services/invites';

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function TransferOwnershipModal({
  child,
  currentUserId,
  colors,
  onClose,
  onTransferred,
}: {
  child: Child | null;
  currentUserId: string | null;
  colors: typeof Colors.light;
  onClose: () => void;
  onTransferred: (childId: string) => void;
}) {
  const [members, setMembers] = useState<ChildMemberWithEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!child || !currentUserId) return;
    setIsLoading(true);
    try {
      const rows = await listChildMembers(child.id);
      setMembers(
        rows.filter(
          (member) => member.role !== 'owner' && member.user_id !== currentUserId,
        ),
      );
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to load team members.'));
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [child, currentUserId, onClose]);

  useEffect(() => {
    if (!child) return;
    loadMembers();
  }, [child, loadMembers]);

  if (!child) return null;

  const confirmTransfer = (member: ChildMemberWithEmail) => {
    Alert.alert(
      'Transfer ownership',
      `Make ${member.email} the owner of ${child.name}'s profile? You will become a caregiver and can still view and log events.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setIsTransferring(true);
            try {
              await transferChildOwnership(child.id, member.user_id);
              onTransferred(child.id);
              onClose();
              Alert.alert(
                'Ownership transferred',
                `${member.email} is now the owner of ${child.name}'s profile.`,
              );
            } catch (e: unknown) {
              Alert.alert('Error', getErrorMessage(e, 'Failed to transfer ownership.'));
            } finally {
              setIsTransferring(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Transfer ownership</Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
            Choose a team member to take over {child.name}'s profile. They must already have joined
            the team.
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : members.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No team members available. Invite someone from the team section first, then transfer
              ownership.
            </Text>
          ) : (
            <ScrollView style={styles.memberList} keyboardShouldPersistTaps="handled">
              {members.map((member) => (
                <Pressable
                  key={member.user_id}
                  style={[styles.memberRow, { borderColor: colors.border }]}
                  onPress={() => confirmTransfer(member)}
                  disabled={isTransferring}>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberEmail, { color: colors.text }]} numberOfLines={1}>
                      {member.email}
                    </Text>
                    <Text style={[styles.memberRole, { color: colors.muted }]}>
                      {roleLabel(member.role)}
                    </Text>
                  </View>
                  <Text style={[styles.transferAction, { color: colors.primary }]}>Select</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable style={styles.modalCancel} onPress={onClose} disabled={isTransferring}>
            <Text style={[styles.modalCancelText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  loader: {
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  memberList: {
    maxHeight: 240,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: {
    flex: 1,
  },
  memberEmail: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  transferAction: {
    fontSize: 14,
    fontWeight: '700',
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
