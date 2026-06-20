import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { differenceInMinutes } from 'date-fns';

interface TimeSinceProps {
  date: string | Date | null;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  fallback?: string;
}

export function TimeSince({ date, style, prefix = '', fallback = '—' }: TimeSinceProps) {
  const [label, setLabel] = useState(() => formatLabel(date));

  useEffect(() => {
    if (!date) return;
    setLabel(formatLabel(date));
    const id = setInterval(() => setLabel(formatLabel(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return <Text style={style}>{label ? `${prefix}${label}` : fallback}</Text>;
}

function formatLabel(date: string | Date | null): string {
  if (!date) return '';
  try {
    const mins = differenceInMinutes(new Date(), new Date(date));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
    const days = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${days}d ${remH}h ago` : `${days}d ago`;
  } catch {
    return '';
  }
}
