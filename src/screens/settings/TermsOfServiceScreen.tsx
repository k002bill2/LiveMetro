/**
 * Terms of Service Screen — Wanted handoff settings-detail-2.jsx
 * `SettingsTermsScreen` (lines 726-736).
 *
 * Shares the LegalDocumentScreen layout with PrivacyPolicyScreen.
 * Content lives in legalContent.ts.
 */

import React from 'react';
import { LegalDocumentScreen } from '@/components/settings/LegalDocumentScreen';
import {
  TERMS_OF_SERVICE_META,
  TERMS_SECTIONS,
} from '@/screens/settings/legalContent';

export const TermsOfServiceScreen: React.FC = () => (
  <LegalDocumentScreen
    intro={TERMS_OF_SERVICE_META.intro}
    sections={TERMS_SECTIONS}
    lastUpdated={TERMS_OF_SERVICE_META.lastUpdated}
    version={TERMS_OF_SERVICE_META.version}
  />
);

TermsOfServiceScreen.displayName = 'TermsOfServiceScreen';

export default TermsOfServiceScreen;
