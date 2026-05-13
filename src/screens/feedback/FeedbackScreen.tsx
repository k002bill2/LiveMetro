/**
 * Feedback Screen
 *
 * 시안 #3 "의견 보내기" — 별점 + 좋은점/아쉬운점 chip + 카테고리 grid +
 * 상세 + 진단정보 toggle. Settings 탭에서 진입.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Star, X, Send, Info } from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { feedbackService } from '@/services/feedback/feedbackService';
import {
  FeedbackCategory,
  FeedbackCategoryLabels,
  FeedbackCategoryDescriptions,
  FEEDBACK_TAGS,
  FeedbackTag,
  FeedbackDiagnostics,
  isFeedbackSubmittable,
} from '@/models/feedback';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface FeedbackScreenProps {
  onClose?: () => void;
  onSubmitSuccess?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '별로예요',
  2: '괜찮아요',
  3: '좋아요',
  4: '좋아요',
  5: '최고예요',
};

const APP_VERSION = '1.0.0';

const buildDiagnostics = (): FeedbackDiagnostics => ({
  appVersion: APP_VERSION,
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  osVersion: String(Platform.Version),
});

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ onClose, onSubmitSuccess }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [rating, setRating] = useState<number>(0);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [description, setDescription] = useState<string>('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const toggleTag = useCallback((tag: FeedbackTag) => {
    setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  }, []);

  const canSubmit = useMemo(
    () => category != null && isFeedbackSubmittable({
      rating,
      category: category as FeedbackCategory,
      tags,
      description,
      includeDiagnostics,
    }),
    [rating, category, tags, description, includeDiagnostics],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || category == null) return;
    setSubmitting(true);
    try {
      await feedbackService.submitFeedback(
        {
          rating,
          category,
          tags,
          description,
          includeDiagnostics,
          diagnostics: includeDiagnostics ? buildDiagnostics() : undefined,
        },
        { userId: user?.id ?? null, userEmail: user?.email ?? null },
      );
      Alert.alert('의견 전달 완료', '소중한 의견 감사합니다. 영업일 기준 3일 내에 검토됩니다.');
      onSubmitSuccess?.();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert('오류', '의견 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, rating, category, tags, description, includeDiagnostics, user, onSubmitSuccess]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onClose ? (
          <TouchableOpacity
            testID="feedback-close"
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <X size={24} color={semantic.labelStrong} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
        <Text testID="feedback-header-title" style={styles.headerTitle}>의견 보내기</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Rating */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>LiveMetro는 어떠셨나요?</Text>
          <Text style={styles.heroHint}>여러분의 의견이 더 나은 출퇴근을 만들어요</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(n => {
              const active = n <= rating;
              return (
                <TouchableOpacity
                  key={n}
                  testID={`feedback-star-${n}`}
                  onPress={() => setRating(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`별점 ${n}점`}
                  accessibilityState={{ selected: active }}
                  style={styles.starButton}
                >
                  <Star
                    size={36}
                    color={active ? semantic.statusCautionary : semantic.lineSubtle}
                    fill={active ? semantic.statusCautionary : 'transparent'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel} testID="feedback-rating-label">
              {RATING_LABELS[rating]}
            </Text>
          )}
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>어떤 점이 좋았/아쉬웠나요?</Text>
          <View style={styles.tagWrap}>
            {FEEDBACK_TAGS.map(tag => {
              const selected = tags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  testID={`feedback-tag-${tag}`}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagChip, selected && styles.tagChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={tag}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>분류</Text>
          <View style={styles.categoryGrid}>
            {(Object.values(FeedbackCategory) as FeedbackCategory[]).map(cat => {
              const selected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  testID={`feedback-category-${cat}`}
                  onPress={() => setCategory(cat)}
                  style={[styles.categoryTile, selected && styles.categoryTileSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={FeedbackCategoryLabels[cat]}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                    {FeedbackCategoryLabels[cat]}
                  </Text>
                  <Text style={styles.categoryDesc}>{FeedbackCategoryDescriptions[cat]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>상세 내용</Text>
          <TextInput
            testID="feedback-description-input"
            style={styles.textArea}
            placeholder="자세히 알려주실수록 도움이 돼요. 어떤 화면에서, 어떤 상황에서 발생했나요?"
            placeholderTextColor={semantic.labelAlt}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Diagnostics toggle */}
        <View style={styles.diagnosticsCard}>
          <View style={styles.diagnosticsHeader}>
            <Info size={18} color={semantic.primaryNormal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.diagnosticsTitle}>진단 정보 함께 보내기</Text>
              <Text style={styles.diagnosticsHint}>버전·기기·로그 (개인정보 제외)</Text>
            </View>
            <Switch
              testID="feedback-diagnostics-toggle"
              value={includeDiagnostics}
              onValueChange={setIncludeDiagnostics}
              accessibilityLabel="진단 정보 함께 보내기"
            />
          </View>
          {includeDiagnostics && (
            <Text style={styles.diagnosticsMeta} testID="feedback-diagnostics-meta">
              v{APP_VERSION} · {Platform.OS === 'ios' ? 'iPhone' : 'Android'} · {Platform.OS} {Platform.Version}
              {user?.email ? `  ${user.email}` : ''}
            </Text>
          )}
        </View>

        <Text style={styles.footerInfo}>
          보내주신 의견은 영업일 기준 3일 내에 검토돼요.{'\n'}문의 답변은 등록하신 이메일로 발송됩니다.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="feedback-submit"
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityLabel="의견 보내기"
          accessibilityState={{ disabled: !canSubmit || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={WANTED_TOKENS.light.labelOnColor} />
          ) : (
            <>
              <Send size={18} color={WANTED_TOKENS.light.labelOnColor} />
              <Text style={styles.submitText}>의견 보내기</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

FeedbackScreen.displayName = 'FeedbackScreen';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    headerButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 96,
    },
    heroBlock: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s6,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    heroTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.4,
    },
    heroHint: {
      marginTop: WANTED_TOKENS.spacing.s1,
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
    },
    starRow: {
      flexDirection: 'row',
      marginTop: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    starButton: {
      padding: 4,
    },
    ratingLabel: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryNormal,
    },
    section: {
      padding: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    sectionTitle: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
    },
    tagChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    tagChipSelected: {
      backgroundColor: semantic.primaryNormal,
      borderColor: semantic.primaryNormal,
    },
    tagText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    tagTextSelected: {
      color: semantic.labelOnColor,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
    },
    categoryTile: {
      width: '48%',
      padding: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    categoryTileSelected: {
      borderColor: semantic.primaryNormal,
      borderWidth: 2,
      backgroundColor: semantic.bgSubtle,
    },
    categoryLabel: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    categoryLabelSelected: {
      color: semantic.primaryNormal,
    },
    categoryDesc: {
      marginTop: 2,
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    textArea: {
      minHeight: 120,
      padding: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
      fontSize: WANTED_TOKENS.type.label1.size,
      color: semantic.labelStrong,
      textAlignVertical: 'top',
    },
    charCount: {
      marginTop: WANTED_TOKENS.spacing.s1,
      textAlign: 'right',
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    diagnosticsCard: {
      margin: WANTED_TOKENS.spacing.s4,
      padding: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
      gap: WANTED_TOKENS.spacing.s2,
    },
    diagnosticsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    diagnosticsTitle: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    diagnosticsHint: {
      marginTop: 2,
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    diagnosticsMeta: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
      fontFamily: 'Courier',
    },
    footerInfo: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
      lineHeight: 18,
    },
    footer: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: semantic.primaryNormal,
    },
    submitButtonDisabled: {
      backgroundColor: semantic.lineSubtle,
    },
    submitText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: WANTED_TOKENS.light.labelOnColor,
    },
  });

export default FeedbackScreen;
