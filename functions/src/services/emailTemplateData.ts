/**
 * Email template data sanitizer.
 *
 * The sendEmailNotification callable payload is untyped at runtime, so every
 * field is read as `unknown` and normalized here before it reaches an HTML
 * template: strings are HTML-escaped, numbers are coerced, anything else falls
 * back to the template default. Kept free of firebase imports so it is a pure,
 * unit-testable module.
 */

import { escapeHtml, stripControlChars } from './htmlEscape';

/** Template-ready fields. HTML fields are already escaped. */
export interface SafeEmailFields {
  /** Plain text for the subject line (control chars stripped, NOT escaped). */
  subjectLineName: string | null;
  lineName: string | null;
  stationName: string | null;
  reason: string | null;
  message: string | null;
  /** Finite number rendered as text; '0' when missing or invalid. */
  delayMinutes: string;
  affectedLines: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const readEscaped = (record: Record<string, unknown>, key: string): string | null => {
  const value = readString(record, key);
  return value === null ? null : escapeHtml(value);
};

const readDelayMinutes = (value: unknown): string => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return escapeHtml(String(Number.isFinite(parsed) ? parsed : 0));
};

const readAffectedLines = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === 'string' && line.length > 0)
        .map(escapeHtml)
    : [];

/** Normalize an untyped notification payload into template-safe fields. */
export function sanitizeEmailData(data: unknown): SafeEmailFields {
  const record = isRecord(data) ? data : {};
  const rawLineName = readString(record, 'lineName');
  const subjectLineName = rawLineName === null ? null : stripControlChars(rawLineName);

  return {
    subjectLineName: subjectLineName && subjectLineName.length > 0 ? subjectLineName : null,
    lineName: readEscaped(record, 'lineName'),
    stationName: readEscaped(record, 'stationName'),
    reason: readEscaped(record, 'reason'),
    message: readEscaped(record, 'message'),
    delayMinutes: readDelayMinutes(record.delayMinutes),
    affectedLines: readAffectedLines(record.affectedLines),
  };
}
