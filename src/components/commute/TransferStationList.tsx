/**
 * Transfer Station List Component
 * Manages the list of transfer stations with add/remove functionality.
 *
 * Phase 49 — migrated to Wanted Design System tokens. Subway line
 * colors now resolve through getSubwayLineColor utility (consistent
 * with rest of app).
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ArrowLeftRight, XCircle, PlusCircle, Info } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { TransferStation, MAX_TRANSFER_STATIONS } from '@/models/commute';

interface TransferStationListProps {
  transfers: readonly TransferStation[];
  onAddTransfer: () => void;
  onRemoveTransfer: (index: number) => void;
  maxTransfers?: number;
}

export const TransferStationList: React.FC<TransferStationListProps> = ({
  transfers,
  onAddTransfer,
  onRemoveTransfer,
  maxTransfers = MAX_TRANSFER_STATIONS,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const canAddMore = transfers.length < maxTransfers;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ArrowLeftRight
          size={18}
          color={semantic.labelNeutral}
        />
        <Text style={styles.headerText}>환승역</Text>
        <Text style={styles.countText}>
          {transfers.length}/{maxTransfers}
        </Text>
      </View>

      {/* Transfer Station Items */}
      {transfers.map((transfer, index) => (
        <View key={`${transfer.stationId}-${index}`} style={styles.transferItem}>
          <View style={styles.transferContent}>
            <View
              style={[
                styles.lineIndicator,
                { backgroundColor: getSubwayLineColor(transfer.lineId) },
              ]}
            />
            <View style={styles.transferInfo}>
              <Text style={styles.transferName}>{transfer.stationName}</Text>
              <Text style={styles.transferLine}>{transfer.lineName}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemoveTransfer(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XCircle
              size={22}
              color={semantic.labelAlt}
            />
          </TouchableOpacity>
        </View>
      ))}

      {/* Empty State */}
      {transfers.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            환승역이 없습니다
          </Text>
          <Text style={styles.emptySubtext}>
            직행 노선인 경우 환승역을 추가하지 않아도 됩니다
          </Text>
        </View>
      )}

      {/* Add Transfer Button */}
      {canAddMore && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddTransfer}
        >
          <PlusCircle
            size={20}
            color={WANTED_TOKENS.blue[500]}
          />
          <Text style={styles.addButtonText}>환승역 추가</Text>
        </TouchableOpacity>
      )}

      {/* Max Reached Notice */}
      {!canAddMore && (
        <View style={styles.maxNotice}>
          <Info
            size={16}
            color={semantic.labelAlt}
          />
          <Text style={styles.maxNoticeText}>
            최대 {maxTransfers}개의 환승역을 추가할 수 있습니다
          </Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgSubtlePage,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    headerText: {
      marginLeft: WANTED_TOKENS.spacing.s2,
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      flex: 1,
    },
    countText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    transferItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      padding: WANTED_TOKENS.spacing.s3,
      marginBottom: WANTED_TOKENS.spacing.s2,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    transferContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    lineIndicator: {
      width: 4,
      height: 28,
      borderRadius: 2,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    transferInfo: {
      flex: 1,
    },
    transferName: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    transferLine: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    removeButton: {
      padding: WANTED_TOKENS.spacing.s1,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    emptySubtext: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s1,
      textAlign: 'center',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      marginTop: WANTED_TOKENS.spacing.s2,
      borderWidth: 1,
      borderColor: WANTED_TOKENS.blue[500],
      borderRadius: WANTED_TOKENS.radius.r4,
      borderStyle: 'dashed',
    },
    addButtonText: {
      marginLeft: WANTED_TOKENS.spacing.s2,
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.blue[500],
    },
    maxNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    maxNoticeText: {
      marginLeft: WANTED_TOKENS.spacing.s1,
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });

export default TransferStationList;
