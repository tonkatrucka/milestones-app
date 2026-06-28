import type { BreastSide, MealMetadata } from '@/lib/database.types';

const SIDE_LABELS: Record<BreastSide, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both',
};

export function formatBreastSide(side?: BreastSide): string {
  return side ? SIDE_LABELS[side] : '';
}

export function formatMealDetailParts(m: Partial<MealMetadata>): string[] {
  const parts: string[] = [];
  if (m.mealType) parts.push(m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1));

  if (m.mealType === 'breast') {
    const side = formatBreastSide(m.breastSide);
    if (side) parts.push(side);
    if (m.durationMins != null) parts.push(`${m.durationMins}m`);
    else if (m.amountMl != null) parts.push(`${m.amountMl}ml`);
  } else {
    if (m.amountMl != null) parts.push(`${m.amountMl}ml`);
    if (m.food) parts.push(m.food);
  }

  return parts;
}

export function formatMealDetail(m: Partial<MealMetadata>): string {
  return formatMealDetailParts(m).join(' · ');
}
