/**
 * BackgroundPermissionBanner — presentational nudge for "Always" location.
 * Verifies copy per mode, CTA wiring, accessibility labels, and testID override.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BackgroundPermissionBanner } from '../BackgroundPermissionBanner';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light
  ),
}));

const PROMPT_BODY =
  "위치 접근을 '항상 허용'으로 설정하면 화면이 꺼져도 안내와 알림이 이어져요.";
const SETTINGS_BODY = "설정 앱에서 위치를 '항상 허용'으로 변경할 수 있어요.";

describe('BackgroundPermissionBanner', () => {
  it('renders the prompt-mode title, body, and CTA labels', () => {
    const { getByText, getByTestId } = render(
      <BackgroundPermissionBanner mode="prompt" onPrimary={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(getByText('잠금 화면에서도 길안내 유지')).toBeTruthy();
    expect(getByText(PROMPT_BODY)).toBeTruthy();
    expect(getByTestId('guidance-bg-permission-primary')).toHaveTextContent('허용하기');
    expect(getByTestId('guidance-bg-permission-dismiss')).toHaveTextContent('나중에');
  });

  it('calls onPrimary when the primary CTA is pressed', () => {
    const onPrimary = jest.fn();
    const { getByTestId } = render(
      <BackgroundPermissionBanner mode="prompt" onPrimary={onPrimary} onDismiss={jest.fn()} />
    );
    fireEvent.press(getByTestId('guidance-bg-permission-primary'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the secondary CTA is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <BackgroundPermissionBanner mode="prompt" onPrimary={jest.fn()} onDismiss={onDismiss} />
    );
    fireEvent.press(getByTestId('guidance-bg-permission-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders settings-mode body and CTA label', () => {
    const { getByText, getByTestId } = render(
      <BackgroundPermissionBanner mode="settings" onPrimary={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(getByText(SETTINGS_BODY)).toBeTruthy();
    expect(getByTestId('guidance-bg-permission-primary')).toHaveTextContent('설정 열기');
  });

  it('exposes accessibility labels on both touch targets', () => {
    const { getByLabelText } = render(
      <BackgroundPermissionBanner mode="prompt" onPrimary={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(getByLabelText('허용하기')).toBeTruthy();
    expect(getByLabelText('나중에 하기')).toBeTruthy();
  });

  it('honors a custom testID on the card', () => {
    const { getByTestId } = render(
      <BackgroundPermissionBanner
        mode="prompt"
        onPrimary={jest.fn()}
        onDismiss={jest.fn()}
        testID="custom-bg-banner"
      />
    );
    expect(getByTestId('custom-bg-banner')).toBeTruthy();
  });
});
