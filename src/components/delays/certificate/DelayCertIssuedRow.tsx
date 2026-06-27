/**
 * DelayCertIssuedRow — 발급 내역 탭 증명서 row.
 *
 * Wanted handoff (settings-detail-2.jsx 152-187행): PDF 아이콘 블록(40x48 +
 * 미니 PDF 배지) + "YYYY.MM.DD · N분 지연 증명서" + 발급일·증명서 번호 +
 * 우측 PDF 저장/텍스트 공유/삭제 액션.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Download, FileText, Share2, Trash2 } from 'lucide-react-native';

import { DelayCertificate } from '@/models/delayCertificate';
import { truncateMinutes } from '@/utils/dateUtils';
import { formatIssuedDate, toDate } from '@/components/delays/certificate/delayCertFormat';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface DelayCertIssuedRowProps {
  cert: DelayCertificate;
  isFirst: boolean;
  isLast: boolean;
  onSharePdf: (cert: DelayCertificate) => void;
  onShareText: (cert: DelayCertificate) => void;
  onDelete: (cert: DelayCertificate) => void;
}

const DelayCertIssuedRowImpl: React.FC<DelayCertIssuedRowProps> = ({
  cert,
  isFirst,
  isLast,
  onSharePdf,
  onShareText,
  onDelete,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const handleSharePdf = useCallback(() => {
    onSharePdf(cert);
  }, [cert, onSharePdf]);
  const handleShareText = useCallback(() => {
    onShareText(cert);
  }, [cert, onShareText]);
  const handleDelete = useCallback(() => {
    onDelete(cert);
  }, [cert, onDelete]);

  return (
    <View
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLastRadius,
      ]}
      testID={`cert-row-${cert.id}`}
    >
      {/* PDF 아이콘 블록 */}
      <View style={styles.pdfIconBlock}>
        <FileText size={20} color={semantic.primaryNormal} strokeWidth={2} />
        <View style={styles.pdfMiniBadge}>
          <Text style={styles.pdfMiniBadgeText}>PDF</Text>
        </View>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {formatIssuedDate(toDate(cert.date))} ·{' '}
          {truncateMinutes(cert.delayMinutes)}분 지연 증명서
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          발급 {formatIssuedDate(toDate(cert.createdAt ?? cert.date))} ·{' '}
          {cert.certificateNumber}
        </Text>
      </View>

      <View style={styles.certActions}>
        <TouchableOpacity
          style={styles.certActionButton}
          onPress={handleSharePdf}
          accessibilityRole="button"
          accessibilityLabel="증명서 PDF 저장 및 공유"
          testID={`pdf-share-${cert.id}`}
        >
          <Download size={18} color={semantic.primaryNormal} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.certActionButton}
          onPress={handleShareText}
          accessibilityRole="button"
          accessibilityLabel="증명서 텍스트 공유"
          testID={`text-share-${cert.id}`}
        >
          <Share2 size={18} color={semantic.labelAlt} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.certActionButton}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="증명서 삭제"
          testID={`delete-cert-${cert.id}`}
        >
          <Trash2 size={18} color={semantic.statusNegative} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    rowFirst: {
      borderTopLeftRadius: WANTED_TOKENS.radius.r8,
      borderTopRightRadius: WANTED_TOKENS.radius.r8,
    },
    rowLastRadius: {
      borderBottomLeftRadius: WANTED_TOKENS.radius.r8,
      borderBottomRightRadius: WANTED_TOKENS.radius.r8,
      borderBottomWidth: 0,
    },
    pdfIconBlock: {
      width: 40,
      height: 48,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    pdfMiniBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: WANTED_TOKENS.radius.r2,
      backgroundColor: semantic.primaryNormal,
    },
    pdfMiniBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelOnColor,
      letterSpacing: 0.36,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      flexShrink: 1,
    },
    rowSub: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 3,
    },
    certActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    certActionButton: {
      minWidth: 40,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const DelayCertIssuedRow = memo(DelayCertIssuedRowImpl);
DelayCertIssuedRow.displayName = 'DelayCertIssuedRow';
