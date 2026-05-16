/**
 * ErrorFallback
 *
 * 가이드(2026-05-16) #6 follow-up: 실시간 도착 / 시간표 호출이 실패했을 때
 * 사용자 행동을 유도하는 일관된 UI. `SeoulApiError.category`를 1:1 매핑해
 * "잠시 후 자동 복구됩니다"(quota) / "역 이름을 확인해주세요"(client) 등
 * 사용자가 의미를 읽을 수 있는 메시지로 변환한다.
 *
 * 호출 예:
 *   try {
 *     const arrivals = await seoulSubwayApi.getRealtimeArrival(name);
 *     ...
 *   } catch (err) {
 *     return <ErrorFallback error={err} onRetry={refetch} />;
 *   }
 *
 * Non-SeoulApiError(네트워크, 알 수 없는 throw 등)는 generic 메시지 +
 * retry 버튼으로 graceful degrade.
 */

import { AlertTriangle, Info, RefreshCw, WifiOff } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SeoulApiError, SeoulApiErrorCategory } from '@/services/api/seoulSubwayApi';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, weightToFontFamily } from '@/styles/modernTheme';

export interface ErrorFallbackProps {
  /** 표시할 에러. SeoulApiError이면 category로 분기, 아니면 generic fallback */
  readonly error: unknown;
  /** retry 버튼 핸들러. 미제공 시 retry CTA 미렌더 */
  readonly onRetry?: () => void;
  /** 테스트/외부 셀렉터용 (선택) */
  readonly testID?: string;
}

interface FallbackCopy {
  readonly title: string;
  readonly description: string;
  /** retry 버튼 렌더 여부. 사용자 행동이 의미 있는 카테고리만 true */
  readonly showRetry: boolean;
  /** lucide 아이콘 - 시각적 위중도 신호 */
  readonly Icon: typeof AlertTriangle;
  /** 아이콘 색 - 위중도/카테고리별 */
  readonly iconColor: string;
}

const CATEGORY_COPY: Record<SeoulApiErrorCategory, FallbackCopy> = {
  // 일시 장애 - retry가 가장 합리적 행동
  transient: {
    title: '도착정보를 잠시 가져올 수 없어요',
    description: '서버가 일시적으로 응답이 늦습니다. 잠시 후 다시 시도해주세요.',
    showRetry: true,
    Icon: AlertTriangle,
    iconColor: COLORS.semantic.warning,
  },
  // 할당량/서버 부하 - 자동 복구 안내 + 선택적 retry
  quota:  {
    title: '잠시 후 자동 복구됩니다',
    description: '서버 부하로 응답이 제한되고 있어요. 잠시 후 자동으로 다시 시도합니다.',
    showRetry: true,
    Icon: AlertTriangle,
    iconColor: COLORS.semantic.warning,
  },
  // 인증 실패 - 사용자 행동 불가, 앱 업데이트 안내
  auth: {
    title: '앱 업데이트가 필요해요',
    description: '데이터 제공처 인증 정보가 만료되었습니다. 최신 버전으로 업데이트 해주세요.',
    showRetry: false,
    Icon: Info,
    iconColor: COLORS.semantic.error,
  },
  // 사용자 입력 오류 - 역 이름 등 확인 유도
  client: {
    title: '역 정보를 다시 확인해주세요',
    description: '요청에 문제가 있습니다. 역 이름이 정확한지 확인해주세요.',
    showRetry: false,
    Icon: Info,
    iconColor: COLORS.semantic.error,
  },
  // 분류 불가 - generic + retry
  unknown: {
    title: '문제가 발생했어요',
    description: '알 수 없는 오류로 정보를 불러오지 못했습니다. 다시 시도해주세요.',
    showRetry: true,
    Icon: AlertTriangle,
    iconColor: COLORS.semantic.error,
  },
};

// Non-SeoulApiError용 - 네트워크 끊김 / 알 수 없는 throw
const NETWORK_FALLBACK: FallbackCopy = {
  title: '연결을 확인해주세요',
  description: '인터넷 연결에 문제가 있는 것 같습니다. 연결 상태를 확인 후 다시 시도해주세요.',
  showRetry: true,
  Icon: WifiOff,
  iconColor: COLORS.semantic.error,
};

const selectCopy = (error: unknown): FallbackCopy => {
  if (error instanceof SeoulApiError) {
    return CATEGORY_COPY[error.category];
  }
  return NETWORK_FALLBACK;
};

export const ErrorFallback: React.FC<ErrorFallbackProps> = memo(({ error, onRetry, testID }) => {
  const copy = useMemo(() => selectCopy(error), [error]);
  const { title, description, showRetry, Icon, iconColor } = copy;
  const retryVisible = showRetry && typeof onRetry === 'function';

  return (
    <View
      style={styles.container}
      testID={testID}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${description}`}
    >
      <Icon size={48} color={iconColor} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {retryVisible && (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <RefreshCw size={16} color={COLORS.white} />
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
});

ErrorFallback.displayName = 'ErrorFallback';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: weightToFontFamily('600'),
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: weightToFontFamily('400'),
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary.main,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: weightToFontFamily('600'),
    color: COLORS.white,
    marginLeft: SPACING.xs,
  },
});
