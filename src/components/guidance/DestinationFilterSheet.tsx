/**
 * DestinationFilterSheet — bottom sheet to pick which 종점행 trains the guidance
 * (안내·알림) should track while waiting. 다중 선택인 이유: 분기 이전 하차 시 복수
 * 종점행이 모두 유효하기 때문 (예: 5호선 마천·하남검단산 둘 다 강동까지 간다).
 * 선택 없음 = "전체 열차" = 필터 해제.
 *
 * Style grammar mirrors TrainSelectSheet's `createStyles(semantic)`.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, TrainFront, X } from 'lucide-react-native';

import { useSemanticTokens } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import type { DestinationOption } from '@/services/guidance/destinationPreference';

export interface DestinationFilterSheetProps {
  readonly visible: boolean;
  /** 표시 후보 종점행 (도착 임박 순 + 저장돼 있으나 현재 미도착인 선호) */
  readonly options: readonly DestinationOption[];
  /** 현재 선택된 종점행 이름들 (빈 배열 = 전체 열차) */
  readonly selected: readonly string[];
  readonly onToggle: (name: string) => void;
  /** 전체 열차 = 종점행 필터 해제 */
  readonly onClear: () => void;
  readonly onClose: () => void;
}

const NO_ETA_TEXT = '지금은 도착 정보 없음';

type Styles = ReturnType<typeof createStyles>;

interface DestinationOptionRowProps {
  readonly option: DestinationOption;
  readonly checked: boolean;
  readonly styles: Styles;
  readonly semantic: WantedSemanticTheme;
  readonly onToggle: (name: string) => void;
}

const DestinationOptionRow: React.FC<DestinationOptionRowProps> = ({
  option,
  checked,
  styles,
  semantic,
  onToggle,
}) => {
  const handlePress = useCallback((): void => onToggle(option.name), [onToggle, option.name]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.item}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${option.name}행${option.etaText !== null ? `, ${option.etaText}` : ''}`}
      testID={`destination-option-${option.name}`}
    >
      <View style={styles.itemIcon}>
        <TrainFront size={18} color={semantic.primaryNormal} strokeWidth={2.2} />
      </View>
      <View style={styles.itemTextWrap}>
        <Text style={styles.itemTitle}>{`${option.name}행`}</Text>
        <Text style={styles.itemSub}>{option.etaText ?? NO_ETA_TEXT}</Text>
      </View>
      {checked && (
        <View style={styles.checkMark} testID={`destination-check-${option.name}`}>
          <Check size={16} color={semantic.primaryNormal} strokeWidth={2.6} />
        </View>
      )}
    </Pressable>
  );
};

const DestinationFilterSheetImpl: React.FC<DestinationFilterSheetProps> = ({
  visible,
  options,
  selected,
  onToggle,
  onClear,
  onClose,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const allActive = selected.length === 0;

  const renderItem = useCallback(
    ({ item }: { item: DestinationOption }): React.ReactElement => (
      <DestinationOptionRow
        option={item}
        checked={selected.includes(item.name)}
        styles={styles}
        semantic={semantic}
        onToggle={onToggle}
      />
    ),
    [selected, styles, semantic, onToggle]
  );

  const keyExtractor = useCallback((item: DestinationOption): string => item.name, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          testID="destination-filter-backdrop"
        />
        <View style={styles.sheet} testID="destination-filter-sheet">
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>탈 열차의 종점행 선택</Text>
              <Text style={styles.sheetSub}>선택한 종점행 열차만 안내와 알림에 사용해요</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              testID="destination-filter-close"
            >
              <X size={20} color={semantic.labelAlt} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* FlatList의 형제로 고정 — ListHeaderComponent 인라인 정의는 매 렌더 리마운트되어 탭을 먹는다. */}
          <Pressable
            onPress={onClear}
            style={styles.allRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allActive }}
            accessibilityLabel="전체 열차, 종점행 필터 해제"
            testID="destination-filter-all"
          >
            <Text style={styles.allTitle}>전체 열차</Text>
            {allActive && (
              <View style={styles.checkMark} testID="destination-all-active">
                <Check size={16} color={semantic.primaryNormal} strokeWidth={2.6} />
              </View>
            )}
          </Pressable>

          <FlatList
            data={options}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={selected}
            style={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
};

export const DestinationFilterSheet = memo(DestinationFilterSheetImpl);
DestinationFilterSheet.displayName = 'DestinationFilterSheet';

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
    allRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      marginTop: WANTED_TOKENS.spacing.s4,
      paddingVertical: 12,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: 14,
      backgroundColor: semantic.bgSubtle,
    },
    allTitle: {
      fontSize: 15,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    list: {
      marginTop: WANTED_TOKENS.spacing.s3,
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
    itemTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.16,
    },
    itemSub: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    checkMark: {
      width: 28,
      height: 28,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
