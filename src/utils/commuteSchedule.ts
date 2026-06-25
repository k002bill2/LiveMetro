/**
 * commuteSchedule — 시간대 → active 통근 leg 해석 (홈 통근 카드 출근/퇴근 자동 전환).
 *
 * `useAutoCommuteLog.detectCommuteType`(로깅 게이트라 공백 구간 null)과 달리, 이 리졸버는
 * 절대 null을 반환하지 않는다: "지금 가장 관련 있는 이동"을 다음 이동 기준으로 답해
 * 카드가 항상 보여줄 방향을 갖게 한다.
 *
 *   morning = 23:00–11:00 (출근 active 06–11 + 심야/새벽: 다음 이동=출근)
 *   evening = 11:00–23:00 (퇴근 active 17–23 + 오후: 다음 이동=퇴근)
 *
 * 경계는 로컬 wall-clock 시각(사용자 기기 TZ) — 통근자가 "아침/저녁"을 생각하는 방식과 일치.
 */
export type CommuteLeg = 'morning' | 'evening';

/** 이 시각(포함)부터 active leg이 morning→evening으로 전환. */
const EVENING_START_HOUR = 11;
/** 이 시각(포함)부터 active leg이 evening→morning으로 전환. */
const MORNING_START_HOUR = 23;

export function resolveActiveCommuteType(now: Date): CommuteLeg {
  const hour = now.getHours();
  // evening은 [11, 23) 구간; 그 외(23–24, 0–11)는 전부 morning.
  return hour >= EVENING_START_HOUR && hour < MORNING_START_HOUR
    ? 'evening'
    : 'morning';
}
