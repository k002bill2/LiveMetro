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
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle, Mail, Phone, Search, XCircle } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);
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
            <HelpCircle
              size={20}
              color={semantic.labelStrong}
              strokeWidth={2}
              style={styles.faqQuestionIcon}
            />
            <Text style={styles.faqQuestionText}>{item.question}</Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={semantic.labelAlt} strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color={semantic.labelAlt} strokeWidth={2} />
          )}
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
          <Search
            size={20}
            color={semantic.labelAlt}
            strokeWidth={2}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="질문 검색..."
            placeholderTextColor={semantic.labelAlt}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <XCircle size={20} color={semantic.labelAlt} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* No Results Message */}
        {filteredFAQs.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Search size={64} color={semantic.labelDisabled} strokeWidth={1.5} />
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
                <MessageCircle
                  size={32}
                  color={semantic.labelStrong}
                  strokeWidth={2}
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
              <Mail size={20} color={'#FFFFFF'} strokeWidth={2} />
              <Text style={styles.contactButtonText}>고객 지원 문의</Text>
            </TouchableOpacity>

            <View style={styles.contactInfo}>
              <View style={styles.contactInfoItem}>
                <Mail size={16} color={semantic.labelAlt} strokeWidth={2} />
                <Text style={styles.contactInfoText}>{SUPPORT_EMAIL}</Text>
              </View>
              <View style={styles.contactInfoItem}>
                <Phone size={16} color={semantic.labelAlt} strokeWidth={2} />
                <Text style={styles.contactInfoText}>{SUPPORT_PHONE}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  searchContainer: {
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    backgroundColor: semantic.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semantic.bgSubtle,
    borderRadius: WANTED_TOKENS.radius.r6,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  searchIcon: {
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  searchInput: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body1.size,
    color: semantic.labelStrong,
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  clearButton: {
    padding: WANTED_TOKENS.spacing.s1,
  },
  content: {
    flex: 1,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s12,
  },
  noResultsTitle: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  noResultsSubtitle: {
    fontSize: WANTED_TOKENS.type.body2.size,
    color: semantic.labelAlt,
    textAlign: 'center',
    lineHeight: WANTED_TOKENS.type.body2.lh,
  },
  categorySection: {
    marginTop: WANTED_TOKENS.spacing.s4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  categoryTitle: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelAlt,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: semantic.bgSubtle,
    borderRadius: WANTED_TOKENS.radius.pill,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 2,
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
  categoryBadgeText: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelAlt,
  },
  faqItem: {
    backgroundColor: semantic.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s4,
  },
  faqQuestionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  faqQuestionIcon: {
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    lineHeight: WANTED_TOKENS.type.body1.lh,
  },
  faqAnswer: {
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingLeft: WANTED_TOKENS.spacing.s4 + 20 + WANTED_TOKENS.spacing.s3,
    paddingBottom: WANTED_TOKENS.spacing.s4,
    paddingTop: 0,
  },
  faqAnswerText: {
    fontSize: WANTED_TOKENS.type.body2.size,
    color: semantic.labelAlt,
    lineHeight: WANTED_TOKENS.type.body2.lh,
  },
  supportSection: {
    marginTop: WANTED_TOKENS.spacing.s5,
    marginBottom: WANTED_TOKENS.spacing.s8,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
  },
  supportCard: {
    flexDirection: 'row',
    backgroundColor: semantic.primaryBg,
    borderRadius: WANTED_TOKENS.radius.r6,
    padding: WANTED_TOKENS.spacing.s4,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    marginBottom: WANTED_TOKENS.spacing.s4,
  },
  supportIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: semantic.bgBase,
    borderRadius: WANTED_TOKENS.radius.r6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: WANTED_TOKENS.type.body2.size,
    color: semantic.labelAlt,
    lineHeight: WANTED_TOKENS.type.body2.lh,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantic.primaryNormal,
    paddingVertical: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  contactButtonText: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: '#FFFFFF',
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: WANTED_TOKENS.spacing.s1,
  },
  contactInfoText: {
    fontSize: WANTED_TOKENS.type.body2.size,
    color: semantic.labelAlt,
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
});

export default HelpScreen;
