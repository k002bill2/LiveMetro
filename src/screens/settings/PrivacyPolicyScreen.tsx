/**
 * Privacy Policy Screen
 * Display privacy policy using markdown
 */

import React from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { COLORS } from '@/styles/modernTheme';
import { MarkdownViewer } from '@/components/settings/MarkdownViewer';
import { PRIVACY_POLICY_CONTENT } from '@/utils/privacyPolicyContent';

export const PrivacyPolicyScreen: React.FC = () => {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});

export default PrivacyPolicyScreen;
