/**
 * timetableCoverage
 *
 * Issue #173: 서울열린데이터광장 SearchSTNTimeTableByIDService API(서울교통공사
 * 시간표 데이터셋)는 숫자 1~9호선만 보유한다. Korail/사철이 운영하는 광역·경전철
 * 노선(경의중앙선·수인분당선·공항철도·신분당선·경춘선·GTX·인천1·2호선·신림선·
 * 우이신설·용인·의정부경전철 등)은 역코드를 어떻게 넣어도 INFO-200("해당하는
 * 데이터가 없습니다")을 반환한다.
 *
 * → 라이브 API probe(2026-06-04, 노선별 대표역 1개씩 조회)로 직접 검증한 결과,
 *   커버리지 경계가 운영사가 아니라 "노선 번호 브랜딩"과 정확히 일치했다.
 *   (예: 1호선 평택지제는 Korail 운영 외곽 구간이지만 `01호선`으로 브랜딩되어
 *    87건의 시간표를 반환한다.)
 *
 * 따라서 이 predicate는 **whitelist(숫자 1~9만 true)**로 구현한다. 알 수 없는
 * 표기/신설 광역 노선은 자동으로 false가 되어 정직한 "미제공" 안내를 받는다 —
 * blacklist보다 안전하다(미래에 새 광역 노선이 추가돼도 버그 오인 없음).
 */

/**
 * 허용 표기: "1".."9", "1호선".."9호선", "01호선".."09호선".
 * - 선두 0 1개 optional (zero-padded seoulStations.json line_num 대응)
 * - "호선" suffix optional (lineId가 "2"로 들어오는 StationDetailScreen 대응)
 * - "10"+, "0", 역코드("1251"), 광역 노선명("경의선")은 모두 불일치 → false
 */
const SEOUL_METRO_TIMETABLE_LINE = /^0?[1-9](호선)?$/;

/**
 * 주어진 노선 식별자가 서울교통공사 시간표 API가 커버하는 숫자 1~9호선인지 여부.
 *
 * @param line StationDetailScreen의 lineId / useTrainSchedule의 lineNumber
 *             (예: "2", "2호선", "경의선"). 앞뒤 공백은 무시한다.
 * @returns 시간표 API 호출이 의미 있는 노선이면 true, 그 외(광역·경전철·미상)는 false.
 */
export function isSeoulMetroTimetableLine(line: string): boolean {
  return SEOUL_METRO_TIMETABLE_LINE.test(line.trim());
}
