/**
 * StationDetailHeader — top bar + station hero block (Wanted Design System).
 *
 * Mirrors the design handoff:
 *   ◁                          ⤴ ★
 *   [LineBadge] [LineBadge]
 *   강남                          ← title1, weight 800
 *   Gangnam · 222 · 신분당 D07     ← caption with `label-alt`
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ChevronLeft, Share2, Star } from 'lucide-react-native';
import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { LineBadge, type LineId } from '@/components/design';

interface StationDetailHeaderProps {
  stationName: string;
  /** Sub-line such as "Gangnam · 222 · 신분당 D07" */
  subtitle?: string;
  /** One badge per line ID. Order is preserved. */
  lines: readonly LineId[];
  isFavorite: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
  testID?: string;
}

const StationDetailHeaderImpl: React.FC<StationDetailHeaderProps> = ({
  stationName,
  subtitle,
  lines,
  isFavorite,
  onBack,
  onShare,
  onToggleFavorite,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const titleStyle: TextStyle = {
    marginTop: WANTED_TOKENS.spacing.s3,
    fontSize: WANTED_TOKENS.type.title1.size,
    lineHeight: WANTED_TOKENS.type.title1.lh,
    letterSpacing: WANTED_TOKENS.type.title1.size * WANTED_TOKENS.type.title1.tracking,
    fontWeight: '800',
    color: semantic.labelStrong,
  };

  const subtitleStyle: TextStyle = {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.label2.size,
    lineHeight: WANTED_TOKENS.type.label2.lh,
    fontWeight: '600',
    color: semantic.labelAlt,
  };

  const iconColor = semantic.labelNeutral;
  const favoriteColor = isFavorite ? semantic.primaryNormal : semantic.labelNeutral;

  const topBarStyle: ViewStyle = {
    paddingTop: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const heroStyle: ViewStyle = {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingTop: WANTED_TOKENS.spacing.s3,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  };

  return (
    <View testID={testID}>
      <View style={topBarStyle}>
        <TouchableOpacity
          testID={testID ? `${testID}-back` : undefined}
          onPress={onBack}
          accessible
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <ChevronLeft size={26} strokeWidth={2} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.actionGroup}>
          <TouchableOpacity
            testID={testID ? `${testID}-share` : undefined}
            onPress={onShare}
            accessible
            accessibilityRole="button"
            accessibilityLabel="공유하기"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Share2 size={20} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity
            testID={testID ? `${testID}-favorite` : undefined}
            onPress={onToggleFavorite}
            accessible
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            accessibilityState={{ selected: isFavorite }}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.favoriteIcon}
          >
            <Star
              size={20}
              color={favoriteColor}
              fill={isFavorite ? favoriteColor : 'transparent'}
              strokeWidth={2.2}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={heroStyle}>
        <View style={styles.lineRow}>
          {lines.map((line, idx) => (
            <LineBadge
              key={`${line}-${idx}`}
              line={line}
              size={32}
              testID={testID ? `${testID}-line-${idx}` : undefined}
            />
          ))}
        </View>
        <Text style={titleStyle} accessibilityRole="header">
          {stationName}
        </Text>
        {subtitle ? <Text style={subtitleStyle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  actionGroup: {
    flexDirection: 'row',
    gap: WANTED_TOKENS.spacing.s2,
    alignItems: 'center',
  },
  favoriteIcon: {
    marginLeft: 6,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
});

export const StationDetailHeader = memo(StationDetailHeaderImpl);
StationDetailHeader.displayName = 'StationDetailHeader';
