/**
 * staticExitLandmarks — 역명별 출구 주요장소 정적 lookup.
 *
 * `src/data/exitLandmarks.json` (scripts/fetchExitLandmarks.ts 산출)을 읽어
 * 역명(stationName)으로 조회한다. `stationAccessibility.ts` 와 동일한
 * 정적-JSON-테이블 패턴 (memory: [Empty-data foundation 패턴]).
 *
 * 왜 정적인가: 라이브 odcloud REST 출구 API 는 실제로 존재하지 않았다(Issue
 * #173 — 원 코드의 15073460 은 죽은 전제였다). 실데이터는 data.go.kr
 * "국가철도공단_서울교통공사 출구별 주요 장소" 파일데이터(CSV)로만 제공되므로,
 * 이를 빌드타임에 정적 JSON 으로 베이크해 SoT 로 쓴다. 미수록 역은 빈 배열을
 * 반환해 "출구 안내 정보가 없습니다" 를 표시한다.
 *
 * Invariants:
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - 데이터셋에 없는 역 → 빈 배열 (unknown). 에러로 취급하지 않는다.
 *  - JSON 의 stations 키 부재 시 빈 테이블 → 모든 역 빈 배열 (기능 inert, graceful)
 *  - 반환값은 방어적 복사본 — 호출부 mutation 이 테이블을 오염시키지 않는다.
 */
import type { ExitLandmark } from '@/models/publicData';
import exitLandmarksJson from '@/data/exitLandmarks.json';

interface ExitLandmarksFile {
  readonly generatedAt: string;
  readonly source: string;
  readonly stations?: Readonly<Record<string, readonly ExitLandmark[]>>;
}

const FILE = exitLandmarksJson as ExitLandmarksFile;
const TABLE: Readonly<Record<string, readonly ExitLandmark[]>> = FILE.stations ?? {};

/**
 * 역명의 정적 출구 주요장소 목록.
 * @param stationName 역명 (예: "서울역"). 데이터셋의 키와 정확히 일치해야 한다.
 * @returns 출구 장소 배열 (방어적 복사본). 미수록 역은 빈 배열.
 */
export function getStaticExitLandmarks(stationName: string): ExitLandmark[] {
  const entry = TABLE[stationName];
  return entry ? [...entry] : [];
}
