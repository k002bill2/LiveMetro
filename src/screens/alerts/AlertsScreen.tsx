/**
 * Alerts Screen - Modern Design
 * Minimal grayscale with black accent
 */

import React, { useCallback, useMemo } from 'react';
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
  Bell,
  Plus,
  CheckCheck,
  Trash2,
  AlertCircle,
  X,
  Circle,
} from 'lucide-react-native';
import { useAlerts } from '../../hooks/useAlerts';
import { useTranslation } from '@/services/i18n';
import { StoredNotification } from '../../services/notification/notificationStorageService';
import { SPACING, RADIUS, TYPOGRAPHY, WANTED_TOKENS } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';
import { addTestNotifications, addRandomNotification } from '../../utils/notificationTestHelper';

export const AlertsScreen: React.FC = () => {
  const t = useTranslation();
  const { colors, isDark } = useTheme();
  // Memoize styles so notification updates don't recreate the StyleSheet
  // object on every render (regression noted in cross-review).
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ARRIVAL':
      case 'DELAY':
      case 'DISRUPTION':
      case 'SERVICE_CHANGE':
      case 'FAVORITE':
        return Circle;
      default:
        return Circle;
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
        <Bell size={48} color={colors.textTertiary} />
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
                size={8}
                color={notification.isRead ? colors.textTertiary : colors.textPrimary}
                fill={notification.isRead ? colors.textTertiary : colors.textPrimary}
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
              <X size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, styles, handleNotificationPress, handleDelete]
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={styles.loadingText}>알림 로딩중</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.textTertiary} />
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
              <Plus size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleMarkAllAsRead}
            >
              <CheckCheck size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearAll}
            >
              <Trash2 size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <FlatList
        style={styles.content}
        contentContainerStyle={
          notifications.length === 0
            ? styles.contentContainer
            : [styles.contentContainer, styles.listContainer]
        }
        data={notifications}
        keyExtractor={keyExtractor}
        renderItem={renderNotificationItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.textPrimary}
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

const createStyles = (colors: ThemeColors, isDark: boolean) => {
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: semantic.labelStrong,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 9999,
    backgroundColor: semantic.bgBase,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  listContainer: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  unreadCard: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
  },
  notificationContent: {
    flexDirection: 'row',
    padding: SPACING.lg,
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
  },
  notificationBody: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
    gap: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: colors.textPrimary,
    borderRadius: RADIUS.base,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textInverse,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  emptyIcon: {
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  devButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: colors.textPrimary,
    borderRadius: RADIUS.base,
  },
  devButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textInverse,
  },
  });
};

export default AlertsScreen;
