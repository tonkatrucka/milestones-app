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
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { addGrowthEntry } from '@/services/growth';

export default function AddGrowthScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!activeChildId || !session?.user.id) return;

    const weightNum = weight ? parseFloat(weight) : undefined;
    const heightNum = height ? parseFloat(height) : undefined;
    const headNum = head ? parseFloat(head) : undefined;

    if (!weightNum && !heightNum && !headNum) {
      Alert.alert('Add at least one measurement', 'Enter weight, height, or head circumference.');
      return;
    }

    if (weightNum && (weightNum < 0.5 || weightNum > 50)) {
      Alert.alert('Invalid weight', 'Weight should be between 0.5 and 50 kg.');
      return;
    }
    if (heightNum && (heightNum < 30 || heightNum > 200)) {
      Alert.alert('Invalid height', 'Height should be between 30 and 200 cm.');
      return;
    }

    setIsLoading(true);
    try {
      await addGrowthEntry({
        childId: activeChildId,
        measuredAt: date.toISOString().split('T')[0],
        weightKg: weightNum,
        heightCm: heightNum,
        headCm: headNum,
        notes: notes.trim() || undefined,
        userId: session.user.id,
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save measurement.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerEmoji}>📏</Text>
          <Text style={[styles.headerTitle, { fontFamily: Fonts!.rounded }]}>Add measurement</Text>
        </View>

        <View style={styles.fields}>
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Date</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(_, d) => d && setDate(d)}
                maximumDate={new Date()}
                style={styles.datePicker}
              />
            ) : (
              <>
                <Pressable
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: colors.text }}>📅 {format(date, 'd MMM yyyy')}</Text>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, d) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && d) setDate(d);
                    }}
                  />
                )}
              </>
            )}
          </View>

          <NumberField label="Weight (kg)" placeholder="e.g. 7.25" value={weight} onChange={setWeight} colors={colors} />
          <NumberField label="Height / length (cm)" placeholder="e.g. 68.5" value={height} onChange={setHeight} colors={colors} />
          <NumberField label="Head circumference (cm)" placeholder="e.g. 42.3" value={head} onChange={setHead} colors={colors} />

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Measured at clinic"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }, isLoading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save measurement</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NumberField({
  label, placeholder, value, onChange, colors,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  colors: typeof Colors.light;
}) {
  return (
    <View>
      <Text style={[fieldStyles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 16 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 40 },
  header: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  headerEmoji: { fontSize: 40 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  fields: { padding: Spacing.lg, gap: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  datePicker: { marginLeft: -Spacing.sm, height: 120 },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15 },
  notesInput: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  button: { marginHorizontal: Spacing.lg, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
