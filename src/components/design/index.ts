/**
 * Design system atomic components — Wanted Design System foundation.
 *
 * Phase 1 of the design refresh adds these primitives. Screens migrate to
 * them in Phases 2–4.
 */
export { LineBadge } from './LineBadge';
export type { LineId } from './LineBadge';

export { Pill } from './Pill';
export type { PillTone, PillSize } from './Pill';

export { CongestionBar } from './CongestionBar';
export { CongestionDots } from './CongestionDots';
export { CongestionMeter } from './CongestionMeter';
export type { CongestionStyle } from './CongestionMeter';

export { CONG_TONE, congFromPct } from './congestion';
export type { CongestionLevel } from './congestion';

/* Phase 2 — HomeScreen building blocks */
export { MLHeroCard, MLHeroCardPlaceholder } from './MLHeroCard';
export { HomeTopBar } from './HomeTopBar';
export { QuickActionsGrid } from './QuickActionsGrid';
export type { QuickAction } from './QuickActionsGrid';

/* Phase 3B — list row primitive */
export { FavoriteRow } from './FavoriteRow';

/* Phase 9 — section divider/title with optional action */
export { SectionHeader } from './SectionHeader';

/* Phase 33 — community/system delay preview card for HomeScreen "실시간 제보" slot */
export { CommunityDelayCard } from './CommunityDelayCard';

/* Phase 35 — multi-leg journey visual strip for RoutesScreen */
export { JourneyStrip } from './JourneyStrip';
export type { JourneyStripLeg } from './JourneyStrip';
