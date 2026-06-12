/**
 * PrivacyPolicyScreen Test Suite
 * Wanted handoff legal layout fed with PRIVACY_SECTIONS (제 1~5 조).
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { PrivacyPolicyScreen } from '../PrivacyPolicyScreen';
import { PRIVACY_SECTIONS } from '../legalContent';

jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  ChevronRight: 'ChevronRight',
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

describe('PrivacyPolicyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders version 3.2 and the 2025-11-01 revision date', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);

    expect(getByText('버전 3.2')).toHaveTextContent('버전 3.2');
    expect(getByText('최종 개정 2025년 11월 1일')).toHaveTextContent(
      '최종 개정 2025년 11월 1일',
    );
  });

  it('renders all five article titles in TOC and body', () => {
    const { getAllByText } = render(<PrivacyPolicyScreen />);

    expect(getAllByText('개인정보의 수집 항목 및 방법')).toHaveLength(2);
    expect(getAllByText('개인정보의 이용 목적')).toHaveLength(2);
    expect(getAllByText('개인정보의 보유 및 이용 기간')).toHaveLength(2);
    expect(getAllByText('개인정보의 제3자 제공')).toHaveLength(2);
    expect(getAllByText('이용자의 권리와 행사 방법')).toHaveLength(2);
  });

  it('renders exactly five sections (제 1 조 ~ 제 5 조)', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <PrivacyPolicyScreen />,
    );

    expect(PRIVACY_SECTIONS).toHaveLength(5);
    expect(getByTestId('legal-section-4')).toBeTruthy();
    expect(queryByTestId('legal-section-5')).toBeNull();
    expect(getByText('제 5 조')).toHaveTextContent('제 5 조');
    expect(getByText('5개 항목')).toHaveTextContent('5개 항목');
  });

  it('renders the retention-period bullet from 제 3 조', () => {
    const { getByText } = render(<PrivacyPolicyScreen />);

    expect(getByText('접속 로그 기록: 3개월 (통신비밀보호법)')).toHaveTextContent(
      '접속 로그 기록: 3개월 (통신비밀보호법)',
    );
  });
});
