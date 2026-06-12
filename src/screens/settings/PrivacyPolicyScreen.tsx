/**
 * Privacy Policy Screen — Wanted handoff settings-detail-2.jsx
 * `SettingsPrivacyScreen` (lines 714-724).
 *
 * Redesigned from the Phase 45/47 MarkdownViewer rendering to the shared
 * LegalDocumentScreen layout (meta card → TOC → numbered sections →
 * contact footer). Content lives in legalContent.ts.
 */

import React from 'react';
import { LegalDocumentScreen } from '@/components/settings/LegalDocumentScreen';
import {
  PRIVACY_POLICY_META,
  PRIVACY_SECTIONS,
} from '@/screens/settings/legalContent';

export const PrivacyPolicyScreen: React.FC = () => (
  <LegalDocumentScreen
    intro={PRIVACY_POLICY_META.intro}
    sections={PRIVACY_SECTIONS}
    lastUpdated={PRIVACY_POLICY_META.lastUpdated}
    version={PRIVACY_POLICY_META.version}
  />
);

PrivacyPolicyScreen.displayName = 'PrivacyPolicyScreen';

export default PrivacyPolicyScreen;
