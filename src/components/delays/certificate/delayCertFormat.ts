/**
 * 지연증명서 화면 공용 포맷터 — Wanted handoff (settings-detail-2.jsx §1)
 *
 * 화면/히어로/리스트 row가 같은 날짜·시각 표기를 쓰도록 SoT로 분리.
 */

import { DelayHistoryEntry, DelayReasonLabels } from '@/models/delayCertificate';

/** 발급 가능 기한 — 지연 발생일 기준 30일 */
export const CERT_VALID_DAYS = 30;
const CERT_VALID_MS = CERT_VALID_DAYS * 24 * 60 * 60 * 1000;

export const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 서비스/스토리지가 Date 대신 ISO 문자열을 줄 수 있어 항상 정규화 */
export const toDate = (value: Date | string | number): Date => new Date(value);

/** 지연 발생일 기준 30일 경과 여부 */
export const isEntryExpired = (timestamp: Date | string | number): boolean =>
  Date.now() - toDate(timestamp).getTime() > CERT_VALID_MS;

/** "08:32" — 탑승 시각 */
export const formatBoardTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/** "12월 8일 · 월" — 히어로 날짜 pill */
export const formatHeroDate = (date: Date): string =>
  `${date.getMonth() + 1}월 ${date.getDate()}일 · ${WEEKDAY_SHORT[date.getDay()]}`;

/** "12.08" — 이력 날짜 컬럼 상단 */
export const formatMonthDay = (date: Date): string =>
  `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

/** "2025.12.08" — 발급 내역 타이틀 */
export const formatIssuedDate = (date: Date): string =>
  `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

/** "HH:MM 탑승 · 사유" — 사유 없으면 자연스럽게 생략 */
export const formatEntrySub = (entry: DelayHistoryEntry): string => {
  const board = `${formatBoardTime(toDate(entry.timestamp))} 탑승`;
  return entry.reason ? `${board} · ${DelayReasonLabels[entry.reason]}` : board;
};
