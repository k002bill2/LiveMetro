import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';

jest.mock('../../../utils/performanceUtils', () => ({
  performanceMonitor: {
    startMeasure: jest.fn(),
    endMeasure: jest.fn(),
  },
}));

// Component that throws on demand
const ThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>정상 컨텐츠</Text>;
};

// Suppress console.error for expected errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(getByText('정상 컨텐츠')).toBeTruthy();
  });

  it('shows fallback UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('문제가 발생했습니다')).toBeTruthy();
  });

  it('shows custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<Text>커스텀 에러</Text>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('커스텀 에러')).toBeTruthy();
  });

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('renders retry button in default fallback', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('shows error details in dev mode', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Test error')).toBeTruthy();
  });
});

describe('withErrorBoundary', () => {
  it('wraps component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(
      () => <Text>Wrapped</Text>,
    );
    const { getByText } = render(<WrappedComponent />);
    expect(getByText('Wrapped')).toBeTruthy();
  });

  it('sets displayName', () => {
    const MyComponent = () => <Text>Test</Text>;
    MyComponent.displayName = 'MyComponent';
    const Wrapped = withErrorBoundary(MyComponent);
    expect(Wrapped.displayName).toBe('withErrorBoundary(MyComponent)');
  });
});
