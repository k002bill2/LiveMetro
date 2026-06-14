/**
 * Help Screen — Wanted 핸드오프(settings-detail-2.jsx SettingsHelpScreen) 매칭.
 *
 * 구조: 검색 바(radius 14 카드) + 빠른 문의 2-그리드 + 단일 열림 FAQ 아코디언
 * (Q/A 서클 배지) + "그 외" Row 섹션.
 *
 * 콘텐츠 honesty: 문의 채널은 코드에 실재하는 이메일/전화만 배치(카카오톡
 * 채널 없음). FAQ는 기존 helpContent가 SoT이며, 디자인 FAQS 중 앱 사실과
 * 일치하는 "계정 없이 이용" 1건만 채택(익명 로그인 실재). 혼잡도 센서·ML
 * 정확도 등 미검증 주장은 복사하지 않음.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Linking, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp, Mail, MessageSquare, Phone, Search, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

import { SettingsStackParamList } from '@/navigation/types';
import { FAQ_DATA, SUPPORT_EMAIL, SUPPORT_PHONE, FAQItem } from '@/utils/helpContent';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 디자인 FAQS 중 앱 사실과 일치하여 채택한 항목 (익명 로그인 실재 —
// AuthContext anonymous sign-in + 이메일 전용 기능 게이팅 참조).
const ADOPTED_DESIGN_FAQS: readonly FAQItem[] = [
  {
    id: 'account-guest',
    category: '계정',
    question: '계정 없이 이용할 수 있나요?',
    answer:
      '네, 둘러보기(익명) 로그인으로 실시간 도착 정보 등 핵심 기능을 모두 이용할 수 있어요.\n\n단, 이메일 알림처럼 계정 정보가 필요한 일부 기능은 이메일 로그인이 필요합니다.',
  },
];

const ALL_FAQS: readonly FAQItem[] = [...FAQ_DATA, ...ADOPTED_DESIGN_FAQS];

// 빠른 문의 채널 — 코드에 실재하는 채널만 (mailto / tel).
type ContactTone = 'blue' | 'neutral';

interface ContactChannel {
  readonly id: string;
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly sub: string;
  readonly url: string;
  readonly errorMessage: string;
  readonly tone: ContactTone;
}

const CONTACT_CHANNELS: readonly ContactChannel[] = [
  {
    id: 'email',
    Icon: Mail,
    label: '이메일 문의',
    sub: SUPPORT_EMAIL,
    url: `mailto:${SUPPORT_EMAIL}`,
    errorMessage: '이메일 앱을 열 수 없습니다.',
    tone: 'blue',
  },
  {
    id: 'phone',
    Icon: Phone,
    label: '전화 문의',
    sub: SUPPORT_PHONE,
    url: `tel:${SUPPORT_PHONE}`,
    errorMessage: '전화 앱을 열 수 없습니다.',
    tone: 'neutral',
  },
];

export const HelpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<SettingsStackParamList>>();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // FAQ 질문/답변 실시간 클라이언트 필터링
  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) {
      return ALL_FAQS;
    }

    const query = searchQuery.toLowerCase();
    return ALL_FAQS.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // 한 번에 하나만 열림 (디자인 817행 setOpen(on ? -1 : i))
  const toggleItem = useCallback((id: string): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleClearSearch = useCallback((): void => {
    setSearchQuery('');
  }, []);

  const handleContactPress = useCallback(
    (channel: ContactChannel): void => {
      Linking.openURL(channel.url).catch(() => {
        Alert.alert('오류', channel.errorMessage);
      });
    },
    []
  );

  const handleFeedbackPress = useCallback((): void => {
    navigation.navigate('Feedback');
  }, [navigation]);

  const handlePrivacyPolicyPress = useCallback((): void => {
    navigation.navigate('PrivacyPolicy');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 검색 바 — 디자인 763-780행 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchCard}>
          <Search size={18} color={semantic.labelAlt} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="궁금한 점을 검색해보세요"
            placeholderTextColor={semantic.labelAlt}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="도움말 검색"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              testID="help-search-clear"
            >
              <XCircle size={18} color={semantic.labelAlt} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 빠른 문의 2-그리드 — 디자인 783-806행 */}
        <View style={styles.contactGrid}>
          {CONTACT_CHANNELS.map((channel) => (
            <TouchableOpacity
              key={channel.id}
              style={styles.contactCard}
              onPress={() => handleContactPress(channel)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={channel.label}
              testID={`help-contact-${channel.id}`}
            >
              <View
                style={[
                  styles.contactIconSquare,
                  channel.tone === 'blue'
                    ? styles.contactIconBlue
                    : styles.contactIconNeutral,
                ]}
              >
                <channel.Icon
                  size={18}
                  color={
                    channel.tone === 'blue'
                      ? WANTED_TOKENS.blue[500]
                      : semantic.labelNeutral
                  }
                  strokeWidth={2.2}
                />
              </View>
              <Text style={styles.contactLabel}>{channel.label}</Text>
              <Text style={styles.contactSub}>{channel.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ 아코디언 — 디자인 809-853행 */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabel}>자주 묻는 질문</Text>
          <Text style={styles.groupLabelHint}>
            {filteredFAQs.length}개 질문
          </Text>
        </View>

        {filteredFAQs.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Search size={48} color={semantic.labelDisabled} strokeWidth={1.5} />
            <Text style={styles.noResultsTitle}>검색 결과가 없습니다</Text>
            <Text style={styles.noResultsSubtitle}>
              다른 키워드로 검색하거나{'\n'}아래 채널로 문의해주세요
            </Text>
          </View>
        ) : (
          <View style={styles.groupCard}>
            {filteredFAQs.map((item, index) => {
              const isOpen = openId === item.id;
              const isLast = index === filteredFAQs.length - 1;
              return (
                <View key={item.id} style={isLast ? undefined : styles.faqDivider}>
                  <TouchableOpacity
                    style={styles.faqQuestionRow}
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.question}
                    accessibilityState={{ expanded: isOpen }}
                    testID={`help-faq-${item.id}`}
                  >
                    <View
                      style={[
                        styles.qaBadge,
                        isOpen ? styles.qBadgeOpen : styles.qBadgeClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.qaBadgeText,
                          isOpen
                            ? styles.qBadgeTextOpen
                            : styles.qBadgeTextClosed,
                        ]}
                      >
                        Q
                      </Text>
                    </View>
                    <Text style={styles.faqQuestionText}>{item.question}</Text>
                    {isOpen ? (
                      <ChevronUp
                        size={16}
                        color={semantic.labelAlt}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        color={semantic.labelAlt}
                        strokeWidth={2.4}
                      />
                    )}
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.faqAnswerRow}>
                      <View style={[styles.qaBadge, styles.aBadge]}>
                        <Text style={[styles.qaBadgeText, styles.aBadgeText]}>
                          A
                        </Text>
                      </View>
                      <Text style={styles.faqAnswerText}>{item.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 그 외 — 디자인 856-863행 Row 패턴. 실존 목적지만 (죽은 버튼 금지). */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabel}>그 외</Text>
        </View>
        <View style={styles.groupCard}>
          <TouchableOpacity
            style={[styles.miscRow, styles.faqDivider]}
            onPress={handleFeedbackPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="의견 보내기"
            testID="help-misc-feedback"
          >
            <View style={styles.miscIconSquare}>
              <MessageSquare
                size={16}
                color={semantic.labelNeutral}
                strokeWidth={2}
              />
            </View>
            <View style={styles.miscTextContainer}>
              <Text style={styles.miscLabel}>의견 보내기</Text>
              <Text style={styles.miscSub}>버그 신고 · 기능 제안 · 정보 오류 제보</Text>
            </View>
            <ChevronRight size={16} color={semantic.labelAlt} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.miscRow}
            onPress={handlePrivacyPolicyPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="개인정보 처리방침"
            testID="help-misc-privacy"
          >
            <View style={styles.miscIconSquare}>
              <ShieldCheck
                size={16}
                color={semantic.labelNeutral}
                strokeWidth={2}
              />
            </View>
            <View style={styles.miscTextContainer}>
              <Text style={styles.miscLabel}>개인정보 처리방침</Text>
              <Text style={styles.miscSub}>개인정보 수집 · 이용 안내</Text>
            </View>
            <ChevronRight size={16} color={semantic.labelAlt} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

HelpScreen.displayName = 'HelpScreen';

// 디자인 리터럴 (WANTED 스케일 사이값)
const SEARCH_RADIUS = 14; // 디자인 766행
const CONTACT_ICON_SIZE = 36; // 디자인 795행
const MISC_ICON_SIZE = 32; // settings-detail.jsx Row 81행
const QA_BADGE_SIZE = 22; // 디자인 822행
const FAQ_QUESTION_LINE_HEIGHT = Math.round(14 * 1.4); // 디자인 829행
const FAQ_ANSWER_LINE_HEIGHT = Math.round(13 * 1.65); // 디자인 846행
const NEUTRAL_TINT = 'rgba(112,115,124,0.10)';
const BLUE_TINT = 'rgba(0,102,255,0.10)';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    searchContainer: {
      paddingTop: WANTED_TOKENS.spacing.s1,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s3,
    },
    searchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: 14,
      borderRadius: SEARCH_RADIUS,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      padding: 0,
    },
    clearButton: {
      padding: WANTED_TOKENS.spacing.s1,
    },
    content: {
      flex: 1,
    },
    contactGrid: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s1,
    },
    contactCard: {
      flex: 1,
      padding: 14,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    contactIconSquare: {
      width: CONTACT_ICON_SIZE,
      height: CONTACT_ICON_SIZE,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactIconBlue: {
      backgroundColor: BLUE_TINT,
    },
    contactIconNeutral: {
      backgroundColor: NEUTRAL_TINT,
    },
    contactLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginTop: 10,
      letterSpacing: -0.07,
    },
    contactSub: {
      fontSize: 11,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    groupLabelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingTop: WANTED_TOKENS.spacing.s5,
      paddingHorizontal: WANTED_TOKENS.spacing.s6,
      paddingBottom: WANTED_TOKENS.spacing.s2,
    },
    groupLabel: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    groupLabelHint: {
      fontSize: 11,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    groupCard: {
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
    faqDivider: {
      borderBottomWidth: 1,
      borderBottomColor: NEUTRAL_TINT,
    },
    faqQuestionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: WANTED_TOKENS.spacing.s3,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      minHeight: 44,
    },
    qaBadge: {
      width: QA_BADGE_SIZE,
      height: QA_BADGE_SIZE,
      borderRadius: WANTED_TOKENS.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    qBadgeOpen: {
      backgroundColor: WANTED_TOKENS.blue[500],
    },
    qBadgeClosed: {
      backgroundColor: NEUTRAL_TINT,
    },
    qaBadgeText: {
      fontSize: 11,
      fontFamily: weightToFontFamily('800'),
    },
    qBadgeTextOpen: {
      color: '#FFFFFF',
    },
    qBadgeTextClosed: {
      color: semantic.labelNeutral,
    },
    faqQuestionText: {
      flex: 1,
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      lineHeight: FAQ_QUESTION_LINE_HEIGHT,
    },
    faqAnswerRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingBottom: WANTED_TOKENS.spacing.s4,
    },
    aBadge: {
      backgroundColor: BLUE_TINT,
      marginTop: 0,
    },
    aBadgeText: {
      color: WANTED_TOKENS.blue[500],
    },
    faqAnswerText: {
      flex: 1,
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      lineHeight: FAQ_ANSWER_LINE_HEIGHT,
      paddingTop: 2,
    },
    noResultsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
    },
    noResultsTitle: {
      fontSize: WANTED_TOKENS.type.headline1.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    noResultsSubtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: FAQ_ANSWER_LINE_HEIGHT,
    },
    miscRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      minHeight: 44,
    },
    miscIconSquare: {
      width: MISC_ICON_SIZE,
      height: MISC_ICON_SIZE,
      borderRadius: 8,
      backgroundColor: NEUTRAL_TINT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miscTextContainer: {
      flex: 1,
    },
    miscLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    miscSub: {
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
      lineHeight: 16,
    },
    bottomSpacer: {
      height: WANTED_TOKENS.spacing.s6,
    },
  });

export default HelpScreen;
