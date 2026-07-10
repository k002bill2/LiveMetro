import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GuidanceNowCard } from '../GuidanceNowCard';
import type {
  AlightStep,
  BoardStep,
  RideStep,
  TransferStep,
} from '@/models/guidance';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  DoorOpen: 'DoorOpen',
  Footprints: 'Footprints',
  MapPin: 'MapPin',
  TrainFront: 'TrainFront',
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
  toStationId: 's4',
  toStationName: '대림',
  hops: [
    { toStationId: 's2', toStationName: '시청', minutes: 2 },
    { toStationId: 's3', toStationName: '신도림', minutes: 3 },
    { toStationId: 's4', toStationName: '대림', minutes: 2 },
  ],
  direction: '잠실',
  durationMinutes: 7,
};

const transfer: TransferStep = {
  kind: 'transfer',
  id: 'transfer-2',
  stationId: 's4',
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

describe('GuidanceNowCard — board (탑승 대기)', () => {
  it('shows the boarding station, direction header, and live wait chip', () => {
    const { getByText } = render(
      <GuidanceNowCard step={board} elapsedInStepSec={10} liveWaitText="3분 24초 후 도착" />
    );
    expect(getByText('탑승 대기')).toBeTruthy();
    expect(getByText('2호선 · 잠실 방면')).toBeTruthy();
    expect(getByText('을지로3가')).toBeTruthy();
    expect(getByText('3분 24초 후 도착')).toBeTruthy();
  });

  it('falls back to a loading message when no live data', () => {
    const { getByText } = render(
      <GuidanceNowCard step={board} elapsedInStepSec={0} liveWaitText={null} />
    );
    expect(getByText('실시간 도착 정보를 불러오는 중')).toBeTruthy();
  });
});

describe('GuidanceNowCard — ride (탑승 중)', () => {
  it('counts down to the next stop with the mini rail', () => {
    // 60s into hop 1 (시청, 2m) → next 시청, 60s left
    const { getByTestId, getByText } = render(
      <GuidanceNowCard step={ride} elapsedInStepSec={60} />
    );
    expect(getByText('탑승 중')).toBeTruthy();
    expect(getByTestId('guidance-next-station')).toHaveTextContent('시청');
    expect(getByTestId('guidance-countdown')).toHaveTextContent('1분 00초');
    expect(getByText('다음 정차')).toBeTruthy();
    // 3 stops remain (시청, 신도림, 대림) · 60 + 300 = 6분
    expect(getByText('3개 역')).toBeTruthy();
  });

  it('marks the final stop as 하차 when it is next', () => {
    // 2m + 3m passed (300s) + 30s → next 대림 (last hop)
    const { getByTestId, getByText } = render(
      <GuidanceNowCard step={ride} elapsedInStepSec={330} />
    );
    expect(getByTestId('guidance-next-station')).toHaveTextContent('대림');
    expect(getByText('곧 하차역')).toBeTruthy();
    expect(getByText('하차')).toBeTruthy();
  });
});

describe('GuidanceNowCard — transfer (환승 중)', () => {
  it('shows the transfer station, walk countdown, and target line', () => {
    const { getByText } = render(
      <GuidanceNowCard step={transfer} elapsedInStepSec={60} liveWaitText={null} />
    );
    expect(getByText('환승 중')).toBeTruthy();
    expect(getByText('7호선 환승 · 석남 방면')).toBeTruthy();
    expect(getByText('대림')).toBeTruthy();
    // 4m walk - 60s = 3분 00초 남음
    expect(getByText('환승 도보 약 4분 — 3분 00초 남음')).toBeTruthy();
  });
});

describe('GuidanceNowCard — alight (도착)', () => {
  it('tells the rider to get off', () => {
    const { getByText } = render(<GuidanceNowCard step={alight} elapsedInStepSec={0} />);
    expect(getByText('산곡 도착 · 하차하세요')).toBeTruthy();
  });
});

describe('GuidanceNowCard — soft-confirm', () => {
  it('does not render the soft-confirm row when the prop is absent', () => {
    const { queryByTestId } = render(
      <GuidanceNowCard step={board} elapsedInStepSec={0} liveWaitText={null} />
    );
    expect(queryByTestId('guidance-soft-confirm-yes')).toBeNull();
  });

  it('renders the boarding question with 예 / 아직이에요 on a board step', () => {
    const { getByText, getByTestId } = render(
      <GuidanceNowCard
        step={board}
        elapsedInStepSec={0}
        liveWaitText="곧 도착"
        softConfirm={{ onYes: jest.fn(), onNotYet: jest.fn() }}
      />
    );
    expect(getByText('탑승하셨나요?')).toBeTruthy();
    expect(getByTestId('guidance-soft-confirm-yes')).toBeTruthy();
    expect(getByTestId('guidance-soft-confirm-notyet')).toBeTruthy();
  });

  it('renders the soft-confirm row on a transfer step too', () => {
    const { getByTestId } = render(
      <GuidanceNowCard
        step={transfer}
        elapsedInStepSec={0}
        liveWaitText={null}
        softConfirm={{ onYes: jest.fn(), onNotYet: jest.fn() }}
      />
    );
    expect(getByTestId('guidance-soft-confirm-yes')).toBeTruthy();
  });

  it('fires onYes when 예 is pressed', () => {
    const onYes = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard
        step={transfer}
        elapsedInStepSec={0}
        liveWaitText={null}
        softConfirm={{ onYes, onNotYet: jest.fn() }}
      />
    );
    fireEvent.press(getByTestId('guidance-soft-confirm-yes'));
    expect(onYes).toHaveBeenCalledTimes(1);
  });

  it('fires onNotYet when 아직이에요 is pressed', () => {
    const onNotYet = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard
        step={board}
        elapsedInStepSec={0}
        liveWaitText={null}
        softConfirm={{ onYes: jest.fn(), onNotYet }}
      />
    );
    fireEvent.press(getByTestId('guidance-soft-confirm-notyet'));
    expect(onNotYet).toHaveBeenCalledTimes(1);
  });

  it('does not render the 다른 열차에 탔어요 link when onOther is absent', () => {
    const { queryByTestId } = render(
      <GuidanceNowCard
        step={board}
        elapsedInStepSec={0}
        liveWaitText={null}
        softConfirm={{ onYes: jest.fn(), onNotYet: jest.fn() }}
      />
    );
    expect(queryByTestId('guidance-soft-confirm-other')).toBeNull();
  });

  it('fires onOther when 다른 열차에 탔어요 is pressed', () => {
    const onOther = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard
        step={board}
        elapsedInStepSec={0}
        liveWaitText={null}
        softConfirm={{ onYes: jest.fn(), onNotYet: jest.fn(), onOther }}
      />
    );
    fireEvent.press(getByTestId('guidance-soft-confirm-other'));
    expect(onOther).toHaveBeenCalledTimes(1);
  });
});

describe('GuidanceNowCard — train select entry points', () => {
  it('renders the waiting train-select link on a board step and fires it', () => {
    const onOpen = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard
        step={board}
        elapsedInStepSec={0}
        liveWaitText={null}
        onOpenTrainSelect={onOpen}
      />
    );
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders the change-train link on a ride step and fires it', () => {
    const onOpen = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard step={ride} elapsedInStepSec={60} onOpenTrainSelect={onOpen} />
    );
    fireEvent.press(getByTestId('guidance-change-train'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not render any train-select link when the handler is absent', () => {
    const boardCard = render(
      <GuidanceNowCard step={board} elapsedInStepSec={0} liveWaitText={null} />
    );
    expect(boardCard.queryByTestId('guidance-open-train-select')).toBeNull();

    const rideCard = render(<GuidanceNowCard step={ride} elapsedInStepSec={60} />);
    expect(rideCard.queryByTestId('guidance-change-train')).toBeNull();
  });

  it('keeps a single change-train link on a ride step when onOpenStationRebase is absent', () => {
    const onOpen = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <GuidanceNowCard step={ride} elapsedInStepSec={60} onOpenTrainSelect={onOpen} />
    );
    // No rebase entry point → the single change-train link stays.
    expect(queryByTestId('guidance-rebase-station')).toBeNull();
    fireEvent.press(getByTestId('guidance-change-train'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('splits into 열차 변경 and 시간 보정 when onOpenStationRebase is present', () => {
    const onOpenTrainSelect = jest.fn();
    const onOpenStationRebase = jest.fn();
    const { getByTestId } = render(
      <GuidanceNowCard
        step={ride}
        elapsedInStepSec={60}
        onOpenTrainSelect={onOpenTrainSelect}
        onOpenStationRebase={onOpenStationRebase}
      />
    );
    fireEvent.press(getByTestId('guidance-change-train'));
    expect(onOpenTrainSelect).toHaveBeenCalledTimes(1);
    expect(onOpenStationRebase).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('guidance-rebase-station'));
    expect(onOpenStationRebase).toHaveBeenCalledTimes(1);
    expect(onOpenTrainSelect).toHaveBeenCalledTimes(1);
  });

  it('does not render the rebase link on a ride step without onOpenTrainSelect', () => {
    // onOpenStationRebase alone (no train-select) still shows the rebase link.
    const onOpenStationRebase = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <GuidanceNowCard
        step={ride}
        elapsedInStepSec={60}
        onOpenStationRebase={onOpenStationRebase}
      />
    );
    expect(queryByTestId('guidance-change-train')).toBeNull();
    fireEvent.press(getByTestId('guidance-rebase-station'));
    expect(onOpenStationRebase).toHaveBeenCalledTimes(1);
  });
});
