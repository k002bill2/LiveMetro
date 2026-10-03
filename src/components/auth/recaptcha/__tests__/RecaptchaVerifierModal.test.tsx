import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  RecaptchaVerifierHandle,
  RecaptchaVerifierModal,
} from '@/components/auth/recaptcha/RecaptchaVerifierModal';
import { TEST_FIREBASE_CONFIG } from '@/components/auth/recaptcha/__tests__/fixtures';

const mockInject = jest.fn();

jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const WebView = React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return <View {...props} />;
  });
  return { WebView };
});

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

const msg = (data: object) => ({ nativeEvent: { data: JSON.stringify(data) } });

const setup = () => {
  const ref = createRef<RecaptchaVerifierHandle>();
  const utils = render(
    <RecaptchaVerifierModal ref={ref} firebaseConfig={TEST_FIREBASE_CONFIG} title="본인 확인" cancelLabel="취소" />,
  );
  return { ref, ...utils };
};

beforeEach(() => mockInject.mockClear());

describe('RecaptchaVerifierModal', () => {
  it('exposes the ApplicationVerifier contract including _reset', () => {
    const { ref } = setup();
    expect(ref.current?.type).toBe('recaptcha');
    expect(typeof ref.current?.verify).toBe('function');
    expect(typeof ref.current?._reset).toBe('function');
  });

  it('resolves with the token from the invisible WebView once it has loaded', async () => {
    const { ref, getByTestId } = setup();
    fireEvent(getByTestId('recaptcha-verifier-invisible'), 'message', msg({ type: 'load' }));

    let promise: Promise<string> | undefined;
    act(() => {
      promise = ref.current?.verify();
    });
    expect(mockInject).toHaveBeenCalledTimes(1);

    fireEvent(getByTestId('recaptcha-verifier-invisible'), 'message', msg({ type: 'verify', token: 't1' }));
    await expect(promise).resolves.toBe('t1');
  });

  it('opens the visible modal when the invisible WebView has not loaded yet', () => {
    const { ref, getByTestId } = setup();
    act(() => {
      void ref.current?.verify().catch(() => undefined);
    });
    expect(getByTestId('recaptcha-verifier-visible')).toBeTruthy();
  });

  it('switches to the visible modal on a full challenge', () => {
    const { ref, getByTestId } = setup();
    fireEvent(getByTestId('recaptcha-verifier-invisible'), 'message', msg({ type: 'load' }));
    act(() => {
      void ref.current?.verify().catch(() => undefined);
    });
    fireEvent(getByTestId('recaptcha-verifier-invisible'), 'message', msg({ type: 'fullChallenge' }));
    expect(getByTestId('recaptcha-verifier-visible')).toBeTruthy();
  });

  it('rejects with RECAPTCHA_CANCELLED when the user cancels the modal', async () => {
    const { ref, getByTestId } = setup();
    let promise: Promise<string> | undefined;
    act(() => {
      promise = ref.current?.verify();
    });
    fireEvent.press(getByTestId('recaptcha-verifier-cancel'));
    await expect(promise).rejects.toThrow('RECAPTCHA_CANCELLED');
  });

  it('rejects with RECAPTCHA_LOAD_FAILED when the script fails to load', async () => {
    const { ref, getByTestId } = setup();
    let promise: Promise<string> | undefined;
    act(() => {
      promise = ref.current?.verify();
    });
    fireEvent(getByTestId('recaptcha-verifier-visible'), 'message', msg({ type: 'error' }));
    await expect(promise).rejects.toThrow('RECAPTCHA_LOAD_FAILED');
  });

  it('gets a fresh token on a second verify (tokens are single-use)', async () => {
    const { ref, getByTestId } = setup();
    const invisible = (): ReturnType<typeof getByTestId> => getByTestId('recaptcha-verifier-invisible');

    fireEvent(invisible(), 'message', msg({ type: 'load' }));
    let first: Promise<string> | undefined;
    act(() => {
      first = ref.current?.verify();
    });
    fireEvent(invisible(), 'message', msg({ type: 'verify', token: 't1' }));
    await expect(first).resolves.toBe('t1');

    // 성공 후 invisible WebView 가 재생성되어 load 를 다시 기다린다
    fireEvent(invisible(), 'message', msg({ type: 'load' }));
    let second: Promise<string> | undefined;
    act(() => {
      second = ref.current?.verify();
    });
    fireEvent(invisible(), 'message', msg({ type: 'verify', token: 't2' }));
    await expect(second).resolves.toBe('t2');
  });

  it('rejects a pending verify on unmount', async () => {
    const { ref, unmount } = setup();
    let promise: Promise<string> | undefined;
    act(() => {
      promise = ref.current?.verify();
    });
    unmount();
    await expect(promise).rejects.toThrow('RECAPTCHA_UNMOUNTED');
  });

  it('gives the cancel button an accessibility label', () => {
    const { ref, getByLabelText } = setup();
    act(() => {
      void ref.current?.verify().catch(() => undefined);
    });
    expect(getByLabelText('취소')).toBeTruthy();
  });
});
