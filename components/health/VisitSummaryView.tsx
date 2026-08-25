import { StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type {
  SnapshotStat,
  TableRow,
  VisitSection,
  VisitSummaryModel,
} from '@/lib/visit-summary';

export function VisitSummaryView({
  model,
  colors,
}: {
  model: VisitSummaryModel;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.text, fontFamily: Fonts!.rounded }]}>
        {model.title}
      </Text>
      {model.metaLines.map((line) => (
        <Text key={line} style={[styles.meta, { color: colors.muted }]}>
          {line}
        </Text>
      ))}
      <Text style={[styles.windowNote, { color: colors.muted }]}>{model.windowNote}</Text>
      {model.sections.map((section) => (
        <SectionCard key={section.number} section={section} colors={colors} />
      ))}
      <Text style={[styles.footer, { color: colors.muted }]}>{model.footer}</Text>
    </View>
  );
}

function SectionCard({
  section,
  colors,
}: {
  section: VisitSection;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
        <Text style={{ color: colors.muted }}>{section.number}. </Text>
        {section.title}
      </Text>
      {section.intro ? (
        <Text style={[styles.intro, { color: colors.muted }]}>{section.intro}</Text>
      ) : null}
      {section.leads?.map((line) => (
        <Text key={line} style={[styles.lead, { color: colors.text }]}>
          {line}
        </Text>
      ))}
      {section.stats ? <StatsGrid stats={section.stats} colors={colors} /> : null}
      {section.groups?.map((group) => (
        <View key={group.heading} style={styles.group}>
          <Text style={[styles.groupHeading, { color: colors.muted }]}>{group.heading}</Text>
          {group.items.map((item) => (
            <Text key={item} style={[styles.groupItem, { color: colors.text }]}>
              {item}
            </Text>
          ))}
        </View>
      ))}
      {section.columns && section.rows
        ? section.rows.map((row, index) => (
            <TableRowCard
              key={`${section.number}-${index}`}
              columns={section.columns!}
              row={row}
              colors={colors}
            />
          ))
        : null}
      {section.empty ? (
        <Text style={[styles.empty, { color: colors.muted }]}>{section.empty}</Text>
      ) : null}
      {section.notes?.map((note) => (
        <Text key={note} style={[styles.note, { color: colors.muted }]}>
          {note}
        </Text>
      ))}
    </View>
  );
}

function StatsGrid({
  stats,
  colors,
}: {
  stats: SnapshotStat[];
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.stats}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={[
            styles.stat,
            {
              backgroundColor: stat.alert ? colors.danger + '18' : colors.surface,
              borderColor: stat.alert ? colors.danger : colors.border,
            },
          ]}>
          <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
          <Text style={[styles.statValue, { color: stat.alert ? colors.danger : colors.text }]}>
            {stat.value}
          </Text>
          <Text style={[styles.statHint, { color: colors.muted }]}>{stat.hint}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRowCard({
  columns,
  row,
  colors,
}: {
  columns: string[];
  row: TableRow;
  colors: typeof Colors.light;
}) {
  return (
    <View
      style={[
        styles.tableRow,
        {
          backgroundColor: row.alert ? colors.danger + '14' : colors.surface,
          borderColor: row.alert ? colors.danger : colors.border,
        },
      ]}>
      {columns.map((column, i) => (
        <View key={column} style={styles.kvRow}>
          <Text style={[styles.kvKey, { color: colors.muted }]}>{column}</Text>
          <Text
            style={[
              styles.kvValue,
              { color: colors.text },
              (row.emphasis || row.alert) && styles.kvValueStrong,
              row.alert && { color: colors.danger },
            ]}>
            {row.cells[i] ?? '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  windowNote: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  section: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stat: {
    width: '47.5%',
    flexGrow: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.sm,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  group: {
    gap: 4,
  },
  groupHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.xs,
  },
  groupItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  tableRow: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.sm,
    gap: 4,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  kvKey: {
    width: 112,
    fontSize: 11,
    fontWeight: '700',
    paddingTop: 1,
  },
  kvValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  kvValueStrong: {
    fontWeight: '700',
  },
});
