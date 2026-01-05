/**
 * Help Screen
 * Display FAQ with search and contact support
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useTheme, ThemeColors } from '@/services/theme';
import {
  FAQ_DATA,
  FAQ_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  FAQItem,
} from '@/utils/helpContent';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const HelpScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter FAQ items based on search query
  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) {
      return FAQ_DATA;
    }

    const query = searchQuery.toLowerCase();
    return FAQ_DATA.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    const groups: { [key: string]: FAQItem[] } = {};

    FAQ_CATEGORIES.forEach((category) => {
      groups[category] = filteredFAQs.filter((faq) => faq.category === category);
    });

    return groups;
  }, [filteredFAQs]);

  const toggleItem = (id: string): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleContactSupport = (): void => {
    Alert.alert(
      '고객 지원',
      '어떤 방법으로 연락하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: `이메일 (${SUPPORT_EMAIL})`,
          onPress: () => {
            Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
              Alert.alert('오류', '이메일 앱을 열 수 없습니다.');
            });
          },
        },
        {
          text: `전화 (${SUPPORT_PHONE})`,
          onPress: () => {
            Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
              Alert.alert('오류', '전화 앱을 열 수 없습니다.');
            });
          },
        },
      ]
    );
  };

  const FAQAccordionItem: React.FC<{ item: FAQItem }> = ({ item }) => {
    const isExpanded = expandedItems.has(item.id);

    return (
      <View style={styles.faqItem}>
        <TouchableOpacity
          style={styles.faqQuestion}
          onPress={() => toggleItem(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.faqQuestionContent}>
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={colors.textPrimary}
              style={styles.faqQuestionIcon}
            />
            <Text style={styles.faqQuestionText}>{item.question}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.faqAnswer}>
            <Text style={styles.faqAnswerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  const CategorySection: React.FC<{ category: string }> = ({ category }) => {
    const items = groupedFAQs[category];

    if (!items || items.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{items.length}</Text>
          </View>
        </View>

        {items.map((item) => (
          <FAQAccordionItem key={item.id} item={item} />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="질문 검색..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* No Results Message */}
        {filteredFAQs.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={64} color={colors.textDisabled} />
            <Text style={styles.noResultsTitle}>검색 결과가 없습니다</Text>
            <Text style={styles.noResultsSubtitle}>
              다른 키워드로 검색하거나{'\n'}고객 지원에 문의해주세요
            </Text>
          </View>
        )}

        {/* FAQ Categories */}
        {FAQ_CATEGORIES.map((category) => (
          <CategorySection key={category} category={category} />
        ))}

        {/* Contact Support Section */}
        {filteredFAQs.length > 0 && (
          <View style={styles.supportSection}>
            <View style={styles.supportCard}>
              <View style={styles.supportIconContainer}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={32}
                  color={colors.textPrimary}
                />
              </View>
              <View style={styles.supportContent}>
                <Text style={styles.supportTitle}>문제가 해결되지 않았나요?</Text>
                <Text style={styles.supportDescription}>
                  고객 지원팀에 문의하시면 빠르게 도움을 받으실 수 있습니다
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleContactSupport}
            >
              <Ionicons name="mail" size={20} color={colors.textInverse} />
              <Text style={styles.contactButtonText}>고객 지원 문의</Text>
            </TouchableOpacity>

            <View style={styles.contactInfo}>
              <View style={styles.contactInfoItem}>
                <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.contactInfoText}>{SUPPORT_EMAIL}</Text>
              </View>
              <View style={styles.contactInfoItem}>
                <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.contactInfoText}>{SUPPORT_PHONE}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: colors.textPrimary,
    paddingVertical: SPACING.md,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['3xl'],
  },
  noResultsTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  noResultsSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  categorySection: {
    marginTop: SPACING.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  categoryTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  categoryBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textTertiary,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  faqQuestionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  faqQuestionIcon: {
    marginRight: SPACING.md,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.base,
  },
  faqAnswer: {
    paddingHorizontal: SPACING.lg,
    paddingLeft: SPACING.lg + 20 + SPACING.md, // Align with question text
    paddingBottom: SPACING.lg,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  supportSection: {
    marginTop: SPACING.xl,
    marginBottom: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
  },
  supportCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    marginBottom: SPACING.lg,
  },
  supportIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  contactButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textInverse,
    marginLeft: SPACING.sm,
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xs,
  },
  contactInfoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    marginLeft: SPACING.sm,
  },
});

export default HelpScreen;
