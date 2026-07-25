import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DestinationFilterSheet } from '../DestinationFilterSheet';
import type { DestinationOption } from '@/services/guidance/destinationPreference';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  TrainFront: 'TrainFront',
  X: 'X',
  Check: 'Check',
}));

const OPTIONS: readonly DestinationOption[] = [
  { name: '마천', etaText: '2분' },
  { name: '하남검단산', etaText: '5분' },
  { name: '강동', etaText: null },
];

describe('DestinationFilterSheet', () => {
  it('옵션을 "OO행 · ETA" 행으로 렌더하고 탭 시 onToggle을 호출한다', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <DestinationFilterSheet
        visible
        options={OPTIONS}
        selected={['마천']}
        onToggle={onToggle}
        onClear={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 한 행이 제목+서브 두 Text를 담으므로 부분 일치(정규식) 관용구 — RNTL 문자열 매처는 exact.
    expect(getByTestId('destination-option-마천')).toHaveTextContent(/마천행/);
    expect(getByTestId('destination-option-마천')).toHaveTextContent(/2분/);
    expect(getByTestId('destination-option-강동')).toHaveTextContent(/지금은 도착 정보 없음/);
    fireEvent.press(getByTestId('destination-option-하남검단산'));
    expect(onToggle).toHaveBeenCalledWith('하남검단산');
  });

  it('선택된 옵션에 체크 마커, "전체 열차" 행은 선택 없음일 때 활성 표시', () => {
    const { queryByTestId, rerender } = render(
      <DestinationFilterSheet
        visible
        options={OPTIONS}
        selected={['마천']}
        onToggle={jest.fn()}
        onClear={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 체크 마커의 존재/부재 자체가 검증 대상 — queryByTestId 관용구 사용
    expect(queryByTestId('destination-check-마천')).not.toBeNull();
    expect(queryByTestId('destination-check-하남검단산')).toBeNull();
    expect(queryByTestId('destination-all-active')).toBeNull();
    rerender(
      <DestinationFilterSheet
        visible
        options={OPTIONS}
        selected={[]}
        onToggle={jest.fn()}
        onClear={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByTestId('destination-all-active')).not.toBeNull();
    expect(queryByTestId('destination-check-마천')).toBeNull();
  });

  it('"전체 열차" 탭 시 onClear, 백드롭 탭 시 onClose', () => {
    const onClear = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <DestinationFilterSheet
        visible
        options={OPTIONS}
        selected={['마천']}
        onToggle={jest.fn()}
        onClear={onClear}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('destination-filter-all'));
    expect(onClear).toHaveBeenCalled();
    fireEvent.press(getByTestId('destination-filter-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
