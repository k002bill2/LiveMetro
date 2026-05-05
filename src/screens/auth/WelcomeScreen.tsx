/**
 * Welcome Screen Component
 * First screen users see when opening the app
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { ArrowRight, Bell, Map, MapPin, Train } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../../services/auth/AuthContext';
import { useTheme } from '../../services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';
import { RootStackParamList } from '../../navigation/RootNavigator';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { signInAnonymously } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const handleGetStarted = (): void => {
    navigation.navigate('Auth');
  };

  const handleTryAnonymously = async (): Promise<void> => {
    try {
      await signInAnonymously();
    } catch (error) {
      console.error('Anonymous sign in failed:', error);
      // Could show an alert here
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="welcome-screen">
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer} testID="welcome-logo">
            <Train size={64} color={semantic.primaryNormal} strokeWidth={2} />
          </View>
          <Text style={styles.appName}>LiveMetro</Text>
          <Text style={styles.tagline}>실시간 전철 알림</Text>
          <Text style={styles.subtitle}>
            지하철 지연, 운행중단 정보를 실시간으로 받아보세요
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <Bell size={24} color={semantic.statusPositive} strokeWidth={2} />
            <Text style={styles.featureText}>실시간 지연 알림</Text>
          </View>

          <View style={styles.feature}>
            <MapPin size={24} color={semantic.statusNegative} strokeWidth={2} />
            <Text style={styles.featureText}>주변 역 자동 감지</Text>
          </View>

          <View style={styles.feature}>
            <Map size={24} color={semantic.primaryNormal} strokeWidth={2} />
            <Text style={styles.featureText}>대체 경로 제안</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            testID="get-started-button"
            accessibilityLabel="시작하기"
          >
            <Text style={styles.primaryButtonText}>시작하기</Text>
            <ArrowRight size={20} color={'#FFFFFF'} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleTryAnonymously}
            testID="try-anonymous-button"
            accessibilityLabel="체험해보기"
          >
            <Text style={styles.secondaryButtonText}>체험해보기</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            계정을 만들면 개인화된 알림과 즐겨찾기 기능을 이용할 수 있습니다
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      paddingVertical: 24,
      justifyContent: 'space-between',
    },
    logoSection: {
      alignItems: 'center',
      marginTop: 60,
    },
    logoContainer: {
      width: 120,
      height: 120,
      backgroundColor: semantic.primaryBg,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    appName: {
      fontSize: 36,
      fontWeight: 'bold',
      fontFamily: weightToFontFamily('bold'),
      color: semantic.labelStrong,
      marginBottom: 8,
    },
    tagline: {
      fontSize: 18,
      color: semantic.primaryNormal,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 16,
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    featuresSection: {
      paddingVertical: 32,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      elevation: 1,
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    featureText: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginLeft: 16,
    },
    buttonSection: {
      paddingVertical: 16,
    },
    primaryButton: {
      backgroundColor: semantic.primaryNormal,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: semantic.primaryNormal,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    primaryButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: weightToFontFamily('bold'),
      color: '#FFFFFF',
      marginRight: 8,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: semantic.lineNormal,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    footer: {
      paddingVertical: 16,
    },
    footerText: {
      fontSize: 14,
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: 20,
    },
  });