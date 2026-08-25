import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO, isFuture } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { useActiveChild } from '@/hooks/use-active-child';
import { useMemberRole } from '@/hooks/use-member-role';
import { useVaccinations } from '@/hooks/use-vaccinations';
import { addVaccination, deleteVaccination } from '@/services/vaccinations';
import { getScheduleWithDates, NIP_SCHEDULE_URL } from '@/constants/vaccination-schedules';

export default function VaccinationsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { activeChild } = useActiveChild(session?.user.id ?? null);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);
  const { records, isLoading, refresh, addRecord, removeRecord } = useVaccinations(activeChildId);

  const [showLog, setShowLog] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedDose, setSelectedDose] = useState(1);
  const [clinic, setClinic] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const schedule = activeChild
    ? getScheduleWithDates(activeChild.date_of_birth)
    : [];

  const givenCodes = new Set(records.map((r) => `${r.vaccine_code}-${r.dose_number}`));
  const upcoming = schedule
    .filter((v) => !givenCodes.has(`${v.code}-${v.doseNumber}`) && isFuture(v.dueDate))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const handleLogVaccine = (code: string, name: string, doseNumber = 1) => {
    setSelectedCode(code);
    setSelectedName(name);
    setSelectedDose(doseNumber);
    setClinic('');
    setBatchNo('');
    setShowLog(true);
  };

  const handleSave = async () => {
    if (!activeChildId || !session?.user.id || !selectedName) return;
    setIsSaving(true);
    try {
      const scheduleItem = schedule.find(
        (v) => v.code === selectedCode && v.doseNumber === selectedDose,
      );
      const record = await addVaccination({
        childId: activeChildId,
        vaccineCode: selectedCode || 'custom',
        vaccineName: selectedName,
        administeredAt: new Date().toISOString().split('T')[0],
        doseNumber: scheduleItem?.doseNumber ?? selectedDose,
        clinic: clinic.trim() || undefined,
        batchNumber: batchNo.trim() || undefined,
        userId: session.user.id,
      });
      addRecord(record);
      setShowLog(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Remove "${name}"?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteVaccination(id); removeRecord(id); } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Vaccinations
          </Text>
        </View>

        <Text style={[styles.source, { color: colors.muted }]}>
          Australian National Immunisation Program. Extra doses may apply for Aboriginal and Torres
          Strait Islander children and for some medical conditions.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(NIP_SCHEDULE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open the National Immunisation Program schedule">
          <Text style={[styles.sourceLink, { color: colors.primary }]}>
            View official NIP schedule
          </Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>COMING UP</Text>
                {upcoming.map((v) => (
                  <View key={`${v.code}-${v.doseNumber}`} style={[styles.upcomingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.upcomingInfo}>
                      <Text style={[styles.vaccineName, { color: colors.text }]}>{v.name}</Text>
                      <Text style={[styles.vaccineDate, { color: colors.muted }]}>
                        Due {format(v.dueDate, 'd MMM yyyy')}
                        {v.notes ? ` · ${v.notes}` : ''}
                      </Text>
                    </View>
                    {canWrite && (
                      <Pressable
                        style={[styles.logButton, { borderColor: colors.primary }]}
                        onPress={() => handleLogVaccine(v.code, v.name, v.doseNumber)}>
                        <Text style={[styles.logButtonText, { color: colors.primary }]}>Log</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </>
            )}

            {records.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>GIVEN</Text>
                {records.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[styles.givenRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onLongPress={() => canWrite && handleDelete(r.id, r.vaccine_name)}>
                    <Text style={styles.givenCheck}>✓</Text>
                    <View style={styles.givenInfo}>
                      <Text style={[styles.vaccineName, { color: colors.text }]}>{r.vaccine_name}</Text>
                      <Text style={[styles.vaccineDate, { color: colors.muted }]}>
                        {format(parseISO(r.administered_at), 'd MMM yyyy')}
                        {r.clinic ? ` · ${r.clinic}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {canWrite && (
              <Pressable
                style={[styles.customLogBtn, { borderColor: colors.border }]}
                onPress={() => handleLogVaccine('custom', 'Custom vaccine')}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.customLogText, { color: colors.primary }]}>Log custom vaccine</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showLog} transparent animationType="slide" onRequestClose={() => setShowLog(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowLog(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Log vaccine
          </Text>
          <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{selectedName}</Text>

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Clinic (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. GP clinic"
            placeholderTextColor={colors.muted}
            value={clinic}
            onChangeText={setClinic}
          />

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Batch number (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. A1234B"
            placeholderTextColor={colors.muted}
            value={batchNo}
            onChangeText={setBatchNo}
            autoCapitalize="characters"
          />

          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save vaccination</Text>}
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  title: { flex: 1, fontSize: 24, fontWeight: '800' },
  source: { fontSize: 13, lineHeight: 19 },
  sourceLink: { fontSize: 13, fontWeight: '700' },
  loader: { marginTop: Spacing.xl },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  upcomingInfo: { flex: 1 },
  vaccineName: { fontSize: 14, fontWeight: '600' },
  vaccineDate: { fontSize: 12, marginTop: 2 },
  logButton: { borderRadius: Radius.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  logButtonText: { fontSize: 13, fontWeight: '700' },
  givenRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, gap: Spacing.sm },
  givenCheck: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
  givenInfo: { flex: 1 },
  customLogBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, justifyContent: 'center' },
  customLogText: { fontSize: 14, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetSubtitle: { fontSize: 13, marginTop: -Spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15 },
  saveBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
