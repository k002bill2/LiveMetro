/**
 * Direction Options
 *
 * 제보 작성폼 방면 세그먼트(시안 #2)용 인접역 도출.
 * lines.json subarray 순서가 인접성 SoT — 선택 역의 양옆 역을
 * "{이웃역} 방면" 라벨로 변환한다. 2호선 순환 본선은 양 끝(시청↔충정로)을 wrap.
 */

import { LINE_STATIONS, STATIONS, resolveLineKey } from '@utils/subwayMapData';

/** 역명 정규화 — 말미 '역' 제거 + 공백 트림 ('강남역' ↔ '강남' 매칭). */
const normalizeStationName = (name: string): string =>
  name.trim().replace(/역$/, '');

/**
 * 선택한 노선·역의 진행 방면 옵션 목록.
 *
 * @returns "{인접역} 방면" 배열 (0–2개). 역/노선 미발견 시 빈 배열 —
 *          UI는 빈 배열에서 세그먼트를 숨긴다.
 */
export const getDirectionOptions = (
  lineId: string,
  stationName: string,
): string[] => {
  const target = normalizeStationName(stationName);
  if (!target) return [];

  const lineKey = resolveLineKey(lineId);
  const subarrays = LINE_STATIONS[lineKey] ?? [];

  for (let branch = 0; branch < subarrays.length; branch++) {
    const stationIds = subarrays[branch];
    if (!stationIds) continue;

    const index = stationIds.findIndex(
      id => normalizeStationName(STATIONS[id]?.name ?? '') === target,
    );
    if (index === -1) continue;

    // 2호선 subarray 0은 순환 본선 — 배열 양 끝이 실제로는 이어져 있다.
    const isLoop = lineKey === '2' && branch === 0;
    const lastIndex = stationIds.length - 1;

    const prevId =
      index > 0 ? stationIds[index - 1] : isLoop ? stationIds[lastIndex] : undefined;
    const nextId =
      index < lastIndex ? stationIds[index + 1] : isLoop ? stationIds[0] : undefined;

    return [prevId, nextId]
      .filter((id): id is string => Boolean(id))
      .map(id => `${STATIONS[id]?.name ?? id} 방면`);
  }

  return [];
};
