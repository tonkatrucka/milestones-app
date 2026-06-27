import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Swipeable, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { differenceInMonths, differenceInYears, format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { Colors, Fonts, MemoryColor, MilestoneColors, Radius, Spacing } from '@/constants/theme';
import { ResolvedImage } from '@/components/media/ResolvedImage';
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/constants/milestone-templates';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResolvedMediaUrls } from '@/hooks/use-resolved-media-urls';
import { parseCalendarDate } from '@/lib/calendar-date';
import type { JourneyEntry, JourneyMonthSection } from '@/lib/timeline-sections';
import type { Memory, Milestone, MilestoneCategory } from '@/lib/database.types';

type FilterMode = 'all' | 'milestones' | 'memories';
type DateRange = 'all' | '3m' | '6m' | '12m';
type CategoryFilter = MilestoneCategory | 'all';

const SECTION_MAX_H = 8000;
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'All time',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last year',
};
const CATEGORIES: CategoryFilter[] = ['all', 'language', 'movement', 'development'];

const POLAROID_WIDTH = 96;
const POLAROID_IMAGE_SIZE = 88;

const DATE_COL_WIDTH = 44;
const MARKER_COL_WIDTH = 24;

const CATEGORY_ICONS: Record<MilestoneCategory, keyof typeof Ionicons.glyphMap> = {
  language: 'chatbubble',
  movement: 'walk',
  development: 'leaf',
};

const SWIPE_ACTION_WIDTH = 72;
const SWIPE_ACTIONS_WIDTH = SWIPE_ACTION_WIDTH * 2;


function formatChildAge(dob: string, achievedAt: string): string {
  const birth = parseCalendarDate(dob);
  const achieved = parseCalendarDate(achievedAt);
  const years = differenceInYears(achieved, birth);
  const months = differenceInMonths(achieved, birth) % 12;
  if (years === 0) return `${differenceInMonths(achieved, birth)} months`;
  if (months === 0) return `${years}yr`;
  return `${years}yr ${months}mo`;
}

function entryDate(entry: JourneyEntry): Date {
  return entry.kind === 'milestone'
    ? parseCalendarDate(entry.data.achieved_at)
    : parseCalendarDate(entry.data.occurred_at);
}

function passesDateRange(date: Date, range: DateRange): boolean {
  if (range === 'all') return true;
  const now = new Date();
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return date >= cutoff;
}

export interface JourneyTimelineProps {
  sections: JourneyMonthSection[];
  isLoading: boolean;
  childDob?: string | null;
  canWrite?: boolean;
  onRefresh: () => void;
  onMilestonePress: (milestone: Milestone) => void;
  onMemoryPress: (memory: Memory) => void;
  onMilestoneDelete: (milestone: Milestone) => void;
  onMemoryDelete: (memory: Memory) => void;
}

export function JourneyTimeline({
  sections,
  isLoading,
  childDob,
  canWrite = true,
  onRefresh,
  onMilestonePress,
  onMemoryPress,
  onMilestoneDelete,
  onMemoryDelete,
}: JourneyTimelineProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tabBarHeight = useBottomTabBarHeight();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [subFilterOpen, setSubFilterOpen] = useState<'milestones' | 'memories' | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const filterBarRef = useRef<View>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const openPhotoLightbox = useCallback((urls: string[], index: number) => {
    setLightbox({ urls, index });
  }, []);

  const closePhotoLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const openSubFilterPopover = useCallback((mode: 'milestones' | 'memories') => {
    filterBarRef.current?.measureInWindow((x, y, _width, height) => {
      setPopoverAnchor({ top: y + height, left: x, width: _width });
      setSubFilterOpen(mode);
    });
  }, []);

  const handleFilterChange = useCallback(
    (next: FilterMode) => {
      if (next === 'all' || next === 'memories') {
        setFilter(next);
        setSubFilterOpen(null);
        return;
      }
      setFilter(next);
      if (subFilterOpen === next) {
        setSubFilterOpen(null);
      } else {
        openSubFilterPopover(next);
      }
    },
    [subFilterOpen, openSubFilterPopover],
  );

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => {
        const entries = section.entries.filter((entry) => {
          if (filter === 'milestones' && entry.kind !== 'milestone') return false;
          if (filter === 'memories' && entry.kind !== 'memory') return false;
          if (filter === 'milestones' && entry.kind === 'milestone' && category !== 'all') {
            if (entry.data.category !== category) return false;
          }
          if (!passesDateRange(entryDate(entry), dateRange)) return false;
          return true;
        });
        if (entries.length === 0) return null;
        return { ...section, entries };
      })
      .filter((s): s is JourneyMonthSection & { entries: JourneyEntry[] } => s !== null);
  }, [sections, filter, category, dateRange]);

  return (
    <GHScrollView
      style={styles.timelineScroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg, paddingHorizontal: Spacing.md }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
      }>
      <View style={[styles.filterSection, { borderBottomColor: colors.border }]}>
        <View ref={filterBarRef} collapsable={false}>
          <FilterTabs filter={filter} onChange={handleFilterChange} colors={colors} />
        </View>
        <DateRangeRow range={dateRange} onChange={setDateRange} colors={colors} />
      </View>

      <SubFilterPopover
        visible={subFilterOpen !== null}
        anchor={popoverAnchor}
        mode={subFilterOpen}
        category={category}
        onCategoryChange={setCategory}
        onDismiss={() => setSubFilterOpen(null)}
        colors={colors}
      />

      {filteredSections.map((section, idx) => (
        <CollapsibleSection
          key={section.monthKey}
          section={section}
          initiallyCollapsed={idx >= 2}
          childDob={childDob}
          canWrite={canWrite}
          onMilestonePress={onMilestonePress}
          onMemoryPress={onMemoryPress}
          onMilestoneDelete={onMilestoneDelete}
          onMemoryDelete={onMemoryDelete}
          onPhotoPress={openPhotoLightbox}
          colors={colors}
        />
      ))}

      <PhotoLightbox lightbox={lightbox} onClose={closePhotoLightbox} />

      {filteredSections.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>The journey begins here</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Add milestones and memories to build your timeline.
          </Text>
        </View>
      )}
    </GHScrollView>
  );
}

function FilterTabs({
  filter,
  onChange,
  colors,
}: {
  filter: FilterMode;
  onChange: (f: FilterMode) => void;
  colors: typeof Colors.light;
}) {
  const TABS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'milestones', label: '⭐ Milestones' },
    { key: 'memories', label: '📸 Memories' },
  ];

  return (
    <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
      {TABS.map((tab) => {
        const active = filter === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.filterTab, active && { borderBottomColor: colors.primary }]}
            onPress={() => onChange(tab.key)}>
            <Text style={[styles.filterTabText, { color: active ? colors.primary : colors.muted }]}>
              {tab.label}
              {tab.key === 'milestones' ? ' ▾' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubFilterPopover({
  visible,
  anchor,
  mode,
  category,
  onCategoryChange,
  onDismiss,
  colors,
}: {
  visible: boolean;
  anchor: { top: number; left: number; width: number } | null;
  mode: 'milestones' | 'memories' | null;
  category: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
  onDismiss: () => void;
  colors: typeof Colors.light;
}) {
  if (!visible || !anchor || mode !== 'milestones') return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.popoverBackdrop} onPress={onDismiss}>
        <Pressable
          style={[
            styles.popoverCard,
            {
              backgroundColor: colors.elevated,
              borderColor: colors.border,
              top: anchor.top + 4,
              left: Spacing.md,
              right: Spacing.md,
            },
          ]}
          onPress={() => {}}>
          <Text style={[styles.popoverLabel, { color: colors.muted }]}>Category</Text>
          <ScrollRow>
            {CATEGORIES.map((cat) => {
              const isActive = cat === category;
              const accent =
                cat === 'all' ? colors.primary : MilestoneColors[cat as MilestoneCategory];
              return (
                <FilterChip
                  key={cat}
                  label={
                    cat === 'all'
                      ? '✨ All'
                      : `${CATEGORY_EMOJIS[cat as MilestoneCategory]} ${CATEGORY_LABELS[cat as MilestoneCategory]}`
                  }
                  active={isActive}
                  accent={accent}
                  onPress={() => onCategoryChange(cat)}
                />
              );
            })}
          </ScrollRow>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.subFilterRow}>
      {children}
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterChip, { backgroundColor: active ? accent : accent + '22' }]}
      onPress={onPress}>
      <Text style={[styles.filterChipText, { color: active ? '#fff' : accent }]}>{label}</Text>
    </Pressable>
  );
}

function DateRangeRow({
  range,
  onChange,
  colors,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
  colors: typeof Colors.light;
}) {
  const ranges: DateRange[] = ['all', '3m', '6m', '12m'];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.subFilterRow}>
      {ranges.map((r) => {
        const active = range === r;
        return (
          <Pressable
            key={r}
            style={[
              styles.dateChip,
              {
                backgroundColor: active ? colors.primary + '22' : 'transparent',
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(r)}>
            <Text style={[styles.dateChipText, { color: active ? colors.primary : colors.muted }]}>
              {DATE_RANGE_LABELS[r]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CollapsibleSection({
  section,
  initiallyCollapsed,
  childDob,
  canWrite = true,
  onMilestonePress,
  onMemoryPress,
  onMilestoneDelete,
  onMemoryDelete,
  onPhotoPress,
  colors,
}: {
  section: JourneyMonthSection;
  initiallyCollapsed: boolean;
  childDob?: string | null;
  canWrite?: boolean;
  onMilestonePress: (m: Milestone) => void;
  onMemoryPress: (m: Memory) => void;
  onMilestoneDelete: (m: Milestone) => void;
  onMemoryDelete: (m: Memory) => void;
  onPhotoPress: (urls: string[], index: number) => void;
  colors: typeof Colors.light;
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const contentH = useSharedValue(initiallyCollapsed ? 0 : SECTION_MAX_H);
  const chevronRot = useSharedValue(initiallyCollapsed ? -90 : 0);
  const openSwipeableRef = useRef<Swipeable | null>(null);

  const handleSwipeableWillOpen = useCallback((ref: Swipeable) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    contentH.value = withTiming(next ? 0 : SECTION_MAX_H, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
    chevronRot.value = withTiming(next ? -90 : 0, { duration: 300 });
  }, [collapsed, contentH, chevronRot]);

  const contentStyle = useAnimatedStyle(() => ({
    maxHeight: contentH.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));

  return (
    <View style={styles.sectionWrapper}>
      <Pressable
        style={[styles.sectionHeader, { borderBottomColor: colors.border }]}
        onPress={toggle}>
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[styles.sectionMonth, { color: colors.text, fontFamily: Fonts!.rounded }]}
            numberOfLines={1}>
            {section.label}
          </Text>
          <Text style={[styles.sectionAge, { color: colors.muted }]}>{section.ageLabel}</Text>
          {(section.milestones.length > 0 || section.memories.length > 0) && (
            <Text style={[styles.sectionCounts, { color: colors.muted }]} numberOfLines={1}>
              {[
                section.milestones.length > 0
                  ? `${section.milestones.length} milestone${section.milestones.length !== 1 ? 's' : ''}`
                  : null,
                section.memories.length > 0
                  ? `${section.memories.length} memor${section.memories.length !== 1 ? 'ies' : 'y'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          <View style={styles.sectionHeaderSpacer} />
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          </Animated.View>
        </View>
      </Pressable>

      <Animated.View style={[contentStyle, collapsed ? styles.sectionContentCollapsed : styles.sectionContentExpanded]}>
        <View style={styles.storyList}>
          <View
            style={[
              styles.continuousLine,
              {
                backgroundColor: colors.border,
                left: DATE_COL_WIDTH + MARKER_COL_WIDTH / 2 - 1,
              },
            ]}
          />
          {section.entries.map((entry, index) => (
            <StoryPage
              key={`${entry.kind}-${entry.data.id}`}
              entry={entry}
              index={index}
              childDob={childDob}
              canWrite={canWrite}
              colors={colors}
              onMilestonePress={onMilestonePress}
              onMemoryPress={onMemoryPress}
              onMilestoneDelete={onMilestoneDelete}
              onMemoryDelete={onMemoryDelete}
              onPhotoPress={onPhotoPress}
              onSwipeableWillOpen={handleSwipeableWillOpen}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function SwipeableStoryCard({
  canWrite = true,
  onEdit,
  onDelete,
  onSwipeableWillOpen,
  colors,
  children,
}: {
  canWrite?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
  colors: typeof Colors.light;
  children: React.ReactNode;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  const closeAnd = useCallback((action: () => void) => {
    swipeableRef.current?.close();
    action();
  }, []);

  if (!canWrite) {
    return <View style={styles.swipeableContainer}>{children}</View>;
  }

  const renderRightActions = useCallback(
    () => (
      <View style={styles.swipeActions}>
        <Pressable
          style={[styles.swipeAction, { backgroundColor: colors.primary }]}
          onPress={() => closeAnd(onEdit)}
          accessibilityRole="button"
          accessibilityLabel="Edit">
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.swipeActionText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.swipeAction, { backgroundColor: colors.danger }]}
          onPress={() => closeAnd(onDelete)}
          accessibilityRole="button"
          accessibilityLabel="Delete">
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    ),
    [closeAnd, colors.primary, onDelete, onEdit],
  );

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootRight={false}
      rightThreshold={SWIPE_ACTIONS_WIDTH / 3}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current) onSwipeableWillOpen(swipeableRef.current);
      }}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeableContainer}>
      {children}
    </Swipeable>
  );
}

function StoryTimelineShell({
  date,
  accent,
  iconName,
  children,
  colors,
  index,
}: {
  date: Date;
  accent: string;
  iconName: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  colors: typeof Colors.light;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320).delay(index * 40).springify()}
      style={styles.entryRow}>
      <View style={styles.dateCol}>
        <Text style={[styles.dateText, { color: colors.muted }]}>{format(date, 'd MMM')}</Text>
        <Text style={[styles.dateSubText, { color: colors.muted }]}>{format(date, 'yyyy')}</Text>
      </View>

      <View style={styles.markerCol}>
        <View style={[styles.markerCircle, { backgroundColor: accent }]}>
          <Ionicons name={iconName} size={13} color="#fff" />
        </View>
      </View>

      <View style={styles.cardCol}>
        <View style={styles.storyPageClip}>{children}</View>
      </View>
    </Animated.View>
  );
}

function StoryPage({
  entry,
  index,
  childDob,
  canWrite = true,
  colors,
  onMilestonePress,
  onMemoryPress,
  onMilestoneDelete,
  onMemoryDelete,
  onPhotoPress,
  onSwipeableWillOpen,
}: {
  entry: JourneyEntry;
  index: number;
  childDob?: string | null;
  canWrite?: boolean;
  colors: typeof Colors.light;
  onMilestonePress: (m: Milestone) => void;
  onMemoryPress: (m: Memory) => void;
  onMilestoneDelete: (m: Milestone) => void;
  onMemoryDelete: (m: Memory) => void;
  onPhotoPress: (urls: string[], index: number) => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
}) {
  if (entry.kind === 'milestone') {
    return (
      <MilestoneStoryPage
        milestone={entry.data}
        index={index}
        childDob={childDob}
        canWrite={canWrite}
        colors={colors}
        onPress={() => onMilestonePress(entry.data)}
        onDelete={() => onMilestoneDelete(entry.data)}
        onPhotoPress={onPhotoPress}
        onSwipeableWillOpen={onSwipeableWillOpen}
      />
    );
  }
  return (
    <MemoryStoryPage
      memory={entry.data}
      index={index}
      canWrite={canWrite}
      colors={colors}
      onPress={() => onMemoryPress(entry.data)}
      onDelete={() => onMemoryDelete(entry.data)}
      onPhotoPress={onPhotoPress}
      onSwipeableWillOpen={onSwipeableWillOpen}
    />
  );
}

function PhotoLightbox({
  lightbox,
  onClose,
}: {
  lightbox: { urls: string[]; index: number } | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { urls: resolvedUrls } = useResolvedMediaUrls(lightbox?.urls ?? []);

  useEffect(() => {
    if (!lightbox) return;
    setActiveIndex(lightbox.index);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: lightbox.index * width, animated: false });
    });
  }, [lightbox, width]);

  if (!lightbox) return null;

  const imageHeight = Math.min(height * 0.72, width * 1.2);
  const displayUrls = resolvedUrls.length > 0 ? resolvedUrls : lightbox.urls;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightboxBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
        <Pressable style={styles.lightboxCloseBtn} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          style={styles.lightboxScroll}>
          {displayUrls.map((uri) => (
            <View key={uri} style={[styles.lightboxPage, { width, height: imageHeight }]}>
              <Image
                source={{ uri }}
                style={{ width: width - Spacing.lg * 2, height: imageHeight }}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>
        {displayUrls.length > 1 ? (
          <Text style={styles.lightboxCounter}>
            {activeIndex + 1} / {displayUrls.length}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

function Polaroid({
  uri,
  caption,
  colors,
  onPress,
}: {
  uri: string;
  caption?: string;
  colors: typeof Colors.light;
  onPress: () => void;
}) {
  const hasCaption = Boolean(caption?.trim());
  return (
    <Pressable
      style={[styles.polaroid, !hasCaption && styles.polaroidNoCaption, { backgroundColor: colors.elevated }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View photo">
      <View style={[styles.polaroidImageFrame, { backgroundColor: colors.inputBackground }]}>
        <ResolvedImage stored={uri} style={styles.polaroidImage} contentFit="contain" />
      </View>
      {hasCaption ? (
        <Text style={[styles.polaroidCaption, { color: colors.muted }]} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

function PolaroidRow({
  urls,
  caption,
  colors,
  onPhotoPress,
}: {
  urls: string[];
  caption?: string;
  colors: typeof Colors.light;
  onPhotoPress: (urls: string[], index: number) => void;
}) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <View style={styles.polaroidRowSingle}>
        <Polaroid
          uri={urls[0]}
          caption={caption}
          colors={colors}
          onPress={() => onPhotoPress(urls, 0)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.polaroidScroll}
      contentContainerStyle={styles.polaroidRow}>
      {urls.map((uri, i) => (
        <Polaroid
          key={`${uri}-${i}`}
          uri={uri}
          caption={
            caption?.trim()
              ? urls.length > 1
                ? `${caption} (${i + 1})`
                : caption
              : undefined
          }
          colors={colors}
          onPress={() => onPhotoPress(urls, i)}
        />
      ))}
    </ScrollView>
  );
}

function MilestoneStoryPage({
  milestone,
  index,
  childDob,
  canWrite = true,
  colors,
  onPress,
  onDelete,
  onPhotoPress,
  onSwipeableWillOpen,
}: {
  milestone: Milestone;
  index: number;
  childDob?: string | null;
  canWrite?: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  onDelete: () => void;
  onPhotoPress: (urls: string[], index: number) => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
}) {
  const category = milestone.category as MilestoneCategory;
  const accent = MilestoneColors[category];
  const date = parseCalendarDate(milestone.achieved_at);
  const story =
    milestone.description?.trim() ||
    `A ${CATEGORY_LABELS[category].toLowerCase()} milestone worth celebrating.`;
  const photoAlign = index % 2 === 0 ? styles.storyPhotoLeft : styles.storyPhotoRight;

  return (
    <StoryTimelineShell
      date={date}
      accent={accent}
      iconName={CATEGORY_ICONS[category]}
      colors={colors}
      index={index}>
      <SwipeableStoryCard
        canWrite={canWrite}
        onEdit={onPress}
        onDelete={onDelete}
        onSwipeableWillOpen={onSwipeableWillOpen}
        colors={colors}>
        <View
          style={[
            styles.storyPage,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <Pressable
            style={styles.storyPageInner}
            onPress={onPress}
            android_ripple={{ color: accent + '22' }}>
            <Text style={[styles.storyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              {milestone.title}
            </Text>

            {childDob ? (
              <Text style={[styles.storyAge, { color: accent }]}>
                {formatChildAge(childDob, milestone.achieved_at)} old
              </Text>
            ) : null}

            <Text style={[styles.storyBody, { color: colors.text }]}>{story}</Text>
          </Pressable>

          {milestone.media_urls.length > 0 ? (
            <View style={[photoAlign, styles.storyPhotoSection]}>
              <PolaroidRow
                urls={milestone.media_urls.slice(0, 4)}
                caption={milestone.title}
                colors={colors}
                onPhotoPress={onPhotoPress}
              />
            </View>
          ) : (
            <View style={[styles.storyEmojiPlaceholder, { backgroundColor: accent + '14' }]}>
              <Text style={styles.storyEmojiLarge}>{CATEGORY_EMOJIS[category]}</Text>
            </View>
          )}
        </View>
      </SwipeableStoryCard>
    </StoryTimelineShell>
  );
}

function MemoryStoryPage({
  memory,
  index,
  canWrite = true,
  colors,
  onPress,
  onDelete,
  onPhotoPress,
  onSwipeableWillOpen,
}: {
  memory: Memory;
  index: number;
  canWrite?: boolean;
  colors: typeof Colors.light;
  onPress: () => void;
  onDelete: () => void;
  onPhotoPress: (urls: string[], index: number) => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
}) {
  const date = parseCalendarDate(memory.occurred_at);
  const story =
    memory.description?.trim() || 'A precious moment captured in time.';
  const photoAlign = index % 2 === 0 ? styles.storyPhotoRight : styles.storyPhotoLeft;

  return (
    <StoryTimelineShell
      date={date}
      accent={MemoryColor}
      iconName="camera"
      colors={colors}
      index={index}>
      <SwipeableStoryCard
        canWrite={canWrite}
        onEdit={onPress}
        onDelete={onDelete}
        onSwipeableWillOpen={onSwipeableWillOpen}
        colors={colors}>
        <View
          style={[
            styles.storyPage,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          <Pressable
            style={styles.storyPageInner}
            onPress={onPress}
            android_ripple={{ color: MemoryColor + '22' }}>
            <Text style={[styles.storyTitle, { color: colors.text, fontFamily: Fonts!.rounded }]}>
              {memory.title}
            </Text>

            <Text style={[styles.storyBody, { color: colors.text }]}>{story}</Text>

            {memory.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {memory.tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={[styles.tagPill, { backgroundColor: MemoryColor + '15' }]}>
                    <Text style={[styles.tagText, { color: MemoryColor }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>

          {memory.media_urls.length > 0 ? (
            <View style={[photoAlign, styles.storyPhotoSection]}>
              <PolaroidRow
                urls={memory.media_urls.slice(0, 4)}
                colors={colors}
                onPhotoPress={onPhotoPress}
              />
            </View>
          ) : (
            <View style={[styles.storyEmojiPlaceholder, { backgroundColor: MemoryColor + '14' }]}>
              <Text style={styles.storyEmojiLarge}>📸</Text>
            </View>
          )}
        </View>
      </SwipeableStoryCard>
    </StoryTimelineShell>
  );
}

const styles = StyleSheet.create({
  timelineScroll: {
    flex: 1,
    width: '100%',
  },
  filterSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  filterBar: {
    flexDirection: 'row',
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabText: { fontSize: 13, fontWeight: '600' },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  popoverCard: {
    position: 'absolute',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  popoverLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  subFilterRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  dateChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 12, fontWeight: '600' },
  sectionWrapper: {
    marginBottom: Spacing.md,
  },
  sectionContentCollapsed: {
    overflow: 'hidden',
  },
  sectionContentExpanded: {
    overflow: 'visible',
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  sectionHeaderSpacer: { flex: 1, minWidth: 8 },
  sectionMonth: { fontSize: 15, fontWeight: '700' },
  sectionAge: { fontSize: 12, fontWeight: '500' },
  sectionCounts: { fontSize: 11, fontWeight: '500', flexShrink: 1 },
  storyList: {
    position: 'relative',
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    width: '100%',
  },
  continuousLine: {
    position: 'absolute',
    top: 20,
    bottom: 24,
    width: 2,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    width: '100%',
  },
  dateCol: {
    width: DATE_COL_WIDTH,
    paddingRight: Spacing.xs,
    alignItems: 'flex-end',
    paddingTop: 6,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
  },
  dateSubText: {
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'right',
    marginTop: 1,
    opacity: 0.75,
  },
  markerCol: {
    width: MARKER_COL_WIDTH,
    alignItems: 'center',
    paddingTop: 4,
    zIndex: 1,
  },
  markerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  storyPageClip: {
    width: '100%',
    maxWidth: '100%',
  },
  swipeableContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  swipeActions: {
    width: SWIPE_ACTIONS_WIDTH,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  storyPage: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  storyPageInner: {
    padding: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  storyPhotoSection: {
    paddingHorizontal: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  storyAge: {
    fontSize: 11,
    fontWeight: '600',
  },
  storyBody: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.92,
  },
  storyPhotoLeft: {
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
    width: '100%',
  },
  storyPhotoRight: {
    alignItems: 'flex-start',
    marginTop: Spacing.xs,
    width: '100%',
  },
  storyEmojiPlaceholder: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  storyEmojiLarge: {
    fontSize: 28,
  },
  polaroidScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  polaroidRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  polaroidRowSingle: {
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  polaroid: {
    width: POLAROID_WIDTH,
    maxWidth: '100%',
    paddingTop: 5,
    paddingHorizontal: 5,
    paddingBottom: 14,
    borderRadius: 2,
  },
  polaroidNoCaption: {
    paddingBottom: 5,
  },
  polaroidImageFrame: {
    width: POLAROID_IMAGE_SIZE,
    height: POLAROID_IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  polaroidImage: {
    width: POLAROID_IMAGE_SIZE,
    height: POLAROID_IMAGE_SIZE,
  },
  polaroidCaption: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
    fontStyle: 'italic',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 },
  tagPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 48,
    right: Spacing.md,
    zIndex: 2,
    padding: Spacing.xs,
  },
  lightboxScroll: {
    flexGrow: 0,
  },
  lightboxPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCounter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
});
