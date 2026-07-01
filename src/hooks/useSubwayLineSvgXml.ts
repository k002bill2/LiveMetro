import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system';

/**
 * Loads a bundled SVG asset as raw XML text for native rendering via <SvgXml>.
 *
 * Why not <SvgUri>: react-native-svg's SvgUri fetches the uri with `fetch()`,
 * which cannot read the local `file://` / bundled-asset uri that
 * `Asset.fromModule().uri` returns in a standalone build (only Metro's dev
 * http uri works). That is why the map renders in dev but is blank in a
 * preview/production build. Reading the asset's file content with
 * expo-file-system sidesteps `fetch` entirely, so the base map renders in
 * standalone builds too.
 *
 * On web the caller keeps using <Image> (browser fetch of the http asset uri
 * works), so this hook returns null there.
 *
 * @param assetModule result of `require('...*.svg')` (a Metro asset module id)
 * @returns the svg xml string once loaded, or null (web / loading / read error)
 */
export const useSubwayLineSvgXml = (assetModule: number): string | null => {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let cancelled = false;

    const loadSvgXml = async (): Promise<void> => {
      try {
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        const localUri = asset.localUri ?? asset.uri;
        const content = await readAsStringAsync(localUri);
        if (!cancelled) {
          setXml(content);
        }
      } catch (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('Failed to load subway line SVG asset:', error);
        }
        if (!cancelled) {
          setXml(null);
        }
      }
    };

    void loadSvgXml();

    return () => {
      cancelled = true;
    };
  }, [assetModule]);

  return xml;
};
