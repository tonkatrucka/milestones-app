/**
 * DigestFollowersSection — manage email digest followers (Tier 2 family access).
 * Shown in Settings for owners only.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  getDigestFollowers,
  addDigestFollower,
  updateDigestFollower,
  removeDigestFollower,
} from '@/services/digest-followers';
import type { DigestFollower } from '@/lib/database.types';

interface Props {
  childId: string;
  userId: string | null;
  colors: typeof Colors.light;
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: typeof Colors.light }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

export function DigestFollowersSection({ childId, userId, colors }: Props) {
  const [followers, setFollowers] = useState<DigestFollower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const refresh = useCallback(async () => {
    if (!childId) return;
    try { setFollowers(await getDigestFollowers(childId)); }
    finally { setIsLoading(false); }
  }, [childId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async () => {
    if (!email.trim() || !userId) return;
    setIsAdding(true);
    try {
      const follower = await addDigestFollower({
        childId,
        email: email.trim(),
        displayName: name.trim() || undefined,
        addedBy: userId,
      });
      setFollowers((prev) => [...prev, follower]);
      setEmail(''); setName(''); setShowAdd(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add follower');
    } finally { setIsAdding(false); }
  };

  const handleToggle = async (follower: DigestFollower) => {
    try {
      const updated = await updateDigestFollower(follower.id, { isActive: !follower.is_active });
      setFollowers((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch { /* ignore */ }
  };

  const handleRemove = (follower: DigestFollower) => {
    Alert.alert(
      'Remove follower',
      `${follower.email} will no longer receive digest emails.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await removeDigestFollower(follower.id);
              setFollowers((prev) => prev.filter((f) => f.id !== follower.id));
            } catch { /* ignore */ }
          },
        },
      ],
    );
  };

  return (
    <Section title="Family email digest" colors={colors}>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Add family members to receive a weekly email digest of new milestones and memories — no app required.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {followers.map((f) => (
            <View key={f.id} style={styles.followerRow}>
              <View style={styles.followerInfo}>
                <Text style={[styles.followerEmail, { color: colors.text }]}>{f.email}</Text>
                {f.display_name && (
                  <Text style={[styles.followerName, { color: colors.muted }]}>{f.display_name}</Text>
                )}
              </View>
              <Pressable
                style={[styles.toggleBtn, { backgroundColor: f.is_active ? colors.primary + '20' : colors.inputBackground }]}
                onPress={() => handleToggle(f)}>
                <Text style={[styles.toggleText, { color: f.is_active ? colors.primary : colors.muted }]}>
                  {f.is_active ? 'Active' : 'Paused'}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleRemove(f)} hitSlop={8}>
                <Text style={[styles.removeText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          ))}

          {showAdd ? (
            <View style={styles.addForm}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                placeholder="Email address"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                placeholder="Name (optional)"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <View style={styles.addButtons}>
                <Pressable
                  style={[styles.addConfirm, { backgroundColor: colors.primary }, (!email.trim() || isAdding) && { opacity: 0.5 }]}
                  onPress={handleAdd}
                  disabled={!email.trim() || isAdding}>
                  {isAdding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addConfirmText}>Add</Text>}
                </Pressable>
                <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowAdd(false)}>
                  <Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.addRow, { borderColor: colors.primary }]}
              onPress={() => setShowAdd(true)}>
              <Text style={[styles.addRowText, { color: colors.primary }]}>+ Add family member</Text>
            </Pressable>
          )}
        </>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: Spacing.sm },
  sectionContent: { borderRadius: 16, padding: Spacing.md, gap: Spacing.md },
  subtitle: { fontSize: 13, lineHeight: 20 },
  followerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  followerInfo: { flex: 1 },
  followerEmail: { fontSize: 14, fontWeight: '600' },
  followerName: { fontSize: 12 },
  toggleBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  toggleText: { fontSize: 12, fontWeight: '700' },
  removeText: { fontSize: 13, fontWeight: '600' },
  addForm: { gap: Spacing.sm },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14 },
  addButtons: { flexDirection: 'row', gap: Spacing.sm },
  addConfirm: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  addConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { fontWeight: '600', fontSize: 14 },
  addRow: { borderRadius: Radius.md, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: Spacing.sm, alignItems: 'center' },
  addRowText: { fontSize: 14, fontWeight: '700' },
});
