/**
 * MarkdownViewer Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MarkdownViewer } from '../MarkdownViewer';

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, onLinkPress, ...props }: any) =>
      React.createElement(
        Text,
        { ...props, testID: 'markdown', onPress: () => onLinkPress?.('https://example.com') },
        children
      ),
  };
});

// Phase 45 — Wanted DS migration: useTheme().isDark drives the semantic
// theme. Mock light variant for deterministic snapshots.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('MarkdownViewer', () => {
  it('renders markdown content', () => {
    const { getByText } = render(
      <MarkdownViewer content="# Hello World" />
    );
    expect(getByText('# Hello World')).toBeTruthy();
  });

  it('calls custom onLinkPress handler when provided', () => {
    const onLinkPress = jest.fn();
    const { getByTestId } = render(
      <MarkdownViewer content="[link](https://example.com)" onLinkPress={onLinkPress} />
    );
    fireEvent.press(getByTestId('markdown'));
    expect(onLinkPress).toHaveBeenCalledWith('https://example.com');
  });

  it('shows alert for external links when no custom handler', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(
      <MarkdownViewer content="[link](https://example.com)" />
    );
    fireEvent.press(getByTestId('markdown'));
    expect(alertSpy).toHaveBeenCalledWith(
      '외부 링크',
      expect.stringContaining('https://example.com'),
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });

  it('renders empty content', () => {
    const { getByTestId } = render(<MarkdownViewer content="" />);
    expect(getByTestId('markdown')).toBeTruthy();
  });
});
