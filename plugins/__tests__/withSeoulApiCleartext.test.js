/**
 * withSeoulApiCleartext — Android cleartext 예외 플러그인 회귀 테스트.
 *
 * 이 플러그인은 "전역 평문 허용으로 새지 않는가"를 담당하는 보안 임계 파일인데,
 * prebuild 산출물은 CI에서 검사되지 않는다. 그래서 리소스 경로·XML 내용·manifest
 * 속성·멱등성을 여기서 직접 단언한다.
 *
 * 실제 `@expo/config-plugins`의 mod 체인을 그대로 태우고(모킹 없음) 임시 디렉토리를
 * platformProjectRoot로 주입해 파일 산출물을 읽는다. `plugins/`에는 path alias가
 * 없으므로(jest moduleNameMapper는 `src/*`만 매핑) 상대 require를 쓴다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { XML } = require('@expo/config-plugins');

const withSeoulApiCleartext = require('../withSeoulApiCleartext');

const MAIN_XML_PATH = 'app/src/main/res/xml/network_security_config.xml';
const DEBUG_XML_PATH = 'app/src/debug/res/xml/network_security_config.xml';
const NSC_ATTRIBUTE = 'android:networkSecurityConfig';

const createBareManifest = () => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [{ $: { 'android:name': '.MainApplication' } }],
  },
});

/**
 * 플러그인을 `applyCount`번 적용한 뒤 등록된 mod들을 실행한다.
 * (expo prebuild가 하는 일과 같은 순서: manifest mod → dangerous mod)
 */
const runPlugin = async (platformProjectRoot, applyCount = 1) => {
  let config = { name: 'LiveMetro', slug: 'livemetro-subway-app' };

  for (let i = 0; i < applyCount; i += 1) {
    config = withSeoulApiCleartext(config);
  }

  const modRequest = { platformProjectRoot, platform: 'android' };

  const manifestResult = await config.mods.android.manifest({
    ...config,
    modRequest,
    modResults: createBareManifest(),
  });

  await config.mods.android.dangerous({ ...config, modRequest, modResults: {} });

  return {
    application: manifestResult.modResults.manifest.application[0],
    mainXml: fs.readFileSync(path.join(platformProjectRoot, MAIN_XML_PATH), 'utf8'),
    debugXml: fs.readFileSync(path.join(platformProjectRoot, DEBUG_XML_PATH), 'utf8'),
  };
};

describe('withSeoulApiCleartext', () => {
  const tempRoots = [];

  const createTempRoot = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'livemetro-nsc-'));
    tempRoots.push(root);
    return root;
  };

  afterAll(() => {
    tempRoots.forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
  });

  it('permits cleartext for the two Seoul API domains only', async () => {
    const { mainXml } = await runPlugin(createTempRoot());

    const parsed = await XML.parseXMLAsync(mainXml);
    const domainConfig = parsed['network-security-config']['domain-config'];

    expect(domainConfig).toHaveLength(1);
    expect(domainConfig[0].$.cleartextTrafficPermitted).toBe('true');
    expect(domainConfig[0].domain.map((entry) => entry._)).toEqual([
      'swopenapi.seoul.go.kr',
      'openapi.seoul.go.kr',
    ]);
    expect(domainConfig[0].domain.every((entry) => entry.$.includeSubdomains === 'true')).toBe(true);
  });

  it('states the deny default explicitly and never opts into global cleartext', async () => {
    const { mainXml } = await runPlugin(createTempRoot());

    const parsed = await XML.parseXMLAsync(mainXml);
    const baseConfig = parsed['network-security-config']['base-config'];

    expect(baseConfig).toHaveLength(1);
    expect(baseConfig[0].$.cleartextTrafficPermitted).toBe('false');
    expect(mainXml).not.toContain('usesCleartextTraffic');
    // Android가 문서화한 요소 순서(base-config → domain-config)를 고정한다.
    // 순서가 뒤집혀도 XML 자체는 well-formed라 파싱 단언만으로는 안 잡힌다.
    expect(mainXml.indexOf('<base-config')).toBeLessThan(mainXml.indexOf('<domain-config'));
  });

  it('keeps a permissive Metro overlay in the debug source set only', async () => {
    const { debugXml } = await runPlugin(createTempRoot());

    const parsed = await XML.parseXMLAsync(debugXml);
    const baseConfig = parsed['network-security-config']['base-config'];

    expect(baseConfig).toHaveLength(1);
    expect(baseConfig[0].$.cleartextTrafficPermitted).toBe('true');
    expect(parsed['network-security-config']['domain-config']).toBeUndefined();
  });

  it('points the main application at the generated resource exactly once', async () => {
    const { application } = await runPlugin(createTempRoot());

    expect(application.$[NSC_ATTRIBUTE]).toBe('@xml/network_security_config');
    expect(Object.keys(application.$).filter((key) => key === NSC_ATTRIBUTE)).toHaveLength(1);
    expect(application.$['android:usesCleartextTraffic']).toBeUndefined();
  });

  it('stays idempotent when applied twice', async () => {
    const single = await runPlugin(createTempRoot());
    const twice = await runPlugin(createTempRoot(), 2);

    expect(twice.application.$).toEqual(single.application.$);
    expect(twice.mainXml).toBe(single.mainXml);
    expect(twice.debugXml).toBe(single.debugXml);
    expect(twice.mainXml.match(/<domain /g)).toHaveLength(2);
  });
});
