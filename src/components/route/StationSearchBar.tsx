import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface StationLite {
  id: string;
  name: string;
}

interface Props {
  fromStation: StationLite | null;
  toStation: StationLite | null;
  onPressFrom: () => void;
  onPressTo: () => void;
  onSwap: () => void;
}

export const StationSearchBar: React.FC<Props> = ({
  fromStation,
  toStation,
  onPressFrom,
  onPressTo,
  onSwap,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  return (
    <View style={styles.card} testID="search-bar-card">
      <Pressable
        style={styles.row}
        onPress={onPressFrom}
        testID="search-bar-from-row"
        accessibilityRole="button"
        accessibilityLabel="출발역 선택"
      >
        <View style={[styles.dot, { backgroundColor: semantic.labelAlt }]} />
        <Text
          style={[styles.field, !fromStation && { color: semantic.labelAlt }]}
          numberOfLines={1}
        >
          {fromStation ? fromStation.name : '출발역을 입력하세요'}
        </Text>
        <Text style={styles.endpointLabel}>출발</Text>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: semantic.lineSubtle }]} />

      <Pressable
        style={styles.row}
        onPress={onPressTo}
        testID="search-bar-to-row"
        accessibilityRole="button"
        accessibilityLabel="도착역 선택"
      >
        <View style={[styles.dot, { backgroundColor: semantic.primaryNormal }]} />
        <Text
          style={[styles.field, !toStation && { color: semantic.labelAlt }]}
          numberOfLines={1}
        >
          {toStation ? toStation.name : '도착역을 입력하세요'}
        </Text>
        <Text style={styles.endpointLabel}>도착</Text>
        <Pressable
          onPress={onSwap}
          hitSlop={8}
          style={styles.swap}
          testID="search-bar-swap"
          accessibilityRole="button"
          accessibilityLabel="출발역과 도착역 바꾸기"
        >
          <ArrowUpDown size={16} color={semantic.labelAlt} strokeWidth={1.7} />
        </Pressable>
      </Pressable>
    </View>
  );
};

StationSearchBar.displayName = 'StationSearchBar';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s3,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    field: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.body1.size,
      lineHeight: WANTED_TOKENS.type.body1.lh,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    endpointLabel: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    swap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgSubtle,
    },
    divider: {
      height: 1,
      marginVertical: 2,
    },
  });
