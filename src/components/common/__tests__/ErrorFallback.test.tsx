/**
 * ErrorFallback Component Tests
 *
 * Covers SeoulApiError 5 category branches + non-SeoulApiError generic +
 * retry button visibility/invocation semantics. Each category has its own
 * copy + Icon mapping so we assert on title text (user-visible contract).
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ErrorFallback } from '../ErrorFallback';
import { SeoulApiError } from '@/services/api/seoulSubwayApi';

// 글로벌 setup.ts가 seoulSubwayApi 모듈을 mock하면서 SeoulApiError 클래스를
// 누락. 이 테스트는 실제 클래스의 categorize 동작이 필요하므로 partial
// override로 진짜 SeoulApiError를 가져오고 instance(seoulSubwayApi)는 비움.
// (memory: [Partial mock requireActual])
jest.mock('@/services/api/seoulSubwayApi', () => {
  const actual = jest.requireActual('@/services/api/seoulSubwayApi');
  return {
    SeoulApiError: actual.SeoulApiError,
    // 컴포넌트는 instance 메서드를 부르지 않음 - 빈 객체로 충분
    seoulSubwayApi: {},
  };
});

// react-native-svg mock 필요 - 다른 lucide 컴포넌트 테스트와 일관
// (memory: [lucide+svg 테스트 mock])
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Svg: View,
    G: View,
    Path: View,
    Circle: View,
    Rect: View,
    Line: View,
    Polyline: View,
    Polygon: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
  };
});

describe('ErrorFallback', () => {
  describe('SeoulApiError category copy mapping', () => {
    it('renders transient copy and retry button for ERROR-336', () => {
      const error = new SeoulApiError('ERROR-336', 'partial response');

      const { getByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('도착정보를 잠시 가져올 수 없어요')).toBeTruthy();
      expect(getByText(/잠시 후 다시 시도/)).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });

    it('renders quota copy and retry button for ERROR-500', () => {
      const error = new SeoulApiError('ERROR-500', 'server overload');

      const { getByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('잠시 후 자동 복구됩니다')).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });

    it('renders auth copy without retry button for ERROR-331', () => {
      const error = new SeoulApiError('ERROR-331', 'key expired');

      const { getByText, queryByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('앱 업데이트가 필요해요')).toBeTruthy();
      // auth는 사용자가 retry로 해결 불가 - 버튼 숨김
      expect(queryByText('다시 시도')).toBeNull();
    });

    it('renders client copy without retry button for ERROR-300', () => {
      const error = new SeoulApiError('ERROR-300', 'bad request');

      const { getByText, queryByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('역 정보를 다시 확인해주세요')).toBeTruthy();
      // client error는 입력 수정이 필요 - retry 의미 없음
      expect(queryByText('다시 시도')).toBeNull();
    });

    it('renders unknown copy and retry button for unmapped code', () => {
      const error = new SeoulApiError('ERROR-9999', 'never seen');

      const { getByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('문제가 발생했어요')).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });
  });

  describe('Non-SeoulApiError graceful degrade', () => {
    it('renders network fallback for generic Error (e.g. fetch failure)', () => {
      const error = new Error('Network request failed');

      const { getByText } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      expect(getByText('연결을 확인해주세요')).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });

    it('renders network fallback for non-Error throw (string, undefined)', () => {
      const { getByText } = render(
        <ErrorFallback error={'string throw'} onRetry={jest.fn()} />
      );

      expect(getByText('연결을 확인해주세요')).toBeTruthy();
    });

    it('renders network fallback for null error', () => {
      const { getByText } = render(
        <ErrorFallback error={null} onRetry={jest.fn()} />
      );

      expect(getByText('연결을 확인해주세요')).toBeTruthy();
    });
  });

  describe('Retry button behavior', () => {
    it('invokes onRetry handler when pressed', () => {
      const onRetry = jest.fn();
      const error = new SeoulApiError('ERROR-336', 'transient');

      const { getByLabelText } = render(
        <ErrorFallback error={error} onRetry={onRetry} />
      );

      fireEvent.press(getByLabelText('다시 시도'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('hides retry button when onRetry is undefined even for retryable category', () => {
      const error = new SeoulApiError('ERROR-336', 'transient');

      const { queryByText } = render(<ErrorFallback error={error} />);

      // showRetry는 true지만 onRetry 미제공 → 버튼 미렌더 (no-op 방지)
      expect(queryByText('다시 시도')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('exposes role=alert with combined title + description label', () => {
      const error = new SeoulApiError('ERROR-336', 'transient');

      const { getByRole } = render(
        <ErrorFallback error={error} onRetry={jest.fn()} />
      );

      const alert = getByRole('alert');
      expect(alert.props.accessibilityLabel).toContain('도착정보를 잠시 가져올 수 없어요');
      expect(alert.props.accessibilityLabel).toContain('잠시 후 다시 시도');
    });

    it('forwards testID to container', () => {
      const error = new SeoulApiError('ERROR-500', 'quota');

      const { getByTestId } = render(
        <ErrorFallback error={error} testID="arrival-error" />
      );

      expect(getByTestId('arrival-error')).toBeTruthy();
    });
  });
});
