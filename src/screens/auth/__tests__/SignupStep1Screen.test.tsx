/**
 * SignupStep1Screen — RTL smoke tests.
 *
 * Covers: input field gating, phase transition (input → OTP), and the
 * Firebase Phone Auth wiring (requestPhoneVerification + confirmPhoneCode).
 */
import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { SignupStep1Screen } from '../SignupStep1Screen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRequestPhoneVerification = jest.fn();
const mockConfirmPhoneCode = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: jest.fn(() => true),
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    requestPhoneVerification: mockRequestPhoneVerification,
    confirmPhoneCode: mockConfirmPhoneCode,
  })),
}));

jest.mock('@/services/firebase/config', () => ({
  firebaseConfig: {
    apiKey: 'mock',
    authDomain: 'mock',
    projectId: 'mock',
    storageBucket: 'mock',
    messagingSenderId: 'mock',
    appId: 'mock',
  },
}));

// RecaptchaVerifierModal — forwardRef View 로 대체하고 verify() 스텁을 노출한다
// (signInWithPhoneNumber 자체가 mock 이라 verify 는 호출되지 않지만 화면은 ref 를 넘긴다).
jest.mock('@/components/auth/recaptcha/RecaptchaVerifierModal', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const RecaptchaVerifierModal = React.forwardRef(function MockRecaptchaVerifierModal(
    props: unknown,
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      type: 'recaptcha',
      verify: jest.fn(() => Promise.resolve('token')),
      _reset: jest.fn(),
    }));
    return <View {...(props as object)} />;
  });
  return { RecaptchaVerifierModal };
});

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  );
  return { __esModule: true, default: passthrough, Svg: passthrough, Path: passthrough };
});

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const stub = () => <View />;
  return new Proxy(
    { __esModule: true },
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return stub;
      },
    },
  );
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockRequestPhoneVerification.mockReset();
  mockConfirmPhoneCode.mockReset();
});

describe('SignupStep1Screen', () => {
  it('renders input phase with disabled "인증 요청" button when fields incomplete', () => {
    const { getByTestId, getByText } = render(<SignupStep1Screen />);
    expect(getByTestId('signup-step1-title')).toBeTruthy();
    expect(getByText('본인 인증')).toBeTruthy();
    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables "인증 요청" after filling all required fields, then transitions to OTP phase on success', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId, queryByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => {
      expect(mockRequestPhoneVerification).toHaveBeenCalledWith('+821012345678', expect.anything());
      // 화면이 넘기는 verifier 는 RecaptchaVerifierModal(위 mock) 의 핸들이어야 한다 —
      // Firebase 가 내부에서 호출하는 _reset 까지 포함한 ApplicationVerifier 계약.
      const verifier = mockRequestPhoneVerification.mock.calls[0][1];
      expect(jest.isMockFunction(verifier._reset)).toBe(true);
      expect(queryByTestId('otp-title')).toBeTruthy();
      expect(queryByTestId('otp-cell-0')).toBeTruthy();
    });
  });

  it('confirms the OTP code via confirmPhoneCode when "인증" is pressed', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    mockConfirmPhoneCode.mockResolvedValue(undefined);
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      [0, 1, 2, 3, 4, 5].forEach((i) => {
        fireEvent.changeText(getByTestId(`otp-cell-${i}`), String(i + 1));
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('verify-button'));
    });

    await waitFor(() => {
      expect(mockConfirmPhoneCode).toHaveBeenCalledWith('vid-123', '123456');
    });
    // No navigate('SignUp') anymore — RootNavigator handles routing via auth state.
    expect(mockNavigate).not.toHaveBeenCalledWith('SignUp');
  });

  it('distributes an SMS-autofilled 6-digit code across all OTP cells', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    mockConfirmPhoneCode.mockResolvedValue(undefined);
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    // 키패드 위 "메시지에서" 제안을 탭하면 포커스된 첫 칸에 6자리가 한 번에 들어온다.
    const firstCell = getByTestId('otp-cell-0');
    expect(firstCell.props.maxLength).not.toBe(1);
    expect(firstCell.props.textContentType).toBe('oneTimeCode');
    expect(firstCell.props.autoComplete).toBe('sms-otp');
    act(() => {
      fireEvent.changeText(firstCell, '987654');
    });

    ['9', '8', '7', '6', '5', '4'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });

    await act(async () => {
      fireEvent.press(getByTestId('verify-button'));
    });
    await waitFor(() => {
      expect(mockConfirmPhoneCode).toHaveBeenCalledWith('vid-123', '987654');
    });
  });

  it('replaces only the current cell when typing into an already-filled cell', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-0'), '123456');
    });
    // 세 번째 칸("3") 끝에 9 입력 → onChangeText 에는 "39" 가 온다.
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), '39');
    });

    ['1', '2', '9', '4', '5', '6'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });

    // 채워진 칸("9") 끝에 새 전체 코드 붙여넣기 → "9"+"987654" 7자리가 온다.
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), '9987654');
    });
    ['9', '8', '7', '6', '5', '4'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });
  });

  // #379: 칸별 직전 선택(onSelectionChange)으로 삽입 문자열을 복원한다. 값만으로는
  // "3 이 선택된 채 38 붙여넣기"와 "3 뒤에 8 타이핑"을 구분할 수 없다 (QA 경계 표).
  it.each([
    ['selected', { start: 0, end: 1 }, '98', '129856'],
    ['selected', { start: 0, end: 1 }, '98765', '129876'],
    ['selected', { start: 0, end: 1 }, '38', '123856'],
    ['selected', { start: 0, end: 1 }, '83', '128356'],
    ['selected', { start: 0, end: 1 }, '33', '123356'],
    ['selected', { start: 0, end: 1 }, '5', '125456'],
    ['cursor end', { start: 1, end: 1 }, '398', '129856'],
    ['cursor end', { start: 1, end: 1 }, '35', '125456'],
    ['cursor front', { start: 0, end: 0 }, '53', '125456'],
    ['selected', { start: 0, end: 1 }, '654321', '654321'],
    ['cursor end', { start: 1, end: 1 }, '3654321', '654321'],
    ['cursor end', { start: 1, end: 1 }, '', '12_456'],
    // 이벤트 순서 가드: 변경 후 선택(이전 값 길이 밖)이 먼저 기록돼도 커서 끝으로 안전하게 처리.
    ['post-change selection first', { start: 3, end: 3 }, '398', '129856'],
  ])('partial paste into cell 3 (%s %j) with "%s" → %s (#379)', async (_label, selection, value, expected) => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-0'), '123456');
    });
    act(() => {
      fireEvent(getByTestId('otp-cell-2'), 'selectionChange', { nativeEvent: { selection } });
    });
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), value);
    });
    expected.split('').forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d === '_' ? '' : d);
    });
  });

  // #379 이벤트 순서 가드: Android 에서 변경 후 선택이 onChangeText 보다 먼저 와도 직전 (0,1) 선택을 쓴다.
  it.each([
    [{ start: 1, end: 1 }, '5', '125456'],
    [{ start: 2, end: 2 }, '98', '129856'],
    [{ start: 2, end: 2 }, '38', '123856'],
  ])('handles post-change selection %j arriving before "%s" → %s (#379)', async (post, value, expected) => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-0'), '123456');
    });
    act(() => {
      fireEvent(getByTestId('otp-cell-2'), 'selectionChange', { nativeEvent: { selection: { start: 0, end: 1 } } });
    });
    act(() => {
      fireEvent(getByTestId('otp-cell-2'), 'selectionChange', { nativeEvent: { selection: post } });
    });
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), value);
    });
    expected.split('').forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });
  });

  // #379 보조 B: iOS 탭 포커스는 selectTextOnFocus 가 안 걸리므로 onFocus 에서 직접 선택·기록한다.
  // JS 에서 건 선택은 onSelectionChange 로 돌아오지 않으므로 selectionChange 이벤트 없이 검증한다.
  it('selects the existing digit on focus so a following paste replaces it (#379)', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-0'), '123456');
    });
    act(() => {
      fireEvent(getByTestId('otp-cell-2'), 'focus');
    });
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), '38');
    });
    ['1', '2', '3', '8', '5', '6'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });
  });

// ── #379 FIX2: QA r2 G 표(셀 123456, 칸3="3") — 이벤트 순서 비의존 처리 ──
  const enterOtpWith123456 = async (): Promise<ReturnType<typeof render>> => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const utils = render(<SignupStep1Screen />);
    fireEvent.press(utils.getByTestId('carrier-skt'));
    fireEvent.changeText(utils.getByTestId('name-input'), '홍길동');
    fireEvent.changeText(utils.getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(utils.getByTestId('birth-input'), '900101');
    await act(async () => {
      fireEvent.press(utils.getByTestId('request-otp-button'));
    });
    act(() => {
      fireEvent.changeText(utils.getByTestId('otp-cell-0'), '123456');
    });
    return utils;
  };
  const selectCell = (utils: ReturnType<typeof render>, idx: number, start: number, end: number): void => {
    act(() => {
      fireEvent(utils.getByTestId(`otp-cell-${idx}`), 'selectionChange', { nativeEvent: { selection: { start, end } } });
    });
  };
  const cellValues = (utils: ReturnType<typeof render>): string =>
    Array.from({ length: 6 }, (_, i) => (utils.getByTestId(`otp-cell-${i}`).props.value as string) || '_').join('');

  describe('event-order independent OTP edits (#379 FIX2, QA r2 G table)', () => {
    // RN jest mock TextInput 에는 setSelection 이 없다 → 재선택 호출을 단언하려고 프로토타입에 스텁한다.
    const { TextInput } = jest.requireActual('react-native');
    const setSelection = jest.fn();
    beforeEach(() => {
      setSelection.mockClear();
      TextInput.prototype.setSelection = setSelection;
    });
    afterEach(() => {
      delete TextInput.prototype.setSelection;
    });

    // G1 iOS 탭: onFocus 기록 (0,1) 뒤 탭 caret (1,1) 이 온다 → 첫 접힌 선택은 전체 선택으로 되돌린다.
    it.each([
      ['98', '129856'],
      ['5', '125456'],
      ['38', '123856'],
      ['33', '123356'],
      ['3', '123456'],
    ])('G1 focus → caret (1,1) → re-select → "%s" → %s', async (value, expected) => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      setSelection.mockClear();
      selectCell(utils, 2, 1, 1);
      expect(setSelection).toHaveBeenCalledTimes(1);
      expect(setSelection).toHaveBeenCalledWith(0, 1);
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), value);
      });
      expect(cellValues(utils)).toBe(expected);
    });

    it('G1 same-digit retype keeps the cell and moves focus to the next cell', async () => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      selectCell(utils, 2, 1, 1);
      const focusSpy = jest.spyOn(TextInput.prototype, 'focus');
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '3');
      });
      expect(cellValues(utils)).toBe('123456');
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('re-selects only once per focus — a second collapsed caret is recorded as a user move', async () => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      setSelection.mockClear();
      selectCell(utils, 2, 1, 1);
      selectCell(utils, 2, 1, 1);
      expect(setSelection).toHaveBeenCalledTimes(1);
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '35');
      });
      // 두 번째 (1,1) 은 사용자 커서(끝)로 존중 → "5" 만 삽입.
      expect(cellValues(utils)).toBe('125456');
    });

    it('does not re-select when the first post-focus selection already spans the digit (Android selectTextOnFocus)', async () => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      setSelection.mockClear();
      selectCell(utils, 2, 0, 1); // 플래그 소비, 재선택 없음
      selectCell(utils, 2, 1, 1); // 이후 접힌 선택 = 사용자 커서 이동(G3) → 존중
      expect(setSelection).not.toHaveBeenCalled();
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '35');
      });
      expect(cellValues(utils)).toBe('125456');
    });

    it('clears the re-select flag on blur', async () => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'blur');
      });
      setSelection.mockClear();
      selectCell(utils, 2, 1, 1);
      expect(setSelection).not.toHaveBeenCalled();
    });

    // G2 Android 변경 후 선택 먼저: (0,1) → post → 값
    it.each([
      [{ start: 1, end: 1 }, '3', '123456'],
      [{ start: 1, end: 1 }, '5', '125456'],
      [{ start: 1, end: 1 }, '8', '128456'],
      [{ start: 2, end: 2 }, '33', '123356'],
      [{ start: 2, end: 2 }, '38', '123856'],
    ])('G2 (0,1) → post-change %j → "%s" → %s', async (post, value, expected) => {
      const utils = await enterOtpWith123456();
      selectCell(utils, 2, 0, 1);
      selectCell(utils, 2, post.start, post.end);
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), value);
      });
      expect(cellValues(utils)).toBe(expected);
    });

    // G3 선택 후 사용자 커서 이동은 존중한다.
    it.each([
      [[[0, 1], [1, 1]], '35', '125456'],
      [[[0, 1], [1, 1], [2, 2]], '35', '125456'],
      [[[0, 1], [0, 0], [1, 1]], '53', '125456'],
      [[[0, 1], [1, 1], [1, 1]], '98', '129856'],
    ])('G3 selections %j → "%s" → %s', async (sels, value, expected) => {
      const utils = await enterOtpWith123456();
      (sels as [number, number][]).forEach(([s, e]) => selectCell(utils, 2, s, e));
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), value);
      });
      expect(cellValues(utils)).toBe(expected);
    });

    // G4 선택을 쓴 뒤 같은 칸 재변경(선택 기록 없음) → 커서 끝 가정.
    it('G4 re-change after the selection was consumed, no selection, "98" → 128456', async () => {
      const utils = await enterOtpWith123456();
      selectCell(utils, 2, 0, 1);
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '9');
      });
      expect(cellValues(utils)).toBe('129456');
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '98');
      });
      expect(cellValues(utils)).toBe('128456');
    });

    // 회귀 (QA r2 2절): 순차 타이핑·삭제
    it('sequential typing into empty cells fills 123456 and enables verify', async () => {
      mockRequestPhoneVerification.mockResolvedValue('vid-123');
      mockConfirmPhoneCode.mockResolvedValue(undefined);
      const utils = render(<SignupStep1Screen />);
      fireEvent.press(utils.getByTestId('carrier-skt'));
      fireEvent.changeText(utils.getByTestId('name-input'), '홍길동');
      fireEvent.changeText(utils.getByTestId('phone-input'), '01012345678');
      fireEvent.changeText(utils.getByTestId('birth-input'), '900101');
      await act(async () => {
        fireEvent.press(utils.getByTestId('request-otp-button'));
      });
      '123456'.split('').forEach((d, i) => {
        act(() => {
          fireEvent(utils.getByTestId(`otp-cell-${i}`), 'focus');
        });
        selectCell(utils, i, 0, 0);
        act(() => {
          fireEvent.changeText(utils.getByTestId(`otp-cell-${i}`), d);
        });
      });
      expect(cellValues(utils)).toBe('123456');
      await act(async () => {
        fireEvent.press(utils.getByTestId('verify-button'));
      });
      await waitFor(() => {
        expect(mockConfirmPhoneCode).toHaveBeenCalledWith('vid-123', '123456');
      });
    });

    it('deleting a digit clears only that cell', async () => {
      const utils = await enterOtpWith123456();
      act(() => {
        fireEvent(utils.getByTestId('otp-cell-2'), 'focus');
      });
      selectCell(utils, 2, 1, 1);
      act(() => {
        fireEvent.changeText(utils.getByTestId('otp-cell-2'), '');
      });
      expect(cellValues(utils)).toBe('12_456');
    });
  });
});
