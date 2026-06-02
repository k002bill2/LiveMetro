import {
  getBoardingSelection,
  setBoardingSelection,
  clearBoardingSelection,
  boardingSelectionMatches,
  type BoardingSelection,
} from '../boardingSelectionStore';

/**
 * boardingSelectionStore — 사용자가 "이 열차로 탑승 시작"한 선택을 화면 간에
 * 옮기는 JS-heap 모듈 싱글턴. 열차 ID는 30초 폴링마다 갱신/소멸하므로 저장하지
 * 않고, 폴링을 가로질러 안정적인 (역 + 노선 + 방향 + 종착지)로 매칭한다.
 */

const sample = (overrides: Partial<BoardingSelection> = {}): BoardingSelection => ({
  stationId: 'gangnam',
  stationName: '강남',
  lineId: '2',
  direction: 'down',
  finalDestination: '잠실',
  selectedCar: 7,
  ...overrides,
});

describe('boardingSelectionStore', () => {
  afterEach(() => {
    clearBoardingSelection();
  });

  it('returns null by default', () => {
    expect(getBoardingSelection()).toBeNull();
  });

  it('stores and reads back a selection', () => {
    setBoardingSelection(sample());
    expect(getBoardingSelection()).toEqual(sample());
  });

  it('stores a copy so external mutation cannot corrupt the store', () => {
    const input = sample();
    setBoardingSelection(input);
    expect(getBoardingSelection()).not.toBe(input);
  });

  it('clears the selection back to null', () => {
    setBoardingSelection(sample());
    clearBoardingSelection();
    expect(getBoardingSelection()).toBeNull();
  });
});

describe('boardingSelectionMatches', () => {
  it('is false for a null selection', () => {
    expect(boardingSelectionMatches(null, { stationId: 'gangnam', lineId: '2' })).toBe(false);
  });

  it('is false when the line differs', () => {
    expect(
      boardingSelectionMatches(sample(), { stationId: 'gangnam', lineId: '3' })
    ).toBe(false);
  });

  it('matches on stationId + lineId when both ids are present', () => {
    expect(
      boardingSelectionMatches(sample(), { stationId: 'gangnam', lineId: '2' })
    ).toBe(true);
  });

  it('is false when stationIds differ', () => {
    expect(
      boardingSelectionMatches(sample(), { stationId: 'yeoksam', lineId: '2' })
    ).toBe(false);
  });

  it('falls back to stationName when the target has no stationId', () => {
    expect(
      boardingSelectionMatches(sample(), { stationName: '강남', lineId: '2' })
    ).toBe(true);
  });

  it('is false when the stationName differs in the fallback path', () => {
    expect(
      boardingSelectionMatches(sample(), { stationName: '역삼', lineId: '2' })
    ).toBe(false);
  });
});
