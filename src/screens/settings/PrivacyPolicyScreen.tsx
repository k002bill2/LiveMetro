/**
 * Privacy Policy Screen
 * Display privacy policy using markdown.
 *
 * Phase 47 — migrated from legacy COLORS API to Wanted Design System.
 * MarkdownViewer (Phase 45) already drives the body styling; this screen
 * only owns the container chrome.
 */

import React, { useMemo } from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import {
  WANTED_TOKENS,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { MarkdownViewer } from '@/components/settings/MarkdownViewer';
import { PRIVACY_POLICY_CONTENT } from '@/utils/privacyPolicyContent';

export const PrivacyPolicyScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <MarkdownViewer content={PRIVACY_POLICY_CONTENT} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
  });

export default PrivacyPolicyScreen;
