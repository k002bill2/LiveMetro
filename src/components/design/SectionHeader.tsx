/**
 * SectionHeader — title + subtitle + action row used to introduce content
 * groups (Wanted Design System).
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ 즐겨찾는 역                       전체 보기 ›   │  ← title (heading2 weight)
 *   │ 실시간 도착                                     │  ← subtitle (caption alt)
 *   └────────────────────────────────────────────────┘
 */
import React, { memo, ReactNode } from 'react';
import { Text, View, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot — typically a "전체 보기 ›" link or pill. */
  action?: ReactNode;
  /** Override container style (margin, padding, etc.). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SectionHeaderImpl: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const titleStyle: TextStyle = {
    ...typeStyle('heading2'),
    color: semantic.labelStrong,
  };

  const subtitleStyle: TextStyle = {
    marginTop: 2,
    ...typeStyle('caption1'),
    color: semantic.labelAlt,
  };

  return (
    <View testID={testID} style={[styles.row, style]}>
      <View style={styles.textBlock}>
        <Text style={titleStyle}>{title}</Text>
        {subtitle ? (
          <Text testID={testID ? `${testID}-subtitle` : undefined} style={subtitleStyle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  textBlock: {
    flex: 1,
  },
  action: {
    marginLeft: WANTED_TOKENS.spacing.s3,
  },
});

export const SectionHeader = memo(SectionHeaderImpl);
SectionHeader.displayName = 'SectionHeader';
