import { renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { readAsStringAsync } from 'expo-file-system';
import { useSubwayLineSvgXml } from '@hooks/useSubwayLineSvgXml';

// Inline mock definitions (BANNED: external jest.fn referenced inside factory).
jest.mock('expo-asset', () => ({
  __esModule: true,
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: 'file:///cache/subway_line.svg',
      uri: 'file:///cache/subway_line.svg',
    })),
  },
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  readAsStringAsync: jest.fn().mockResolvedValue('<svg>SUBWAY_MAP</svg>'),
}));

describe('useSubwayLineSvgXml', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  it('reads the bundled svg asset as an xml string on native', async () => {
    (readAsStringAsync as jest.Mock).mockResolvedValueOnce('<svg>SUBWAY_MAP</svg>');

    const { result } = renderHook(() => useSubwayLineSvgXml(42));

    await waitFor(() => {
      expect(result.current).toBe('<svg>SUBWAY_MAP</svg>');
    });
    // Must NOT go through fetch(uri) — reads file content directly.
    expect(readAsStringAsync).toHaveBeenCalledWith('file:///cache/subway_line.svg');
  });

  it('returns null when the asset read fails (no throw)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (readAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('read failed'));

    const { result } = renderHook(() => useSubwayLineSvgXml(42));

    await waitFor(() => {
      expect(readAsStringAsync).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
    errorSpy.mockRestore();
  });

  it('skips filesystem read on web (Image path is used there)', () => {
    Platform.OS = 'web';

    const { result } = renderHook(() => useSubwayLineSvgXml(42));

    expect(result.current).toBeNull();
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });
});
