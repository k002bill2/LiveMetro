/**
 * Line + Station Banner
 *
 * 제보 작성폼 상단의 큰 컨텍스트 배너. 노선과 역이 선택되었을 때
 * 시안 #2의 초록색 박스로 표시 — 사용자가 작성 중에 컨텍스트를 잃지 않도록.
 *
 * 노선/역 미선택 시 hidden.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { LineBadge, type LineId } from '@/components/design';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface LineStationBannerProps {
  lineId?: string;
  stationName?: string;
}

export const LineStationBanner: React.FC<LineStationBannerProps> = ({ lineId, stationName }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  if (!lineId || !stationName) {
    return null;
  }

  const lineColor = getSubwayLineColor(lineId);

  return (
    <View
      testID="line-station-banner"
      style={[styles.banner, { backgroundColor: lineColor }]}
      accessibilityRole="summary"
      accessibilityLabel={`제보 대상 ${lineId}호선 ${stationName}역`}
    >
      <LineBadge line={lineId as LineId} size={32} />

      <View style={styles.textColumn}>
        <Text style={styles.eyebrow}>제보 대상</Text>
        <Text style={styles.title}>
          {lineId}호선 · {stationName}역
        </Text>
      </View>

      <View style={styles.pinWrap}>
        <MapPin size={20} color={WANTED_TOKENS.light.labelOnColor} strokeWidth={2.2} />
      </View>
    </View>
  );
};

const createStyles = (_semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
    },
    textColumn: {
      flex: 1,
    },
    eyebrow: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: WANTED_TOKENS.light.labelOnColor,
      opacity: 0.9,
      marginBottom: 2,
    },
    title: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: WANTED_TOKENS.light.labelOnColor,
      letterSpacing: -0.4,
    },
    pinWrap: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
  });

export default LineStationBanner;
