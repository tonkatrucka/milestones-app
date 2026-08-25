import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAppStore } from '@/store/app-store';
import { useMemberRole } from '@/hooks/use-member-role';
import { useSolidFoods } from '@/hooks/use-solid-foods';
import { addSolidFood, deleteSolidFood } from '@/services/solid-foods';
import type { FoodReaction } from '@/lib/database.types';

const REACTIONS: { value: FoodReaction; label: string; color: string }[] = [
  { value: 'none', label: 'None', color: '#4CAF50' },
  { value: 'mild', label: 'Mild', color: '#FF9800' },
  { value: 'moderate', label: 'Moderate', color: '#FF5722' },
  { value: 'severe', label: 'Severe', color: '#F44336' },
];

export default function FoodsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const router = useRouter();
  const { session } = useAuth();
  const activeChildId = useAppStore((s) => s.activeChildId);
  const { canWrite } = useMemberRole(activeChildId, session?.user.id ?? null);
  const { foods, isLoading, refresh, addFood, removeFood } = useSolidFoods(activeChildId);

  const [showAdd, setShowAdd] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [isAllergen, setIsAllergen] = useState(false);
  const [reaction, setReaction] = useState<FoodReaction>('none');
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAdd = async () => {
    if (!activeChildId || !session?.user.id || !foodName.trim()) return;
    setIsSaving(true);
    try {
      const food = await addSolidFood({
        childId: activeChildId,
        foodName: foodName.trim(),
        introducedAt: new Date().toISOString().split('T')[0],
        isTopAllergen: isAllergen,
        reaction,
        userId: session.user.id,
      });
      addFood(food);
      setShowAdd(false);
      setFoodName('');
      setIsAllergen(false);
      setReaction('none');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Remove "${name}"?`, 'This will delete the food from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteSolidFood(id); removeFood(id); } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
          }
        },
      },
    ]);
  };

  const allergens = foods.filter((f) => f.is_top_allergen);
  const other = foods.filter((f) => !f.is_top_allergen);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
            Foods introduced
          </Text>
          {canWrite && (
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : foods.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🥕</Text>
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              Track solid foods
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Log each new food as you introduce it — allergens are flagged automatically.
            </Text>
            {canWrite && (
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowAdd(true)}>
                <Text style={styles.emptyBtnText}>Add first food</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {allergens.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>ALLERGENS TRIED</Text>
                {allergens.map((f) => (
                  <FoodRow key={f.id} food={f} colors={colors} onDelete={() => canWrite && handleDelete(f.id, f.food_name)} />
                ))}
              </>
            )}
            {other.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>OTHER FOODS</Text>
                {other.map((f) => (
                  <FoodRow key={f.id} food={f} colors={colors} onDelete={() => canWrite && handleDelete(f.id, f.food_name)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowAdd(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>Add food</Text>

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Food name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g. Peanut butter"
            placeholderTextColor={colors.muted}
            value={foodName}
            onChangeText={setFoodName}
            autoFocus
          />

          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Reaction</Text>
          <View style={styles.reactionRow}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r.value}
                style={[
                  styles.reactionChip,
                  { borderColor: r.color },
                  reaction === r.value && { backgroundColor: r.color },
                ]}
                onPress={() => setReaction(r.value)}>
                <Text style={[styles.reactionText, { color: reaction === r.value ? '#fff' : r.color }]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.allergenToggle, { borderColor: colors.border, backgroundColor: isAllergen ? colors.primary + '20' : colors.inputBackground }]}
            onPress={() => setIsAllergen((v) => !v)}>
            <Ionicons name={isAllergen ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isAllergen ? colors.primary : colors.muted} />
            <Text style={[styles.allergenText, { color: isAllergen ? colors.primary : colors.text }]}>
              Top allergen
            </Text>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary }, (!foodName.trim() || isSaving) && { opacity: 0.5 }]}
            onPress={handleAdd}
            disabled={!foodName.trim() || isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FoodRow({ food, colors, onDelete }: { food: import('@/lib/database.types').SolidFood; colors: typeof Colors.light; onDelete: () => void }) {
  const reactionColor = food.reaction === 'severe' ? '#F44336' : food.reaction === 'moderate' ? '#FF5722' : food.reaction === 'mild' ? '#FF9800' : '#4CAF50';
  return (
    <Pressable
      style={[styles.foodRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      onLongPress={onDelete}>
      <View style={styles.foodInfo}>
        <Text style={[styles.foodName, { color: colors.text }]}>{food.food_name}</Text>
        <Text style={[styles.foodDate, { color: colors.muted }]}>
          {format(parseISO(food.introduced_at), 'd MMM yyyy')}
          {food.is_top_allergen && ' · Allergen'}
        </Text>
      </View>
      {food.reaction && (
        <View style={[styles.reactionBadge, { backgroundColor: reactionColor + '20' }]}>
          <Text style={[styles.reactionBadgeText, { color: reactionColor }]}>
            {food.reaction.charAt(0).toUpperCase() + food.reaction.slice(1)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  title: { flex: 1, fontSize: 24, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: Spacing.xl },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  foodRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600' },
  foodDate: { fontSize: 12, marginTop: 2 },
  reactionBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  reactionBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reactionChip: { borderRadius: Radius.full, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  reactionText: { fontSize: 13, fontWeight: '600' },
  allergenToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  allergenText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
