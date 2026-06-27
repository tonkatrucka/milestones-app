import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { pickImage } from '@/lib/pick-image';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDateInput, parseDateInput } from '@/lib/calendar-date';
import { uploadChildAvatar } from '@/services/media';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/lib/error-message';

export default function AddChildScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const addChild = useAppStore((s) => s.addChild);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickAvatar = async () => {
    const uris = await pickImage({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (uris?.[0]) setAvatarUri(uris[0]);
  };

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
    if (!session?.user.id) return;

    setIsLoading(true);
    try {
      let avatarUrl: string | null = null;
      const { data: child, error } = await supabase
        .from('children')
        .insert({ name: trimmedName, date_of_birth: dateOfBirth, created_by: session.user.id })
        .select()
        .single();

      if (error) throw error;
      if (!child) throw new Error('Child was created but could not be loaded. Please try again.');

      if (avatarUri) {
        try {
          avatarUrl = await uploadChildAvatar(child.id, avatarUri);
          await supabase.from('children').update({ avatar_url: avatarUrl }).eq('id', child.id);
        } catch {
          // Avatar upload failure is non-fatal
        }
      }

      addChild({ ...child, avatar_url: avatarUrl });
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e, 'Failed to save child.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
          Who are you tracking?
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Add your child's details to get started.
        </Text>

        {/* Avatar picker */}
        <Pressable style={styles.avatarContainer} onPress={pickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '22' }]}>
              <Text style={styles.avatarEmoji}>👶</Text>
              <Text style={[styles.avatarHint, { color: colors.primary }]}>Add photo</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.fields}>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Name</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="E.g. Emma"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              autoFocus
            />
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Date of birth</Text>
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
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
        </View>

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, isLoading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Let's go!</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: Spacing.lg,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  avatarContainer: {
    alignSelf: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: Radius.full,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarEmoji: { fontSize: 40 },
  avatarHint: { fontSize: 13, fontWeight: '600' },
  fields: {
    gap: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.md,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
