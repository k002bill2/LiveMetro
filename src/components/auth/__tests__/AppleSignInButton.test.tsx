/**
 * AppleSignInButton tests.
 *
 * The component lazily imports expo-apple-authentication in an effect and
 * renders nothing until it resolves (or forever if it fails). Under jest,
 * babel-plugin-dynamic-import-node (env.test) lowers the dynamic import to a
 * lazy require so jest.mock intercepts it. The module-unavailable path uses a
 * toggled factory + resetModules (consistent with the social service suites);
 * jest.dontMock would revert to the real native module and leak into the
 * neighbouring tests that re-import on mount.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { AppleSignInButton } from '@/components/auth/AppleSignInButton';

let mockAppleImportThrows = false;

jest.mock('expo-apple-authentication', () => {
  if (mockAppleImportThrows) {
    throw new Error('native module missing');
  }
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <TouchableOpacity testID="apple-native-button" onPress={onPress}>
        <Text>Apple로 계속하기</Text>
      </TouchableOpacity>
    ),
    AppleAuthenticationButtonType: { CONTINUE: 'CONTINUE' },
    AppleAuthenticationButtonStyle: { BLACK: 'BLACK' },
  };
});

describe('AppleSignInButton', () => {
  afterEach(() => {
    mockAppleImportThrows = false;
  });

  it('renders the native Apple button once the module loads and forwards onPress', async () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AppleSignInButton onPress={onPress} testID="apple-wrap" />,
    );

    await waitFor(() => expect(getByTestId('apple-native-button')).toBeTruthy());

    const wrap = getByTestId('apple-wrap');
    expect(wrap.props.pointerEvents).toBe('auto');
    expect(wrap.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('apple-native-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks the wrapper disabled (pointerEvents none + accessibilityState) when disabled', async () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AppleSignInButton onPress={onPress} disabled testID="apple-wrap" />,
    );

    await waitFor(() => expect(getByTestId('apple-wrap')).toBeTruthy());

    const wrap = getByTestId('apple-wrap');
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.accessibilityState.disabled).toBe(true);
  });

  it('renders nothing when the native module import fails', async () => {
    mockAppleImportThrows = true;
    jest.resetModules();

    const { queryByTestId } = render(
      <AppleSignInButton onPress={jest.fn()} testID="apple-wrap" />,
    );

    // Let the effect's import().catch settle without setting state.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(queryByTestId('apple-wrap')).toBeNull();
    expect(queryByTestId('apple-native-button')).toBeNull();

    mockAppleImportThrows = false;
    jest.resetModules();
  });
});
