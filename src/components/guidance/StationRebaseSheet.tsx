/**
 * StationRebaseSheet — bottom sheet to correct the ride estimate by picking
 * "내 열차가 지금 어느 역" from the current ride's station list. Selecting a
 * station hands its id back to the screen, which rebases guidance progress to
 * that position (anchor = now − cumulative ride seconds to the station). No
 * train-identity tracking — position-based time correction only.
 *
 * The origin, every hop's stop, and the 하차역 are all selectable. The app's
 * current-position estimate (if any) is flagged with a "지금 여기" marker so the
 * rider knows what they're correcting. Style grammar mirrors TrainSelectSheet's
 * `createStyles(semantic)`.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, X } from 'lucide-react-native';

import { useSemanticTokens } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import type { RideStep } from '@/models/guidance';

export interface StationRebaseSheetProps {
  readonly visible: boolean;
  /** 현재 탑승 중인 ride 스텝 (열릴 때 스냅샷으로 고정된 값 전달). */
  readonly step: RideStep;
  /** 앱의 추정 현재 위치 역 id — 없으면 "지금 여기" 마커 생략. */
  readonly currentStationId: string | null;
  /** 선택한 역 id 반환 — 화면이 해당 위치로 안내를 보정한다. */
  readonly onSelect: (stationId: string) => void;
  readonly onClose: () => void;
}

interface StationRow {
  readonly stationId: string;
  readonly stationName: string;
  readonly isAlight: boolean;
}

const buildRows = (step: RideStep): readonly StationRow[] => {
  const origin: StationRow = {
    stationId: step.fromStationId,
    stationName: step.fromStationName,
    isAlight: false,
  };
  const lastIndex = step.hops.length - 1;
  const hopRows = step.hops.map((hop, i): StationRow => ({
    stationId: hop.toStationId,
    stationName: hop.toStationName,
    isAlight: i === lastIndex,
  }));
  return [origin, ...hopRows];
};

type Styles = ReturnType<typeof createStyles>;

interface StationRebaseItemProps {
  readonly row: StationRow;
  readonly isHere: boolean;
  readonly styles: Styles;
  readonly semantic: WantedSemanticTheme;
  readonly onSelect: (stationId: string) => void;
}

const StationRebaseItem: React.FC<StationRebaseItemProps> = ({
  row,
  isHere,
  styles,
  semantic,
  onSelect,
}) => {
  const handlePress = useCallback((): void => onSelect(row.stationId), [onSelect, row.stationId]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={`${row.stationName}${isHere ? ', 지금 여기' : ''}${row.isAlight ? ', 하차역' : ''}`}
      testID={`station-rebase-item-${row.stationId}`}
    >
      <View style={[styles.itemDot, isHere && { backgroundColor: semantic.primaryNormal, borderWidth: 0 }]} />
      <View style={styles.itemTextWrap}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.itemTitle}>{row.stationName}</Text>
          {row.isAlight && (
            <View style={styles.alightBadge} testID={`station-rebase-alight-${row.stationId}`}>
              <Text style={styles.alightBadgeText}>하차</Text>
            </View>
          )}
          {isHere && (
            <View style={styles.hereBadge} testID={`station-rebase-here-${row.stationId}`}>
              <MapPin size={12} color={semantic.primaryNormal} strokeWidth={2.4} />
              <Text style={styles.hereBadgeText}>지금 여기</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const StationRebaseSheetImpl: React.FC<StationRebaseSheetProps> = ({
  visible,
  step,
  currentStationId,
  onSelect,
  onClose,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const rows = useMemo(() => buildRows(step), [step]);

  const renderItem = useCallback(
    ({ item }: { item: StationRow }): React.ReactElement => (
      <StationRebaseItem
        row={item}
        isHere={currentStationId !== null && item.stationId === currentStationId}
        styles={styles}
        semantic={semantic}
        onSelect={onSelect}
      />
    ),
    [currentStationId, styles, semantic, onSelect]
  );

  const keyExtractor = useCallback((item: StationRow): string => item.stationId, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          testID="station-rebase-backdrop"
        />
        <View style={styles.sheet} testID="station-rebase-sheet">
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>내 열차 위치 선택</Text>
              <Text style={styles.sheetSub}>지금 열차가 있는 역을 선택하면 도착 예측을 보정해요</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              testID="station-rebase-close"
            >
              <X size={20} color={semantic.labelAlt} strokeWidth={2.2} />
            </Pressable>
          </View>

          <FlatList
            data={rows}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
};

export const StationRebaseSheet = memo(StationRebaseSheetImpl);
StationRebaseSheet.displayName = 'StationRebaseSheet';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      // Modal scrim — matches TrainSelectSheet (no semantic token exists).
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
      minHeight: 48,
      paddingVertical: 8,
    },
    itemDot: {
      width: 14,
      height: 14,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 2,
      borderColor: semantic.lineNormal,
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
    alightBadge: {
      backgroundColor: semantic.primaryBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    alightBadgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
    },
    hereBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: semantic.primaryBg,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    hereBadgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
    },
  });
