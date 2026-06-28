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
    SvgUri: mockComponent('SvgUri'),
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
] as const as readonly any[];

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

  it('renders the provided SVG route map as the base layer', () => {
    const { getByTestId } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} />,
    );
    expect(getByTestId('SvgUri').props.width).toBe(1525);
    expect(getByTestId('SvgUri').props.height).toBe(1000);
  });

  it('renders current-station overlay markers when a station is selected', () => {
    const { getAllByTestId } = render(
      <SubwayMapView stations={mockStations} lines={mockLines} selectedStation="st1" />,
    );
    const circles = getAllByTestId('Circle');
    expect(circles).toHaveLength(3);
    expect(circles[0]?.props).toMatchObject({
      cx: 100 / 4900 * 1525,
      cy: 200 / 4400 * 1000,
      r: 20,
      fill: '#FF5722',
    });
  });

  it('uses SVG station anchors when the selected station has a verified SVG point', () => {
    const stations = [
      ...mockStations,
      {
        id: 's_ec82b0ea',
        name: '산곡',
        x: 784,
        y: 1947,
        lineIds: ['7'],
        isTransfer: false,
      },
    ] as const as readonly any[];

    const { getAllByTestId } = render(
      <SubwayMapView stations={stations} lines={mockLines} selectedStation="s_ec82b0ea" />,
    );

    const circles = getAllByTestId('Circle');
    expect(circles[0]?.props).toMatchObject({
      cx: 100,
      cy: 605,
      fill: '#FF5722',
    });
  });

  it('uses the SVG map viewBox for the overlay layer', () => {
    const farStations = [
      ...mockStations,
      {
        id: 'seoul',
        name: '서울역',
        x: 2143,
        y: 1711,
        lineIds: ['1', '4'],
        isTransfer: true,
      },
    ] as const as readonly any[];

    const { getByTestId } = render(
      <SubwayMapView stations={farStations} lines={mockLines} selectedStation="seoul" />,
    );

    const parts = String(getByTestId('Svg').props.viewBox)
      .split(' ')
      .map(Number);
    expect(parts).toHaveLength(4);

    const minX = parts[0]!;
    const minY = parts[1]!;
    const width = parts[2]!;
    const height = parts[3]!;

    expect(minX).toBe(0);
    expect(minY).toBe(0);
    expect(width).toBe(1525);
    expect(height).toBe(1000);
  });
});
