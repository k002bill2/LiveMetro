/**
 * stationIdResolver — external station_cd → internal slug.
 *
 * Joins seoulStations.json (station_cd, station_nm) with stations.json
 * (id, name). Internal slugs pass through unchanged so callers can hand
 * the hook either ID universe.
 */
import { resolveInternalStationId } from '../stationIdResolver';

describe('resolveInternalStationId', () => {
  describe('external Seoul Metro station_cd', () => {
    it('resolves 산곡 station_cd "3762" to internal slug "s_ec82b0ea"', () => {
      expect(resolveInternalStationId('3762')).toBe('s_ec82b0ea');
    });

    it('resolves 선릉 line 2 station_cd "0220" to slug "seolleung"', () => {
      expect(resolveInternalStationId('0220')).toBe('seolleung');
    });

    it('resolves 선릉 분당선 station_cd "1023" to the same slug "seolleung"', () => {
      // Multi-line station: both Seoul Metro codes for 선릉 collapse to one
      // stations.json entry whose lines array carries '2' + 'bundang'.
      expect(resolveInternalStationId('1023')).toBe('seolleung');
    });
  });

  describe('internal slug pass-through', () => {
    it('returns "seolleung" unchanged', () => {
      expect(resolveInternalStationId('seolleung')).toBe('seolleung');
    });

    it('returns "s_ec82b0ea" unchanged', () => {
      expect(resolveInternalStationId('s_ec82b0ea')).toBe('s_ec82b0ea');
    });

    it('returns "gangnam" unchanged', () => {
      expect(resolveInternalStationId('gangnam')).toBe('gangnam');
    });
  });

  describe('unknown ids', () => {
    it('returns null for empty string', () => {
      expect(resolveInternalStationId('')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(resolveInternalStationId(undefined)).toBeNull();
    });

    it('returns null for null', () => {
      expect(resolveInternalStationId(null)).toBeNull();
    });

    it('returns null for a station_cd not present in seoulStations.json', () => {
      expect(resolveInternalStationId('99999')).toBeNull();
    });

    it('returns null for a slug-shaped string that does not exist', () => {
      expect(resolveInternalStationId('s_does_not_exist')).toBeNull();
    });
  });
});
