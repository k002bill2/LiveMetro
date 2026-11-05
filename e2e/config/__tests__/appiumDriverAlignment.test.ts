/**
 * appium 드라이버 버전 정합성 가드.
 *
 * 증명 대상 (#430 회귀 방지):
 *   1. `e2e:install` 이 고정한 드라이버 major(@8/@12)와 devDependencies 범위의 major 가 같다 —
 *      CI(e2e-tests.yml)는 `npm ci` 로 node_modules 의 드라이버를 쓰고, 로컬은 `e2e:install`
 *      경로로 설치할 수 있으므로 둘이 어긋나면 로컬과 CI 가 서로 다른 드라이버로 돈다.
 *   2. lock 에 설치된 각 드라이버의 peer `appium` major 가 설치된 appium major 와 같다 —
 *      `.npmrc` 의 legacy-peer-deps=true 가 npm ci 의 peer 충돌을 숨기므로(#430: 드라이버 peer
 *      ^4.0.0-beta, appium 3.9.0 인데 설치 성공) 이 테스트가 유일한 게이트다.
 *
 * 해제·갱신 절차는 .github/dependabot.yml 의 appium ignore 블록 주석 참조.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface LockPackage {
  version?: string;
  peerDependencies?: Record<string, string>;
}

interface PackageJson {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface PackageLock {
  packages: Record<string, LockPackage>;
}

const ROOT = resolve(__dirname, '../../..');

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;

/** semver 범위·버전 문자열의 첫 숫자(major). `^8.7.3`→8, `^4.0.0-beta.6`→4. 없으면 null. */
const majorOf = (spec: string | undefined): number | null => {
  const match = spec?.match(/\d+/);
  return match ? Number(match[0]) : null;
};

/** `appium driver install <name>@<N>` 의 N. 고정이 없으면 null. */
const installPinMajor = (script: string, driverName: string): number | null => {
  const match = script.match(new RegExp(`driver install ${driverName}@(\\d+)`));
  return match ? Number(match[1]) : null;
};

const DRIVERS = [
  { installName: 'uiautomator2', packageName: 'appium-uiautomator2-driver' },
  { installName: 'xcuitest', packageName: 'appium-xcuitest-driver' },
] as const;

describe('appium driver alignment', () => {
  const pkg = readJson<PackageJson>('package.json');
  const lock = readJson<PackageLock>('package-lock.json');
  const appiumMajor = majorOf(lock.packages['node_modules/appium']?.version);

  it('lock 에 appium 이 설치되어 있다', () => {
    expect(appiumMajor).not.toBeNull();
  });

  describe.each(DRIVERS)('$packageName', ({ installName, packageName }) => {
    it('e2e:install 고정 major 가 devDependency major 와 같다', () => {
      const pinned = installPinMajor(pkg.scripts['e2e:install'] ?? '', installName);
      const declared = majorOf(pkg.devDependencies[packageName]);

      expect(pinned).not.toBeNull();
      expect(pinned).toBe(declared);
    });

    it('설치된 드라이버의 peer appium major 가 설치된 appium major 와 같다', () => {
      const driver = lock.packages[`node_modules/${packageName}`];
      const peerMajor = majorOf(driver?.peerDependencies?.appium);

      expect(peerMajor).not.toBeNull();
      expect(peerMajor).toBe(appiumMajor);
    });
  });

  describe('majorOf / installPinMajor', () => {
    it('prerelease 범위에서도 major 를 뽑는다', () => {
      expect(majorOf('^4.0.0-beta.6')).toBe(4);
      expect(majorOf('^3.0.0-rc.2')).toBe(3);
    });

    it('빈 값이면 null 이다', () => {
      expect(majorOf(undefined)).toBeNull();
      expect(majorOf('')).toBeNull();
    });

    it('고정 없는 install 은 null 이다', () => {
      expect(installPinMajor('appium driver install uiautomator2', 'uiautomator2')).toBeNull();
    });
  });
});
