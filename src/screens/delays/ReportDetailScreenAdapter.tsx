/**
 * Report Detail Screen Adapter
 *
 * navigation route param의 `reportId`를 cache에서 lookup해 ReportDetailScreen에
 * `report` prop으로 넘긴다. cache miss 시 fallback UI.
 */

import React from 'react';
import { Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { ReportDetailScreen } from './ReportDetailScreen';
import { peekReport, stashReport } from '@/services/delay/reportNavCache';

export const ReportDetailScreenAdapter: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reportId: string | undefined = route.params?.reportId;
  const report = reportId ? peekReport(reportId) : undefined;

  if (!report) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={styles.fallbackText}>제보를 불러올 수 없어요.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fallbackButton}>
          <Text style={styles.fallbackButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <ReportDetailScreen
      report={report}
      onBack={() => navigation.goBack()}
      onOpenFeedback={target => {
        stashReport(target);
        navigation.navigate('ReportFeedback', { reportId: target.id });
      }}
    />
  );
};

ReportDetailScreenAdapter.displayName = 'ReportDetailScreenAdapter';

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  fallbackText: { fontSize: 16, color: '#444' },
  fallbackButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2563EB' },
  fallbackButtonText: { color: '#FFFFFF', fontWeight: '600' },
});

export default ReportDetailScreenAdapter;
