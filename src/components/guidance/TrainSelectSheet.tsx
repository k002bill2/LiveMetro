/**
 * TrainSelectSheet — bottom sheet to retroactively pick "the train I actually
 * boarded" (대기: 이미 탔어요) or "the train I switched to" (ride: 열차 변경).
 * Selecting an entry hands its departure epoch-ms back to the screen, which
 * rebases guidance progress to that moment. No train-identity tracking — time
 * correction only. A "방금 출발했어요" fallback (= now) is always present so an
 * empty log never blocks the flow.
 *
 * `nowMs` is read once per render (the sheet is short-lived — no 1Hz tick).
 * Style grammar mirrors GuidanceNowCard's `createStyles(semantic)`.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TrainFront, X } from 'lucide-react-native';

import { useSemanticTokens } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import type { DepartedTrainEntry } from '@/services/guidance/departedTrainLog';

export interface TrainSelectSheetProps {
  readonly visible: boolean;
  /** 최근 출발 후보 (이미 역/노선/세션 필터링된 상태로 전달됨) */
  readonly entries: readonly DepartedTrainEntry[];
  /** 항목 또는 "방금 출발했어요" 폴백 선택 — 출발 시각 epoch ms */
  readonly onSelect: (departedAtMs: number) => void;
  readonly onClose: () => void;
}

const RECENT_DEPARTURE_MS = 60_000;

const departureText = (nowMs: number, departedAtMs: number): string => {
  const ago = nowMs - departedAtMs;
  if (ago < RECENT_DEPARTURE_MS) return '방금 출발';
  return `${Math.floor(ago / 60_000)}분 전 출발`;
};

type Styles = ReturnType<typeof createStyles>;

interface TrainSelectItemProps {
  readonly item: DepartedTrainEntry;
  readonly nowMs: number;
  readonly styles: Styles;
  readonly semantic: WantedSemanticTheme;
  readonly onSelect: (departedAtMs: number) => void;
}

const TrainSelectItem: React.FC<TrainSelectItemProps> = ({
  item,
  nowMs,
  styles,
  semantic,
  onSelect,
}) => {
  const timeText = departureText(nowMs, item.departedAtMs);
  const isEstimated = item.confidence === 'estimated';
  const handlePress = useCallback((): void => onSelect(item.departedAtMs), [onSelect, item.departedAtMs]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={`${item.finalDestination}행, ${timeText}${isEstimated ? ', 추정' : ''}`}
      testID={`train-select-item-${item.trainId}`}
    >
      <View style={styles.itemIcon}>
        <TrainFront size={18} color={semantic.primaryNormal} strokeWidth={2.2} />
      </View>
      <View style={styles.itemTextWrap}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemTitle}>{`${item.finalDestination}행`}</Text>
          {isEstimated && (
            <View style={styles.estimatedBadge} testID={`train-select-badge-${item.trainId}`}>
              <Text style={styles.estimatedBadgeText}>추정</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemTime}>{timeText}</Text>
      </View>
    </Pressable>
  );
};

const TrainSelectSheetImpl: React.FC<TrainSelectSheetProps> = ({
  visible,
  entries,
  onSelect,
  onClose,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const nowMs = Date.now();

  const handleNow = useCallback((): void => onSelect(Date.now()), [onSelect]);

  const renderItem = useCallback(
    ({ item }: { item: DepartedTrainEntry }): React.ReactElement => (
      <TrainSelectItem
        item={item}
        nowMs={nowMs}
        styles={styles}
        semantic={semantic}
        onSelect={onSelect}
      />
    ),
    [nowMs, styles, semantic, onSelect]
  );

  const keyExtractor = useCallback((item: DepartedTrainEntry): string => item.trainId, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          testID="train-select-backdrop"
        />
        <View style={styles.sheet} testID="train-select-sheet">
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>탑승한 열차 선택</Text>
              <Text style={styles.sheetSub}>선택한 열차의 출발 시각으로 안내를 보정해요</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              testID="train-select-close"
            >
              <X size={20} color={semantic.labelAlt} strokeWidth={2.2} />
            </Pressable>
          </View>

          <FlatList
            data={entries}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={styles.list}
          />

          <Pressable
            onPress={handleNow}
            style={styles.fallback}
            accessibilityRole="button"
            accessibilityLabel="방금 출발했어요, 지금 기준으로 진행"
            testID="train-select-now"
          >
            <Text style={styles.fallbackTitle}>방금 출발했어요</Text>
            <Text style={styles.fallbackSub}>지금 기준으로 진행</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export const TrainSelectSheet = memo(TrainSelectSheetImpl);
TrainSelectSheet.displayName = 'TrainSelectSheet';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      // Modal scrim — matches SettingPicker/VibrationPicker (no semantic token exists).
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: semantic.bgBase,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s6,
      maxHeight: '70%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    sheetTitleWrap: {
      flex: 1,
    },
    sheetTitle: {
      fontSize: 19,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.19,
    },
    sheetSub: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 4,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      marginTop: WANTED_TOKENS.spacing.s4,
      flexGrow: 0,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 10,
    },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemTextWrap: {
      flex: 1,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    itemTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.16,
    },
    estimatedBadge: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    estimatedBadgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    itemTime: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    fallback: {
      minHeight: 44,
      marginTop: WANTED_TOKENS.spacing.s4,
      paddingVertical: 12,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: 14,
      backgroundColor: semantic.bgSubtle,
    },
    fallbackTitle: {
      fontSize: 15,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    fallbackSub: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
  });
