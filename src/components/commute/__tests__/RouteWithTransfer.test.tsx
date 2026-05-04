/**
 * RouteWithTransfer — RTL smoke tests covering direct/transfer rendering,
 * the change/add toggle, and radio selection in the alternatives panel.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RouteWithTransfer, TransferOption } from '../RouteWithTransfer';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

const origin = { stationId: 'stn-dep', stationName: '서울역', lineId: '1' };
const destination = { stationId: 'stn-arr', stationName: '강남', lineId: '2' };

const transferSindorim = {
  stationId: 'stn-sindorim',
  stationName: '신도림',
  lineId: '2',
  lineName: '2호선',
  order: 0,
};

const alternatives: readonly TransferOption[] = [
  { id: 'direct', transfer: null, etaMinutes: 28, reason: '환승 없음', recommended: true },
  { id: 'sindorim', transfer: transferSindorim, etaMinutes: 33, reason: '1·2호선 환승' },
];

describe('RouteWithTransfer', () => {
  it('renders the direct (직행) marker when transfer is null', () => {
    const { getByText } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={null}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={false}
        onToggleExpanded={jest.fn()}
      />,
    );
    expect(getByText('직행')).toBeTruthy();
    expect(getByText('환승 추가')).toBeTruthy();
  });

  it('renders the diamond + station name + "변경" when transfer is set', () => {
    const { getByText, queryByText } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={transferSindorim}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={false}
        onToggleExpanded={jest.fn()}
      />,
    );
    expect(getByText('신도림')).toBeTruthy();
    expect(getByText('변경')).toBeTruthy();
    expect(queryByText('직행')).toBeNull();
  });

  it('does not render the alternatives panel when expanded is false', () => {
    const { queryByTestId } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={null}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={false}
        onToggleExpanded={jest.fn()}
      />,
    );
    expect(queryByTestId('route-with-transfer-panel')).toBeNull();
  });

  it('shows the alternatives panel + radio rows when expanded', () => {
    const { getByTestId } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={null}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={true}
        onToggleExpanded={jest.fn()}
      />,
    );
    expect(getByTestId('route-with-transfer-panel')).toBeTruthy();
    expect(getByTestId('route-with-transfer-option-direct')).toBeTruthy();
    expect(getByTestId('route-with-transfer-option-sindorim')).toBeTruthy();
  });

  it('selecting an alternative fires onTransferChange with the matching transfer', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={null}
        alternatives={alternatives}
        onTransferChange={onChange}
        expanded={true}
        onToggleExpanded={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId('route-with-transfer-option-sindorim'));
    expect(onChange).toHaveBeenCalledWith(transferSindorim);

    fireEvent.press(getByTestId('route-with-transfer-option-direct'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('toggle button fires onToggleExpanded', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={null}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={false}
        onToggleExpanded={onToggle}
      />,
    );
    fireEvent.press(getByTestId('route-with-transfer-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks the currently-selected alternative as accessibilityState.selected=true', () => {
    const { getByTestId } = render(
      <RouteWithTransfer
        origin={origin}
        destination={destination}
        transfer={transferSindorim}
        alternatives={alternatives}
        onTransferChange={jest.fn()}
        expanded={true}
        onToggleExpanded={jest.fn()}
      />,
    );
    expect(getByTestId('route-with-transfer-option-sindorim').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('route-with-transfer-option-direct').props.accessibilityState.selected).toBe(false);
  });
});
