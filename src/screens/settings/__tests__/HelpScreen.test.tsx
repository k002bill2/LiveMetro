/**
 * HelpScreen Test Suite — Wanted 핸드오프 재설계판.
 * 검색 필터링 / 단일 열림 아코디언 / 문의 채널 Linking / 빈 검색 edge /
 * 그 외 Row 네비게이션을 검증한다.
 *
 * Note: 이 프로젝트 전역 타입에는 RNTL 매처 중 toHaveTextContent만 노출되어
 * 있어(toBeVisible 등은 TS2339), 존재 검증은 toHaveTextContent / not.toBeNull
 * 조합으로 작성한다.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HelpScreen } from '../HelpScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({
    isDark: false,
  }),
}));

jest.mock('@/utils/helpContent', () => ({
  FAQ_DATA: [
    {
      id: 'notification-1',
      category: '푸시',
      question: '푸시가 오지 않아요',
      answer: '기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.',
    },
    {
      id: 'favorites-1',
      category: '즐겨찾기',
      question: '즐겨찾기 추가 방법',
      answer: '역 상세에서 별 아이콘을 탭하세요.',
    },
    {
      id: 'account-1',
      category: '탈퇴',
      question: '탈퇴 절차가 궁금해요',
      answer: '고객센터로 문의하세요.',
    },
  ],
  SUPPORT_EMAIL: 'support@livemetro.app',
  SUPPORT_PHONE: '1234-5678',
}));

const mockNavigate = jest.fn();

describe('HelpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  // ─── 렌더링 ───

  it('renders search bar with design placeholder', () => {
    const { queryByPlaceholderText } = render(<HelpScreen />);

    expect(queryByPlaceholderText('궁금한 점을 검색해보세요')).not.toBeNull();
  });

  it('renders all FAQ questions including adopted design FAQ', () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('푸시가 오지 않아요')).toHaveTextContent(
      '푸시가 오지 않아요'
    );
    expect(getByText('즐겨찾기 추가 방법')).toHaveTextContent(
      '즐겨찾기 추가 방법'
    );
    expect(getByText('탈퇴 절차가 궁금해요')).toHaveTextContent(
      '탈퇴 절차가 궁금해요'
    );
    // 디자인 FAQS 중 채택된 항목 (익명 로그인 실재)
    expect(getByText('계정 없이 이용할 수 있나요?')).toHaveTextContent(
      '계정 없이 이용할 수 있나요?'
    );
  });

  it('renders FAQ count hint matching visible questions', () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('4개 질문')).toHaveTextContent('4개 질문');
  });

  it('renders both real contact channels (email + phone)', () => {
    const { getByTestId, queryByText } = render(<HelpScreen />);

    expect(getByTestId('help-contact-email')).toHaveTextContent(/이메일 문의/);
    expect(getByTestId('help-contact-email')).toHaveTextContent(
      /support@livemetro\.app/
    );
    expect(getByTestId('help-contact-phone')).toHaveTextContent(/전화 문의/);
    expect(getByTestId('help-contact-phone')).toHaveTextContent(/1234-5678/);
    // 코드에 없는 채널은 배치 금지 (honesty)
    expect(queryByText('카카오톡 상담')).toBeNull();
  });

  // ─── 검색 필터링 ───

  it('filters FAQ items by search query in real time', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HelpScreen />
    );

    fireEvent.changeText(
      getByPlaceholderText('궁금한 점을 검색해보세요'),
      '즐겨찾기'
    );

    expect(getByText('즐겨찾기 추가 방법')).toHaveTextContent(
      '즐겨찾기 추가 방법'
    );
    expect(queryByText('푸시가 오지 않아요')).toBeNull();
    expect(queryByText('탈퇴 절차가 궁금해요')).toBeNull();
    expect(queryByText('계정 없이 이용할 수 있나요?')).toBeNull();
    expect(getByText('1개 질문')).toHaveTextContent('1개 질문');
  });

  it('matches answers as well as questions when filtering', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HelpScreen />
    );

    // '별 아이콘'은 즐겨찾기 항목의 답변에만 존재
    fireEvent.changeText(
      getByPlaceholderText('궁금한 점을 검색해보세요'),
      '별 아이콘'
    );

    expect(getByText('즐겨찾기 추가 방법')).toHaveTextContent(
      '즐겨찾기 추가 방법'
    );
    expect(queryByText('푸시가 오지 않아요')).toBeNull();
  });

  it('shows empty state when no FAQ matches the query', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <HelpScreen />
    );

    fireEvent.changeText(
      getByPlaceholderText('궁금한 점을 검색해보세요'),
      '존재하지않는검색어xyz'
    );

    expect(getByText('검색 결과가 없습니다')).toHaveTextContent(
      '검색 결과가 없습니다'
    );
    expect(getByText('0개 질문')).toHaveTextContent('0개 질문');
    expect(queryByText('즐겨찾기 추가 방법')).toBeNull();
  });

  it('restores full list when search is cleared via clear button', () => {
    const { getByPlaceholderText, getByText, getByTestId, queryByText } =
      render(<HelpScreen />);

    fireEvent.changeText(
      getByPlaceholderText('궁금한 점을 검색해보세요'),
      '존재하지않는검색어xyz'
    );
    expect(queryByText('검색 결과가 없습니다')).not.toBeNull();

    fireEvent.press(getByTestId('help-search-clear'));

    expect(getByText('푸시가 오지 않아요')).toHaveTextContent(
      '푸시가 오지 않아요'
    );
    expect(getByText('4개 질문')).toHaveTextContent('4개 질문');
  });

  // ─── FAQ 아코디언 ───

  it('expands FAQ answer when question is tapped', () => {
    const { getByTestId, getByText, queryByText } = render(<HelpScreen />);

    expect(
      queryByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).toBeNull();

    fireEvent.press(getByTestId('help-faq-notification-1'));

    expect(
      getByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).toHaveTextContent('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.');
  });

  it('collapses expanded FAQ when tapped again', () => {
    const { getByTestId, queryByText } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-faq-notification-1'));
    expect(
      queryByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).not.toBeNull();

    fireEvent.press(getByTestId('help-faq-notification-1'));
    expect(
      queryByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).toBeNull();
  });

  it('keeps only one FAQ open at a time', () => {
    const { getByTestId, getByText, queryByText } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-faq-notification-1'));
    expect(
      queryByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).not.toBeNull();

    fireEvent.press(getByTestId('help-faq-favorites-1'));

    expect(getByText('역 상세에서 별 아이콘을 탭하세요.')).toHaveTextContent(
      '역 상세에서 별 아이콘을 탭하세요.'
    );
    expect(
      queryByText('기기 설정에서 LiveMetro 푸시 허용 여부를 확인해주세요.')
    ).toBeNull();
  });

  // ─── 문의 채널 ───

  it('opens mailto url when email contact card is pressed', () => {
    const { getByTestId } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-contact-email'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      'mailto:support@livemetro.app'
    );
  });

  it('opens tel url when phone contact card is pressed', () => {
    const { getByTestId } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-contact-phone'));

    expect(Linking.openURL).toHaveBeenCalledWith('tel:1234-5678');
  });

  it('shows friendly alert when email app cannot be opened', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(
      new Error('no mail app')
    );
    const { getByTestId } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-contact-email'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '이메일 앱을 열 수 없습니다.'
      );
    });
  });

  // ─── 그 외 섹션 ───

  it('navigates to Feedback when 의견 보내기 row is pressed', () => {
    const { getByTestId } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-misc-feedback'));

    expect(mockNavigate).toHaveBeenCalledWith('Feedback');
  });

  it('navigates to PrivacyPolicy when 개인정보 처리방침 row is pressed', () => {
    const { getByTestId } = render(<HelpScreen />);

    fireEvent.press(getByTestId('help-misc-privacy'));

    expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
  });
});
