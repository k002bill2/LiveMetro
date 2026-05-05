/**
 * Alerts Screen - Modern Design
 * Minimal grayscale with black accent
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  type ListRenderItem,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCheck,
  Clock,
  Plus,
  Star,
  TrainFront,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAlerts } from '../../hooks/useAlerts';
import { useTranslation } from '@/services/i18n';
import { StoredNotification } from '../../services/notification/notificationStorageService';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';
import { useTheme } from '../../services/theme';
import { addTestNotifications, addRandomNotification } from '../../utils/notificationTestHelper';

/**
 * Phase 41 (AL2): top-axis filter for the alerts list, mirroring the
 * design handoff's `전체 / 읽지않음 N / 도착 / 지연 / 정보` chip row
 * (bundle ee09cc40 lines 498-509). Bundle's "제보" label maps to the
 * SERVICE_UPDATE / COMMUTE_REMINDER / FAVORITE group ("정보") here so
 * the chip stays semantic against the type taxonomy from Phase 37.
 */
type FilterId = 'all' | 'unread' | 'arrival' | 'delay' | 'info';

const ARRIVAL_TYPES = new Set(['ARRIVAL', 'arrival_reminder']);
const DELAY_TYPES = new Set([
  'DELAY',
  'DELAY_ALERT',
  'delay_alert',
  'DISRUPTION',
  'EMERGENCY_ALERT',
  'emergency_alert',
]);
const INFO_TYPES = new Set([
  'SERVICE_CHANGE',
  'SERVICE_UPDATE',
  'service_update',
  'COMMUTE_REMINDER',
  'commute_reminder',
  'FAVORITE',
]);

const matchesFilter = (
  notification: StoredNotification,
  filter: FilterId
): boolean => {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !notification.isRead;
    case 'arrival':
      return ARRIVAL_TYPES.has(notification.type);
    case 'delay':
      return DELAY_TYPES.has(notification.type);
    case 'info':
      return INFO_TYPES.has(notification.type);
  }
};

export const AlertsScreen: React.FC = () => {
  const t = useTranslation();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  // Memoize styles so notification updates don't recreate the StyleSheet
  // object on every render (regression noted in cross-review).
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refreshing,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  } = useAlerts();

  const [selectedFilter, setSelectedFilter] = useState<FilterId>('all');

  const filteredNotifications = useMemo(
    () => notifications.filter((n) => matchesFilter(n, selectedFilter)),
    [notifications, selectedFilter]
  );

  // Build filter chip definitions inside render so the unread badge picks
  // up live count changes without extra deps. Order mirrors the bundle.
  const filterChips: readonly { id: FilterId; label: string }[] = useMemo(
    () => [
      { id: 'all', label: '전체' },
      {
        id: 'unread',
        label: unreadCount > 0 ? `읽지않음 ${unreadCount}` : '읽지않음',
      },
      { id: 'arrival', label: '도착' },
      { id: 'delay', label: '지연' },
      { id: 'info', label: '정보' },
    ],
    [unreadCount]
  );

  /**
   * Phase 37 (AL3): map StoredNotification.type to a distinct lucide icon
   * so the alert list visually differentiates types at a glance — mirrors
   * the design handoff's iconForType() in AlertsScreen (ee09cc40 lines
   * 482-489). Type strings are the values written by saveNotification()
   * (see notificationTestHelper for the canonical set).
   */
  const getNotificationIcon = (type: string): LucideIcon => {
    switch (type) {
      case 'ARRIVAL':
      case 'arrival_reminder':
        return TrainFront;
      case 'COMMUTE_REMINDER':
      case 'commute_reminder':
        return Clock;
      case 'DELAY':
      case 'DELAY_ALERT':
      case 'delay_alert':
      case 'DISRUPTION':
      case 'EMERGENCY_ALERT':
      case 'emergency_alert':
        return AlertTriangle;
      case 'SERVICE_CHANGE':
      case 'SERVICE_UPDATE':
      case 'service_update':
        return BarChart3;
      case 'FAVORITE':
        return Star;
      default:
        return Bell;
    }
  };

  /**
   * Phase 37 (AL3): semantic color for the notification icon. Matches the
   * bundle's colorForType() palette — blue for arrival/depart, red for
   * delay/disruption, cyan for service updates, yellow/warn for community
   * + favorite. Returns a string color (not a token name) so callers can
   * pass it directly to Lucide's `color` prop.
   */
  const getNotificationColor = (type: string): string => {
    switch (type) {
      case 'ARRIVAL':
      case 'arrival_reminder':
      case 'COMMUTE_REMINDER':
      case 'commute_reminder':
        return semantic.primaryNormal;
      case 'DELAY':
      case 'DELAY_ALERT':
      case 'delay_alert':
      case 'DISRUPTION':
      case 'EMERGENCY_ALERT':
      case 'emergency_alert':
        return semantic.statusNegative;
      case 'SERVICE_CHANGE':
      case 'SERVICE_UPDATE':
      case 'service_update':
        return WANTED_TOKENS.status.cyan500;
      case 'FAVORITE':
        return WANTED_TOKENS.status.yellow500;
      default:
        return semantic.labelAlt;
    }
  };

  const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금';
    if (diffMins < 60) return `${diffMins}분`;
    if (diffHours < 24) return `${diffHours}시간`;
    if (diffDays < 7) return `${diffDays}일`;

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleNotificationPress = useCallback(async (notification: StoredNotification) => {
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        // 읽음 처리 실패 시 무시 (UX 영향 최소화)
      }
    }
  }, [markAsRead]);

  const handleDelete = useCallback((notificationId: string) => {
    Alert.alert(
      '알림 삭제',
      '이 알림을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notificationId);
            } catch (error) {
              Alert.alert('오류', '알림 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  }, [deleteNotification]);

  const handleClearAll = useCallback(() => {
    if (notifications.length === 0) return;

    Alert.alert(
      '모든 알림 삭제',
      '모든 알림을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '모두 삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAll();
            } catch (error) {
              Alert.alert('오류', '알림 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  }, [notifications.length, clearAll]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      await markAllAsRead();
    } catch (error) {
      Alert.alert('오류', '알림을 읽음으로 표시하는 데 실패했습니다.');
    }
  }, [unreadCount, markAllAsRead]);

  const handleAddTestNotifications = useCallback(async () => {
    try {
      await addTestNotifications();
      await refresh();
      Alert.alert('테스트 알림 추가', '5개의 테스트 알림이 추가되었습니다.');
    } catch (error) {
      Alert.alert('오류', '테스트 알림 추가에 실패했습니다.');
    }
  }, [refresh]);

  const handleAddRandomNotification = useCallback(async () => {
    try {
      await addRandomNotification();
      await refresh();
    } catch {
      // Error adding random notification
    }
  }, [refresh]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Bell size={48} color={semantic.labelAlt} />
      </View>
      <Text style={styles.emptyTitle}>{t.alerts.noAlerts}</Text>
      <Text style={styles.emptySubtitle}>{t.alerts.emptyDescription}</Text>
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devButton}
          onPress={handleAddTestNotifications}
        >
          <Text style={styles.devButtonText}>테스트 알림 추가</Text>
        </TouchableOpacity>
      )}
    </View>
  );


  const keyExtractor = useCallback(
    (notification: StoredNotification) => notification.id,
    []
  );

  const renderNotificationItem: ListRenderItem<StoredNotification> = useCallback(
    ({ item: notification }) => {
      const IconComponent = getNotificationIcon(notification.type);
      const iconColor = getNotificationColor(notification.type);

      return (
        <TouchableOpacity
          style={[
            styles.notificationCard,
            !notification.isRead && styles.unreadCard,
          ]}
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.6}
        >
          <View style={styles.notificationContent}>
            <View style={styles.iconContainer}>
              <IconComponent
                size={18}
                color={iconColor}
                strokeWidth={2}
              />
            </View>

            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Text style={styles.notificationTitle} numberOfLines={1}>
                  {notification.title}
                </Text>
                <Text style={styles.timestamp}>
                  {formatTimestamp(notification.createdAt)}
                </Text>
              </View>
              <Text style={styles.notificationBody} numberOfLines={2}>
                {notification.body}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(notification.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={semantic.labelAlt} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [semantic, styles, handleNotificationPress, handleDelete]
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={semantic.labelStrong} />
          <Text style={styles.loadingText}>알림 로딩중</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={semantic.labelAlt} />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — Phase 4 redesign: 28px Korean title, no English subtitle */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text
            style={styles.headerTitle}
            accessibilityRole="header"
            testID="alerts-header-title"
          >
            {t.alerts.title}
          </Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>
              {t.alerts.unreadCountText(unreadCount)}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {__DEV__ && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleAddRandomNotification}
              onLongPress={handleAddTestNotifications}
            >
              <Plus size={20} color={semantic.labelStrong} />
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleMarkAllAsRead}
            >
              <CheckCheck size={20} color={semantic.labelStrong} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearAll}
            >
              <Trash2 size={20} color={semantic.labelStrong} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips — Phase 41 (AL2): bundle's `전체 / 읽지않음 N
          / 도착 / 지연 / 정보` row. Selected chip uses labelStrong bg
          + labelOnColor text; idle chips show outline + neutral text. */}
      <FlatList
        horizontal
        data={filterChips}
        extraData={selectedFilter}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        renderItem={({ item }) => {
          const isSelected = selectedFilter === item.id;
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                isSelected
                  ? { backgroundColor: semantic.labelStrong, borderColor: semantic.labelStrong }
                  : { borderColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
              ]}
              onPress={() => setSelectedFilter(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`알림 필터: ${item.label}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isSelected ? semantic.labelOnColor : semantic.labelNeutral },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Content */}
      <FlatList
        style={styles.content}
        contentContainerStyle={
          filteredNotifications.length === 0
            ? styles.contentContainer
            : [styles.contentContainer, styles.listContainer]
        }
        data={filteredNotifications}
        keyExtractor={keyExtractor}
        renderItem={renderNotificationItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={semantic.labelStrong}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s1,
    },
    headerTitleWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: WANTED_TOKENS.type.title2.size,
      lineHeight: WANTED_TOKENS.type.title2.lh,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing:
        WANTED_TOKENS.type.title2.size * WANTED_TOKENS.type.title2.tracking,
    },
    headerSubtitle: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryNormal,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 6,
    },
    headerButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    filterRow: {
      flexGrow: 0,
      paddingBottom: WANTED_TOKENS.spacing.s2,
    },
    filterRowContent: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    filterChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
    },
    listContainer: {
      padding: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    notificationCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
    unreadCard: {
      borderColor: semantic.primaryNormal,
      backgroundColor: semantic.primaryBg,
    },
    notificationContent: {
      flexDirection: 'row',
      padding: WANTED_TOKENS.spacing.s4,
      alignItems: 'flex-start',
      gap: WANTED_TOKENS.spacing.s3,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    notificationTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    timestamp: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    notificationBody: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
      lineHeight: WANTED_TOKENS.type.body2.lh,
    },
    deleteButton: {
      padding: WANTED_TOKENS.spacing.s1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s4,
    },
    loadingText: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s4,
    },
    errorTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.primaryNormal,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    retryButtonText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s3,
    },
    emptyIcon: {
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    emptySubtitle: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: WANTED_TOKENS.type.body2.lh,
    },
    devButton: {
      marginTop: WANTED_TOKENS.spacing.s5,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.primaryNormal,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    devButtonText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
  });

export default AlertsScreen;
