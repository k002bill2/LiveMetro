/**
 * Transfer Station List Component
 * Manages the list of transfer stations with add/remove functionality
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { TransferStation, MAX_TRANSFER_STATIONS } from '@/models/commute';

interface TransferStationListProps {
  transfers: readonly TransferStation[];
  onAddTransfer: () => void;
  onRemoveTransfer: (index: number) => void;
  maxTransfers?: number;
}

// Line colors for visual indication
const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};

const getLineColor = (lineId: string): string => {
  return LINE_COLORS[lineId] || COLORS.gray[400];
};

export const TransferStationList: React.FC<TransferStationListProps> = ({
  transfers,
  onAddTransfer,
  onRemoveTransfer,
  maxTransfers = MAX_TRANSFER_STATIONS,
}) => {
  const canAddMore = transfers.length < maxTransfers;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons
          name="swap-horizontal"
          size={18}
          color={COLORS.text.secondary}
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
                { backgroundColor: getLineColor(transfer.lineId) },
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
            <Ionicons
              name="close-circle"
              size={22}
              color={COLORS.gray[400]}
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
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={COLORS.secondary.blue}
          />
          <Text style={styles.addButtonText}>환승역 추가</Text>
        </TouchableOpacity>
      )}

      {/* Max Reached Notice */}
      {!canAddMore && (
        <View style={styles.maxNotice}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.text.tertiary}
          />
          <Text style={styles.maxNoticeText}>
            최대 {maxTransfers}개의 환승역을 추가할 수 있습니다
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    flex: 1,
  },
  countText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  transferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.base,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
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
    marginRight: SPACING.md,
  },
  transferInfo: {
    flex: 1,
  },
  transferName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  transferLine: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.secondary.blue,
    borderRadius: RADIUS.base,
    borderStyle: 'dashed',
  },
  addButtonText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.secondary.blue,
  },
  maxNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  maxNoticeText: {
    marginLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
});

export default TransferStationList;
