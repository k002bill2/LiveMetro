/**
 * HomeTopBar — date + greeting + bell icon for the redesigned HomeScreen.
 *
 * Mirrors main.jsx HomeScreen lines 21–34: tiny date/time row, big greeting,
 * circular bell button on the right with a red "unread" dot.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

interface HomeTopBarProps {
  /** "지수님" — preferred display name */
  userName?: string;
  /** Pre-formatted date/time line, e.g. "2026.05.03 (수) · 오전 8:32" */
  dateTime?: string;
  /** Whether to show the unread alert dot */
  hasUnread?: boolean;
  onBellPress?: () => void;
  testID?: string;
}

const HomeTopBarImpl: React.FC<HomeTopBarProps> = ({
  userName,
  dateTime,
  hasUnread = false,
  onBellPress,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const greeting = userName ? `안녕하세요, ${userName}님` : '안녕하세요';

  return (
    <View testID={testID ?? 'home-top-bar'} style={styles.row}>
      <View style={styles.left}>
        {dateTime && (
          <Text style={[styles.date, { color: semantic.labelAlt }]}>{dateTime}</Text>
        )}
        <Text style={[styles.greeting, { color: semantic.labelStrong }]}>{greeting}</Text>
      </View>

      <Pressable
        onPress={onBellPress}
        accessibilityRole="button"
        accessibilityLabel="알림"
        style={({ pressed }) => [
          styles.bellWrap,
          {
            backgroundColor: semantic.bgBase,
            borderColor: semantic.lineSubtle,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        testID="home-top-bar-bell"
      >
        <Bell size={20} color={semantic.labelNormal} strokeWidth={1.8} />
        {hasUnread && (
          <View
            testID="home-top-bar-unread-dot"
            style={[
              styles.unreadDot,
              { borderColor: semantic.bgBase },
            ]}
          />
        )}
      </Pressable>
    </View>
  );
};

export const HomeTopBar = memo(HomeTopBarImpl);
HomeTopBar.displayName = 'HomeTopBar';

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    fontFamily: weightToFontFamily('700'),
    marginBottom: 2,
  },
  greeting: {
    fontSize: 22,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.4,
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4242',
    borderWidth: 2,
  },
});
