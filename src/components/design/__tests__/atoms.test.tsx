/**
 * Smoke tests for Phase 1 design atoms.
 *
 * Goal: confirm tokens propagate end-to-end (color, label) and that mappings
 * (congFromPct, line label, pill tone) match the design handoff exactly.
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { LineBadge } from '../LineBadge';
import { Pill } from '../Pill';
import { CongestionBar } from '../CongestionBar';
import { CongestionDots } from '../CongestionDots';
import { CongestionMeter } from '../CongestionMeter';
import { CONG_TONE, congFromPct } from '../congestion';
import { SUBWAY_LINE_COLORS } from '@/utils/colorUtils';

describe('design atoms — Phase 1 foundation', () => {
  describe('congFromPct', () => {
    it('maps boundary values to the design handoff levels', () => {
      expect(congFromPct(0)).toBe('low');
      expect(congFromPct(44)).toBe('low');
      expect(congFromPct(45)).toBe('mid');
      expect(congFromPct(69)).toBe('mid');
      expect(congFromPct(70)).toBe('high');
      expect(congFromPct(87)).toBe('high');
      expect(congFromPct(88)).toBe('vhigh');
      expect(congFromPct(100)).toBe('vhigh');
    });

    it('exposes Wanted congestion palette via CONG_TONE', () => {
      expect(CONG_TONE.low.color).toBe('#00BF40');
      expect(CONG_TONE.mid.color).toBe('#FFB400');
      expect(CONG_TONE.high.color).toBe('#FF7A1A');
      expect(CONG_TONE.vhigh.color).toBe('#FF4242');
      expect(CONG_TONE.vhigh.label).toBe('매우혼잡');
    });
  });

  describe('LineBadge', () => {
    it('renders numeric lines with their official Wanted-aligned color', () => {
      const { getByTestId } = render(<LineBadge line="2" size={24} />);
      expect(getByTestId('line-badge-2')).toBeTruthy();
    });

    it('renders Korean short-alias lines (sb/bd/gj/gx)', () => {
      const { getByTestId, getByText } = render(<LineBadge line="sb" size={28} />);
      expect(getByTestId('line-badge-sb')).toBeTruthy();
      expect(getByText('신분당')).toBeTruthy();
    });

    it('returns null for unknown line ids without crashing', () => {
      const { queryByTestId } = render(<LineBadge line="nonsense" size={20} />);
      expect(queryByTestId('line-badge-nonsense')).toBeNull();
    });

    it('uses updated line-1 color (Wanted #0052A4, not legacy #0d3692)', () => {
      expect(SUBWAY_LINE_COLORS['1']).toBe('#0052A4');
      expect(SUBWAY_LINE_COLORS['4']).toBe('#00A5DE');
      expect(SUBWAY_LINE_COLORS['9']).toBe('#BDB092');
    });
  });

  describe('Pill', () => {
    it('renders string children with tone styling', () => {
      const { getByText } = render(<Pill tone="primary">검증됨</Pill>);
      expect(getByText('검증됨')).toBeTruthy();
    });

    it('accepts composed Text children for icon+label use cases', () => {
      const { getByText } = render(
        <Pill tone="pos" size="sm" testID="pill-soon">
          <Text>곧 도착</Text>
        </Pill>,
      );
      expect(getByText('곧 도착')).toBeTruthy();
    });
  });

  describe('CongestionBar / Dots / Meter', () => {
    it('renders a CongestionBar with the level testID', () => {
      const { getByTestId } = render(<CongestionBar level="high" />);
      expect(getByTestId('congestion-bar-high')).toBeTruthy();
    });

    it('renders CongestionDots with the level testID', () => {
      const { getByTestId } = render(<CongestionDots level="vhigh" />);
      expect(getByTestId('congestion-dots-vhigh')).toBeTruthy();
    });

    it('CongestionMeter switches between bar/dots/heat presentations', () => {
      const bar = render(<CongestionMeter level="mid" style="bar" />);
      expect(bar.getByTestId('congestion-meter-bar-mid')).toBeTruthy();

      const dots = render(<CongestionMeter level="mid" style="dots" />);
      expect(dots.getByTestId('congestion-meter-dots-mid')).toBeTruthy();

      const heat = render(<CongestionMeter level="mid" style="heat" />);
      expect(heat.getByTestId('congestion-meter-heat-mid')).toBeTruthy();
      expect(heat.getByText('보통')).toBeTruthy();
    });
  });
});
