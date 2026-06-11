import React from 'react';
import { render } from '@testing-library/react-native';
import { GuidanceStepRow } from '../GuidanceStepRow';
import type {
  AlightStep,
  BoardStep,
  RideStep,
  TransferStep,
} from '@/models/guidance';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  Flag: 'Flag',
  Footprints: 'Footprints',
  MoveRight: 'MoveRight',
  TrainFront: 'TrainFront',
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: () => null,
}));

const board: BoardStep = {
  kind: 'board',
  id: 'board-0',
  stationId: 's1',
  stationName: '을지로3가',
  lineId: '2',
  lineName: '2호선',
  direction: '잠실',
  durationMinutes: 0,
};

const ride: RideStep = {
  kind: 'ride',
  id: 'ride-1',
  lineId: '2',
  lineName: '2호선',
  fromStationId: 's1',
  fromStationName: '을지로3가',
  toStationId: 's3',
  toStationName: '대림',
  hops: [
    { toStationId: 's2', toStationName: '신도림', minutes: 30 },
    { toStationId: 's3', toStationName: '대림', minutes: 6 },
  ],
  direction: '잠실',
  durationMinutes: 36,
};

const transfer: TransferStep = {
  kind: 'transfer',
  id: 'transfer-2',
  stationId: 's3',
  stationName: '대림',
  fromLineId: '2',
  toLineId: '7',
  toLineName: '7호선',
  direction: '석남',
  durationMinutes: 4,
};

const alight: AlightStep = {
  kind: 'alight',
  id: 'alight-4',
  stationId: 't5',
  stationName: '산곡',
  lineId: '7',
  durationMinutes: 0,
};

describe('GuidanceStepRow', () => {
  it('renders a board step with station, line, and direction', () => {
    const { getByText } = render(
      <GuidanceStepRow step={board} status="active" isFirst isLast={false} />
    );
    expect(getByText('을지로3가에서 2호선 탑승')).toBeTruthy();
    expect(getByText('잠실 방면')).toBeTruthy();
  });

  it('renders a ride step with hop count and rounded minutes', () => {
    const { getByText } = render(
      <GuidanceStepRow step={ride} status="upcoming" isFirst={false} isLast={false} />
    );
    expect(getByText('을지로3가 → 대림')).toBeTruthy();
    expect(getByText('2개 역 · 약 36분')).toBeTruthy();
  });

  it('renders a transfer step with walk minutes and target line direction', () => {
    const { getByText } = render(
      <GuidanceStepRow step={transfer} status="upcoming" isFirst={false} isLast={false} />
    );
    expect(getByText('대림 환승')).toBeTruthy();
    expect(getByText('도보 약 4분 → 7호선 석남 방면')).toBeTruthy();
  });

  it('renders the destination alight step', () => {
    const { getByText } = render(
      <GuidanceStepRow step={alight} status="upcoming" isFirst={false} isLast />
    );
    expect(getByText('산곡 하차')).toBeTruthy();
    expect(getByText('목적지')).toBeTruthy();
  });

  it('shows 완료 meta on done steps and 진행 중 on the active step', () => {
    const done = render(
      <GuidanceStepRow step={board} status="done" isFirst isLast={false} />
    );
    expect(done.getByText('완료')).toBeTruthy();

    const active = render(
      <GuidanceStepRow step={ride} status="active" isFirst={false} isLast={false} />
    );
    expect(active.getByText('진행 중')).toBeTruthy();
    expect(active.queryByText('완료')).toBeNull();
  });

  it('exposes a combined accessibility label', () => {
    const { getByLabelText } = render(
      <GuidanceStepRow step={transfer} status="done" isFirst={false} isLast={false} />
    );
    expect(getByLabelText('대림 환승, 도보 약 4분 → 7호선 석남 방면, 완료')).toBeTruthy();
  });
});
