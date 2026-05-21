/**
 * stationAccessibility — 역별 엘리베이터 유무 lookup.
 *
 * `src/data/stationAccessibility.json` (scripts/fetchStationAccessibility.ts 산출)
 * 을 읽어 stationId 로 조회한다. `transferTime.ts` 와 동일한 정적-JSON-테이블 패턴.
 *
 * Invariants:
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - 데이터셋에 없는 역 → undefined (unknown). "엘리베이터 없음"으로 단정하지 않는다.
 *  - JSON 의 stations 키 부재 시 빈 테이블 → 모두 undefined (기능 inert, graceful)
 */
import accessibilityJson from '@/data/stationAccessibility.json';

interface StationAccessibilityEntry {
  readonly hasElevator: boolean;
  readonly elevatorCount: number;
}
interface StationAccessibilityFile {
  readonly generatedAt: string;
  readonly source: string;
  readonly stations: Readonly<Record<string, StationAccessibilityEntry>>;
}

const FILE = accessibilityJson as StationAccessibilityFile;
const TABLE: Readonly<Record<string, StationAccessibilityEntry>> = FILE.stations ?? {};

/**
 * 역의 엘리베이터 보유 여부.
 * @returns `true`/`false` = 데이터 있음, `undefined` = 데이터셋 미수록(unknown)
 */
export function stationHasElevator(stationId: string): boolean | undefined {
  return TABLE[stationId]?.hasElevator;
}
