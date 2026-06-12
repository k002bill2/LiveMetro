/**
 * TermsOfServiceScreen Test Suite
 * Wanted handoff legal layout fed with TERMS_SECTIONS (제 1~6 조).
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { TermsOfServiceScreen } from '../TermsOfServiceScreen';
import { TERMS_SECTIONS } from '../legalContent';

jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  ChevronRight: 'ChevronRight',
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

describe('TermsOfServiceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders version 2.4 and the 2025-10-15 revision date', () => {
    const { getByText } = render(<TermsOfServiceScreen />);

    expect(getByText('버전 2.4')).toHaveTextContent('버전 2.4');
    expect(getByText('최종 개정 2025년 10월 15일')).toHaveTextContent(
      '최종 개정 2025년 10월 15일',
    );
  });

  it('renders all six article titles in TOC and body', () => {
    const { getAllByText } = render(<TermsOfServiceScreen />);

    expect(getAllByText('목적')).toHaveLength(2);
    expect(getAllByText('용어의 정의')).toHaveLength(2);
    expect(getAllByText('약관의 효력 및 변경')).toHaveLength(2);
    expect(getAllByText('서비스의 제공 및 중단')).toHaveLength(2);
    expect(getAllByText('이용자의 의무')).toHaveLength(2);
    expect(getAllByText('면책 조항')).toHaveLength(2);
  });

  it('renders exactly six sections (제 1 조 ~ 제 6 조)', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <TermsOfServiceScreen />,
    );

    expect(TERMS_SECTIONS).toHaveLength(6);
    expect(getByTestId('legal-section-5')).toBeTruthy();
    expect(queryByTestId('legal-section-6')).toBeNull();
    expect(getByText('제 6 조')).toHaveTextContent('제 6 조');
    expect(getByText('6개 항목')).toHaveTextContent('6개 항목');
  });

  it('renders the data-dependency disclaimer bullet from 제 4 조', () => {
    const { getByText } = render(<TermsOfServiceScreen />);

    expect(
      getByText(
        '실시간 도착 정보는 운영기관(서울교통공사 등)의 데이터에 의존하므로, 해당 데이터 장애 시 정확도가 저하될 수 있습니다.',
      ),
    ).toHaveTextContent(
      '실시간 도착 정보는 운영기관(서울교통공사 등)의 데이터에 의존하므로, 해당 데이터 장애 시 정확도가 저하될 수 있습니다.',
    );
  });
});
