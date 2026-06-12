/**
 * LegalDocumentScreen Test Suite
 * Shared legal long-form layout: meta card, TOC, numbered sections,
 * bullet paragraphs, contact footer.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  LegalDocumentScreen,
  type LegalSection,
} from '../LegalDocumentScreen';

jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  ChevronRight: 'ChevronRight',
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

const SECTIONS: readonly LegalSection[] = [
  {
    num: '제 1 조',
    title: '첫 번째 조항',
    body: ['첫 번째 단락입니다.', '두 번째 단락입니다.'],
  },
  {
    num: '제 2 조',
    title: '두 번째 조항',
    body: ['세 번째 단락입니다.', '네 번째 단락입니다.', '다섯 번째 단락입니다.'],
  },
];

const defaultProps = {
  intro: '테스트 소개 문단입니다.',
  sections: SECTIONS,
  lastUpdated: '2025년 1월 1일',
  version: '1.0',
};

describe('LegalDocumentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Meta card', () => {
    it('renders version eyebrow, last updated, and intro', () => {
      const { getByText, getByTestId } = render(
        <LegalDocumentScreen {...defaultProps} />,
      );

      expect(getByTestId('legal-meta-card')).toBeTruthy();
      expect(getByText('버전 1.0')).toHaveTextContent('버전 1.0');
      expect(getByText('최종 개정 2025년 1월 1일')).toHaveTextContent(
        '최종 개정 2025년 1월 1일',
      );
      expect(getByText('테스트 소개 문단입니다.')).toHaveTextContent(
        '테스트 소개 문단입니다.',
      );
    });
  });

  describe('Table of contents', () => {
    it('renders one TOC item per section with numbered badges', () => {
      const { getByTestId, queryByTestId, getByText } = render(
        <LegalDocumentScreen {...defaultProps} />,
      );

      expect(getByTestId('legal-toc-item-0')).toBeTruthy();
      expect(getByTestId('legal-toc-item-1')).toBeTruthy();
      expect(queryByTestId('legal-toc-item-2')).toBeNull();
      expect(getByText('1')).toHaveTextContent('1');
      expect(getByText('2')).toHaveTextContent('2');
    });

    it('renders the item-count hint', () => {
      const { getByText } = render(<LegalDocumentScreen {...defaultProps} />);

      expect(getByText('2개 항목')).toHaveTextContent('2개 항목');
    });

    it('shows each section title in both TOC and body', () => {
      const { getAllByText } = render(
        <LegalDocumentScreen {...defaultProps} />,
      );

      expect(getAllByText('첫 번째 조항')).toHaveLength(2);
      expect(getAllByText('두 번째 조항')).toHaveLength(2);
    });

    it('scrolls to the section when a TOC item is pressed after layout', () => {
      const { getByTestId } = render(<LegalDocumentScreen {...defaultProps} />);

      // Report section layout, then tap the matching TOC entry.
      fireEvent(getByTestId('legal-section-1'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 480, width: 375, height: 200 } },
      });

      expect(() =>
        fireEvent.press(getByTestId('legal-toc-item-1')),
      ).not.toThrow();
    });

    it('handles a TOC press before any layout event without crashing', () => {
      const { getByTestId } = render(<LegalDocumentScreen {...defaultProps} />);

      expect(() =>
        fireEvent.press(getByTestId('legal-toc-item-0')),
      ).not.toThrow();
    });
  });

  describe('Body sections', () => {
    it('renders one body block per section with the article eyebrow', () => {
      const { getByTestId, queryByTestId, getByText } = render(
        <LegalDocumentScreen {...defaultProps} />,
      );

      expect(getByTestId('legal-section-0')).toBeTruthy();
      expect(getByTestId('legal-section-1')).toBeTruthy();
      expect(queryByTestId('legal-section-2')).toBeNull();
      expect(getByText('제 1 조')).toHaveTextContent('제 1 조');
      expect(getByText('제 2 조')).toHaveTextContent('제 2 조');
    });

    it('renders every bullet paragraph of every section', () => {
      const { getByText } = render(<LegalDocumentScreen {...defaultProps} />);

      expect(getByText('첫 번째 단락입니다.')).toHaveTextContent('첫 번째 단락입니다.');
      expect(getByText('두 번째 단락입니다.')).toHaveTextContent('두 번째 단락입니다.');
      expect(getByText('세 번째 단락입니다.')).toHaveTextContent('세 번째 단락입니다.');
      expect(getByText('네 번째 단락입니다.')).toHaveTextContent('네 번째 단락입니다.');
      expect(getByText('다섯 번째 단락입니다.')).toHaveTextContent('다섯 번째 단락입니다.');
    });
  });

  describe('Contact footer', () => {
    it('highlights the privacy contact e-mail', () => {
      const { getByText } = render(<LegalDocumentScreen {...defaultProps} />);

      expect(getByText('privacy@livemetro.kr')).toHaveTextContent(
        'privacy@livemetro.kr',
      );
    });
  });

  describe('Edge cases', () => {
    it('renders meta card and zero-item TOC for an empty sections array', () => {
      const { getByText, queryByTestId, getByTestId } = render(
        <LegalDocumentScreen {...defaultProps} sections={[]} />,
      );

      expect(getByTestId('legal-meta-card')).toBeTruthy();
      expect(getByText('0개 항목')).toHaveTextContent('0개 항목');
      expect(queryByTestId('legal-toc-item-0')).toBeNull();
      expect(queryByTestId('legal-section-0')).toBeNull();
    });

    it('renders a section whose body is empty without bullets', () => {
      const emptyBodySections: readonly LegalSection[] = [
        { num: '제 1 조', title: '본문 없는 조항', body: [] },
      ];
      const { getAllByText, getByTestId } = render(
        <LegalDocumentScreen {...defaultProps} sections={emptyBodySections} />,
      );

      expect(getByTestId('legal-section-0')).toBeTruthy();
      expect(getAllByText('본문 없는 조항')).toHaveLength(2);
    });
  });
});
