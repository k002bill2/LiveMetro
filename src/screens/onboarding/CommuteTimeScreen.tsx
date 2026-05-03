/**
 * Commute Time Screen
 * Screen for setting departure time during onboarding
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Sun, Moon, Info, ArrowRight } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { SettingTimePicker } from '@/components/settings/SettingTimePicker';
import { OnboardingStackParamList } from '@/navigation/types';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteTime'>;

export const CommuteTimeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { commuteType, onTimeSet, initialTime } = route.params;
  const [time, setTime] = useState(initialTime || (commuteType === 'morning' ? '08:00' : '18:00'));
  const { onSkip } = useOnboardingCallbacks();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const isMorning = commuteType === 'morning';

  const handleNext = () => {
    onTimeSet(time);
    navigation.navigate('CommuteRoute', {
      commuteType,
      departureTime: time,
      morningRoute: route.params.morningRoute,
    });
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            {isMorning ? (
              <Sun
                size={48}
                color={COLORS.secondary.yellow}
              />
            ) : (
              <Moon
                size={48}
                color={semantic.primaryNormal}
              />
            )}
          </View>
          <Text style={styles.title}>
            {isMorning ? '출근 시간 설정' : '퇴근 시간 설정'}
          </Text>
          <Text style={styles.subtitle}>
            {isMorning
              ? '평일 출근하는 시간을 알려주세요'
              : '평일 퇴근하는 시간을 알려주세요'}
          </Text>
        </View>

        {/* Time Picker */}
        <View style={styles.pickerContainer}>
          <SettingTimePicker
            label={isMorning ? '출근 시간' : '퇴근 시간'}
            value={time}
            onValueChange={setTime}
            icon={isMorning ? 'sunny' : 'moon'}
          />
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
            <Info
            size={20}
            color={semantic.labelAlt}
          />
          <Text style={styles.infoText}>
            설정한 시간 기준으로 출발 알림을 보내드립니다.{'\n'}
            나중에 설정에서 변경할 수 있습니다.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        {isMorning && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipButtonText}>나중에 설정</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>다음</Text>
          <ArrowRight size={20} color={semantic.labelOnColor} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING['3xl'],
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING['3xl'],
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: semantic.bgSubtlePage,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontSize: TYPOGRAPHY.fontSize['3xl'],
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: semantic.labelStrong,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    pickerContainer: {
      backgroundColor: semantic.bgBase,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      overflow: 'hidden',
      marginBottom: SPACING.xl,
      ...SHADOWS.sm,
    },
    infoContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: semantic.bgSubtlePage,
      borderRadius: RADIUS.base,
      padding: SPACING.lg,
    },
    infoText: {
      flex: 1,
      marginLeft: SPACING.sm,
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: semantic.labelAlt,
      lineHeight: 20,
    },
    bottomContainer: {
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      gap: SPACING.md,
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    skipButtonText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      color: semantic.labelAlt,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.primaryNormal,
      paddingVertical: SPACING.lg,
      borderRadius: RADIUS.base,
      gap: SPACING.sm,
    },
    nextButtonText: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: semantic.labelOnColor,
    },
  });

export default CommuteTimeScreen;
