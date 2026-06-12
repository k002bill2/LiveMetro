/**
 * LegalDocumentScreen — shared long-form legal document layout.
 * Wanted handoff: settings-detail-2.jsx `LegalScreen` (lines 607-712).
 *
 * Layout: meta card (file-text tile + version eyebrow + last-updated +
 * intro) → table of contents (tap scrolls to the section) → numbered
 * sections ("제 N 조" eyebrow + title + bullet paragraphs) → contact
 * footer card highlighting privacy@livemetro.kr.
 *
 * Deliberate delta vs handoff: the PDF download pill is omitted — the app
 * has no document-export capability yet, and a dead button would violate
 * the no-dead-control policy.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { ChevronRight, FileText } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

/** One numbered article ("제 N 조") of a legal document. */
export interface LegalSection {
  readonly num: string;
  readonly title: string;
  readonly body: readonly string[];
}

export interface LegalDocumentScreenProps {
  /** Lead paragraph shown inside the meta card. */
  readonly intro: string;
  readonly sections: readonly LegalSection[];
  /** e.g. '2025년 11월 1일' */
  readonly lastUpdated: string;
  /** e.g. '3.2' */
  readonly version: string;
}

export const LegalDocumentScreen: React.FC<LegalDocumentScreenProps> = ({
  intro,
  sections,
  lastUpdated,
  version,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const scrollRef = useRef<ScrollView>(null);
  // y-offsets of each section container relative to the scroll content.
  // Filled by onLayout; a TOC tap before layout settles is a no-op scroll
  // to 0 — harmless, so no guard state needed.
  const sectionYsRef = useRef<number[]>([]);

  const handleSectionLayout = useCallback(
    (index: number, event: LayoutChangeEvent): void => {
      sectionYsRef.current[index] = event.nativeEvent.layout.y;
    },
    [],
  );

  const handleTocPress = useCallback((index: number): void => {
    const y = sectionYsRef.current[index] ?? 0;
    scrollRef.current?.scrollTo({ y, animated: true });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {/* Meta card — version eyebrow + last updated + intro */}
        <View style={styles.metaCard} testID="legal-meta-card">
          <View style={styles.metaHeader}>
            <View style={styles.metaIconTile}>
              <FileText size={20} color={semantic.primaryNormal} strokeWidth={2} />
            </View>
            <View style={styles.metaHeaderText}>
              <Text style={styles.metaEyebrow}>버전 {version}</Text>
              <Text style={styles.metaTitle}>최종 개정 {lastUpdated}</Text>
            </View>
          </View>
          <Text style={styles.metaIntro}>{intro}</Text>
        </View>

        {/* Table of contents */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabel}>목차</Text>
          <Text style={styles.groupLabelHint}>{sections.length}개 항목</Text>
        </View>
        <View style={styles.tocCard}>
          {sections.map((section, index) => (
            <TouchableOpacity
              key={section.num}
              style={[
                styles.tocRow,
                index === sections.length - 1 && styles.tocRowLast,
              ]}
              onPress={() => handleTocPress(index)}
              accessibilityRole="button"
              accessibilityLabel={`${section.title} 섹션으로 이동`}
              testID={`legal-toc-item-${index}`}
            >
              <View style={styles.tocBadge}>
                <Text style={styles.tocBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.tocTitle} numberOfLines={1}>
                {section.title}
              </Text>
              <ChevronRight size={14} color={semantic.labelAlt} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Body sections */}
        {sections.map((section, index) => (
          <View
            key={section.num}
            style={styles.section}
            onLayout={(event) => handleSectionLayout(index, event)}
            testID={`legal-section-${index}`}
          >
            <Text style={styles.sectionEyebrow}>{section.num}</Text>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionBody}>
              {section.body.map((paragraph) => (
                <View key={paragraph} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{paragraph}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Contact footer */}
        <View style={styles.footerCard}>
          <Text style={styles.footerText}>
            관련 문의는 <Text style={styles.footerEmail}>privacy@livemetro.kr</Text>{' '}
            또는 앱 내 도움말을 통해 보내주세요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

LegalDocumentScreen.displayName = 'LegalDocumentScreen';

const INTRO_FONT_SIZE = 12;
const BULLET_FONT_SIZE = 13;
const FOOTER_FONT_SIZE = 12;
const SECTION_TITLE_FONT_SIZE = 17;

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: WANTED_TOKENS.spacing.s6 + WANTED_TOKENS.spacing.s2,
    },
    /* Meta card */
    metaCard: {
      marginTop: WANTED_TOKENS.spacing.s1,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s4 + 2,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    metaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    metaIconTile: {
      width: 40,
      height: 40,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: semantic.primaryBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    metaHeaderText: {
      flex: 1,
    },
    metaEyebrow: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption2.size * 0.04,
      textTransform: 'uppercase',
    },
    metaTitle: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: 3,
    },
    metaIntro: {
      fontSize: INTRO_FONT_SIZE,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelNeutral,
      lineHeight: Math.round(INTRO_FONT_SIZE * 1.55),
    },
    /* Group label (목차 eyebrow) */
    groupLabelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingTop: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s6,
    },
    groupLabel: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    groupLabelHint: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    /* Table of contents */
    tocCard: {
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
    tocRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    tocRowLast: {
      borderBottomWidth: 0,
    },
    tocBadge: {
      width: 28,
      height: 28,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: semantic.bgSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    tocBadgeText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelNeutral,
      fontVariant: ['tabular-nums'],
    },
    tocTitle: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.label2.size,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    /* Body sections */
    section: {
      paddingTop: WANTED_TOKENS.spacing.s6,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
    },
    sectionEyebrow: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
      letterSpacing: WANTED_TOKENS.type.caption2.size * 0.04,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      fontSize: SECTION_TITLE_FONT_SIZE,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s1,
      letterSpacing: SECTION_TITLE_FONT_SIZE * -0.015,
      lineHeight: Math.round(SECTION_TITLE_FONT_SIZE * 1.3),
    },
    sectionBody: {
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: WANTED_TOKENS.spacing.s2 + 2,
    },
    bulletDot: {
      marginTop: 7,
      width: 4,
      height: 4,
      borderRadius: WANTED_TOKENS.radius.pill,
      // Handoff: rgba(112,115,124,0.45) — labelDisabled is the closest
      // semantic token (0.40 alpha, theme-reactive).
      backgroundColor: semantic.labelDisabled,
      marginRight: WANTED_TOKENS.spacing.s2 + 2,
    },
    bulletText: {
      flex: 1,
      fontSize: BULLET_FONT_SIZE,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      lineHeight: Math.round(BULLET_FONT_SIZE * 1.65),
    },
    /* Contact footer */
    footerCard: {
      marginTop: WANTED_TOKENS.spacing.s6 + WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3 + 2,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    footerText: {
      fontSize: FOOTER_FONT_SIZE,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      lineHeight: Math.round(FOOTER_FONT_SIZE * 1.55),
    },
    footerEmail: {
      color: semantic.primaryNormal,
      fontFamily: weightToFontFamily('700'),
    },
  });

export default LegalDocumentScreen;
