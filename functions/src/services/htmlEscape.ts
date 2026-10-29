/**
 * HTML / header text helpers for email templates.
 *
 * Pure (no firebase imports) so they are unit-testable in isolation.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Escape `& < > " '` so untrusted text is safe in HTML element content and
 * quoted attribute values. Single-pass replace, so `&` is never re-escaped.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

// C0 controls (incl. CR/LF/TAB/NUL), DEL, and C1 controls.
const isControlCharCode = (code: number): boolean =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f);

/**
 * Remove control characters (CR/LF etc.) from plain text destined for an email
 * header such as the subject line. Implemented by char code to avoid a
 * control-character regex.
 */
export function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((char) => !isControlCharCode(char.codePointAt(0) ?? 0))
    .join('');
}
