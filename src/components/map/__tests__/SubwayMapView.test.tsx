import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SubwayMapView from '../SubwayMapView';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text: RNText } = require('react-native');
  const mockComponent = (name: string) => {
    const Component = (props: Record<string, unknown>) =>
      React.createElement(View, { testID: name, ...props }, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    G: mockComponent('G'),
    Line: mockComponent('Line'),
    Circle: mockComponent('Circle'),
    Text: (props: Record<string, unknown>) =>
      React.createElement(RNText, props, props.children),
  };
});

const mockStations = [
  { id: 'st1', name: '강남', x: 100, y: 200, lineIds: ['2'], isTransfer: false },
  { id: 'st2', name: '역삼', x: 150, y: 200, lineIds: ['2'], isTransfer: false },
  { id: 'st3', name: '교대', x: 100, y: 250, lineIds: ['2', '3'], isTransfer: true },
] as const;

const mockLines = [
  { lineId: '2', fromStation: 'st1', toStation: 'st2', color: '#00A84D' },
  { lineId: '2', fromStation: 'st2', toStation: 'st3', color: '#00A84D' },
] as const;

describe('SubwayMapView', () => {
  it('renders zoom control buttons', () => {
    const { getByLabelText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    expect(getByLabelText('확대')).toBeTruthy();
    expect(getByLabelText('축소')).toBeTruthy();
    expect(getByLabelText('초기화')).toBeTruthy();
  });

  it('displays initial scale indicator at 100%', () => {
    const { getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    expect(getByText('100%')).toBeTruthy();
  });

  it('displays scale indicator at custom initial scale', () => {
    const { getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} initialScale={1.5} />,
    );
    expect(getByText('150%')).toBeTruthy();
  });

  it('renders legend items', () => {
    const { getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    expect(getByText('환승역')).toBeTruthy();
    expect(getByText('선택됨')).toBeTruthy();
  });

  it('increases scale when zoom in button is pressed', () => {
    const { getByLabelText, getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    fireEvent.press(getByLabelText('확대'));
    expect(getByText('125%')).toBeTruthy();
  });

  it('decreases scale when zoom out button is pressed', () => {
    const { getByLabelText, getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    fireEvent.press(getByLabelText('축소'));
    expect(getByText('80%')).toBeTruthy();
  });

  it('resets scale when reset button is pressed', () => {
    const { getByLabelText, getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} initialScale={2.0} />,
    );
    expect(getByText('200%')).toBeTruthy();
    fireEvent.press(getByLabelText('초기화'));
    expect(getByText('100%')).toBeTruthy();
  });

  it('renders station labels when showLabels is true (default)', () => {
    const { getByText } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('역삼')).toBeTruthy();
    expect(getByText('교대')).toBeTruthy();
  });
});
