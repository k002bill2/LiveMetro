import {
  resolveLineFavorites,
  computeFavoriteDiff,
  LineFavoriteOption,
} from './lineFavoriteResolver';

jest.mock('../../services/data/stationsDataService', () => ({
  findStationCdByNameAndLine: (name: string, lineId: string) => {
    const table: Record<string, string> = {
      '왕십리|2': '0208',
      '왕십리|5': '2541',
      '왕십리|경의선': '1013',
      '왕십리|수인분당선': '102C',
    };
    return table[`${name}|${lineId}`] ?? null;
  },
}));

describe('lineFavoriteResolver', () => {
  describe('resolveLineFavorites', () => {
    it('maps each line to its station_cd and favorited flag', () => {
      const options = resolveLineFavorites('왕십리', ['2', '5', '경의선'], (cd) => cd === '0208');
      const expected: LineFavoriteOption[] = [
        { lineId: '2', stationCd: '0208', isFavorite: true },
        { lineId: '5', stationCd: '2541', isFavorite: false },
        { lineId: '경의선', stationCd: '1013', isFavorite: false },
      ];
      expect(options).toEqual(expected);
    });

    it('drops lines whose station_cd cannot be resolved', () => {
      const options = resolveLineFavorites('왕십리', ['2', '없는노선'], () => false);
      expect(options.map((o) => o.lineId)).toEqual(['2']);
    });
  });

  describe('computeFavoriteDiff', () => {
    const options: LineFavoriteOption[] = [
      { lineId: '2', stationCd: '0208', isFavorite: true },
      { lineId: '5', stationCd: '2541', isFavorite: false },
      { lineId: '경의선', stationCd: '1013', isFavorite: false },
    ];

    it('returns adds for newly selected and removes for deselected', () => {
      // initial favorited: {2}. selected: {5, 경의선} -> add 5,경의선; remove 2
      const diff = computeFavoriteDiff(options, new Set(['5', '경의선']));
      expect(diff.toAdd).toEqual(['5', '경의선']);
      expect(diff.toRemove).toEqual(['0208']);
    });

    it('returns empty diff when selection equals initial state', () => {
      const diff = computeFavoriteDiff(options, new Set(['2']));
      expect(diff.toAdd).toEqual([]);
      expect(diff.toRemove).toEqual([]);
    });
  });
});
