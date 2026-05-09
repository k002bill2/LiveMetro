/**
 * Color Utility Functions
 * Seoul subway line colors and theme utilities
 */

/**
 * Seoul Subway Line Colors (Official Colors — Wanted Design System aligned)
 *
 * Source of truth for all subway line color usage. Numeric line ids match
 * Seoul Metro official colors; short aliases (sb/bd/gj/gx) match the design
 * handoff data.js LINES map for use with LineBadge.
 */
export const SUBWAY_LINE_COLORS = {
  '1': '#0052A4',   // Line 1 - Dark Blue (official)
  '2': '#00A84D',   // Line 2 - Green
  '3': '#EF7C1C',   // Line 3 - Orange
  '4': '#00A5DE',   // Line 4 - Sky Blue (official)
  '5': '#996CAC',   // Line 5 - Purple
  '6': '#CD7C2F',   // Line 6 - Brown
  '7': '#747F00',   // Line 7 - Olive Green
  '8': '#E6186C',   // Line 8 - Pink
  '9': '#BDB092',   // Line 9 - Gold (official)

  // Short aliases (design handoff convention)
  'sb': '#D4003B',  // 신분당
  'bd': '#FABE00',  // 분당 / 수인분당
  'gj': '#77C4A3',  // 경의중앙
  'gx': '#0090D2',  // 공항철도

  // Long-form aliases (legacy / Korean-name partial matchers)
  'gyeongui': '#77C4A3',
  'jungang': '#77C4A3',
  'bundang': '#FABE00',
  'sinbundang': '#D4003B',
  'gyeongchun': '#32C6A6',
  'suin': '#FABE00',
  'uijeongbu': '#FFA500',
  'ever': '#7CC4A0',
  'seohae': '#8FC31F',
  'gimpo': '#888B8D',
  'wooyisinseol': '#B0CE18',
  'airport': '#0090D2',
  'gyeonggang': '#0054A6',
} as const;

/**
 * Status Colors
 */
export const STATUS_COLORS = {
  success: '#10b981',    // Green
  warning: '#f59e0b',    // Amber
  error: '#ef4444',      // Red
  info: '#3b82f6',       // Blue
  
  // Delay Severity Colors
  minor: '#10b981',      // Green - No significant delay
  moderate: '#f59e0b',   // Amber - 5-10 minutes
  major: '#fb923c',      // Orange - 10-20 minutes  
  severe: '#ef4444',     // Red - 20+ minutes
} as const;

/**
 * Theme Colors
 */
export const THEME_COLORS = {
  light: {
    primary: '#2563eb',
    primaryLight: '#dbeafe',
    secondary: '#6b7280',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827',
    textSecondary: '#6b7280',
    textLight: '#9ca3af',
    border: '#e5e7eb',
    success: STATUS_COLORS.success,
    warning: STATUS_COLORS.warning,
    error: STATUS_COLORS.error,
    info: STATUS_COLORS.info,
  },
  dark: {
    primary: '#3b82f6',
    primaryLight: '#1e40af',
    secondary: '#9ca3af',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textLight: '#9ca3af',
    border: '#374151',
    success: STATUS_COLORS.success,
    warning: STATUS_COLORS.warning,
    error: STATUS_COLORS.error,
    info: STATUS_COLORS.info,
  },
} as const;

/**
 * Get subway line color by line ID
 */
export const getSubwayLineColor = (lineId: string): string => {
  // Normalize line ID. Strips spaces and punctuation but PRESERVES Korean
  // characters (가-힣) so the Korean-substring fallbacks below match
  // inputs like '신분당선' or '경의중앙선'. The previous `[^a-z0-9]` strip
  // zeroed out Korean inputs and made every Korean line render with the
  // gray fallback (Gemini critical, post PR #40).
  const normalizedId = lineId.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

  // Check exact matches first
  if (normalizedId in SUBWAY_LINE_COLORS) {
    return SUBWAY_LINE_COLORS[normalizedId as keyof typeof SUBWAY_LINE_COLORS];
  }

  // Check for partial matches. Order matters: more-specific tokens first,
  // because '신분당' contains '분당' and would otherwise resolve to bundang.
  if (normalizedId.includes('경의') || normalizedId.includes('중앙')) {
    return SUBWAY_LINE_COLORS.gyeongui;
  }
  if (normalizedId.includes('신분당')) {
    return SUBWAY_LINE_COLORS.sinbundang;
  }
  if (normalizedId.includes('분당')) {
    return SUBWAY_LINE_COLORS.bundang;
  }
  if (normalizedId.includes('경춘')) {
    return SUBWAY_LINE_COLORS.gyeongchun;
  }
  if (normalizedId.includes('수인')) {
    return SUBWAY_LINE_COLORS.suin;
  }
  if (normalizedId.includes('의정부')) {
    return SUBWAY_LINE_COLORS.uijeongbu;
  }
  if (normalizedId.includes('에버') || normalizedId.includes('ever')) {
    return SUBWAY_LINE_COLORS.ever;
  }
  if (normalizedId.includes('서해')) {
    return SUBWAY_LINE_COLORS.seohae;
  }
  if (normalizedId.includes('김포')) {
    return SUBWAY_LINE_COLORS.gimpo;
  }
  if (normalizedId.includes('우이') || normalizedId.includes('신설')) {
    return SUBWAY_LINE_COLORS.wooyisinseol;
  }
  if (normalizedId.includes('공항') || normalizedId.includes('airport')) {
    return SUBWAY_LINE_COLORS.airport;
  }
  if (normalizedId.includes('경강')) {
    return SUBWAY_LINE_COLORS.gyeonggang;
  }
  
  // Extract numeric line (e.g., "1호선" -> "1")
  const numericMatch = lineId.match(/\d+/);
  if (numericMatch) {
    const lineNumber = numericMatch[0];
    if (lineNumber in SUBWAY_LINE_COLORS) {
      return SUBWAY_LINE_COLORS[lineNumber as keyof typeof SUBWAY_LINE_COLORS];
    }
  }
  
  // Default color for unknown lines
  return '#6b7280';
};

/**
 * Get delay severity color
 */
export const getDelayColor = (delayMinutes: number): string => {
  if (delayMinutes < 5) return STATUS_COLORS.minor;
  if (delayMinutes < 10) return STATUS_COLORS.moderate;
  if (delayMinutes < 20) return STATUS_COLORS.major;
  return STATUS_COLORS.severe;
};

/**
 * Get status color by status name
 */
export const getStatusColor = (status: keyof typeof STATUS_COLORS): string => {
  return STATUS_COLORS[status];
};

/**
 * Convert hex color to RGB
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16)
  } : null;
};

/**
 * Convert RGB to hex
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/**
 * Add alpha channel to hex color
 */
export const addAlpha = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

/**
 * Lighten a color by percentage
 */
export const lighten = (hex: string, percentage: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = 1 + (percentage / 100);
  
  return rgbToHex(
    Math.min(255, Math.round(rgb.r * factor)),
    Math.min(255, Math.round(rgb.g * factor)),
    Math.min(255, Math.round(rgb.b * factor))
  );
};

/**
 * Darken a color by percentage
 */
export const darken = (hex: string, percentage: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = 1 - (percentage / 100);
  
  return rgbToHex(
    Math.max(0, Math.round(rgb.r * factor)),
    Math.max(0, Math.round(rgb.g * factor)),
    Math.max(0, Math.round(rgb.b * factor))
  );
};

/**
 * Get contrasting text color for background
 */
export const getContrastingColor = (backgroundColor: string): 'white' | 'black' => {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return 'black';
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  return luminance > 0.5 ? 'black' : 'white';
};

/**
 * Get accessible text color for subway line
 */
export const getLineTextColor = (lineId: string): 'white' | 'black' => {
  const backgroundColor = getSubwayLineColor(lineId);
  return getContrastingColor(backgroundColor);
};

/**
 * Generate gradient colors
 */
export const generateGradient = (
  startColor: string,
  endColor: string,
  steps: number = 10
): string[] => {
  const startRgb = hexToRgb(startColor);
  const endRgb = hexToRgb(endColor);
  
  if (!startRgb || !endRgb) return [startColor, endColor];
  
  const colors: string[] = [];
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    
    const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * ratio);
    const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * ratio);
    const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * ratio);
    
    colors.push(rgbToHex(r, g, b));
  }
  
  return colors;
};

/**
 * Get theme colors based on color scheme
 */
export const getThemeColors = (colorScheme: 'light' | 'dark' = 'light') => {
  return THEME_COLORS[colorScheme];
};
