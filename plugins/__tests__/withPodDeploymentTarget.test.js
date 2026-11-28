/**
 * withPodDeploymentTarget — Xcode 27 pod 배포 대상 보정 플러그인 회귀 테스트 (#445).
 *
 * prebuild 산출물(ios/Podfile)은 git 미추적이라 CI에서 검사되지 않는다. 그래서 삽입
 * 위치·멱등성·post_install 부재 시 무변경을 여기서 직접 단언한다. 실제 config-plugins
 * mod 체인을 태운다(모킹 없음). plugins/ 에는 path alias가 없어 상대 require를 쓴다.
 */
const { spawnSync } = require('child_process');

const withPodDeploymentTarget = require('../withPodDeploymentTarget');

const { MARKER_BEGIN, SNIPPET, addPodDeploymentTargetClamp } = withPodDeploymentTarget;

// 현재 expo prebuild 가 생성하는 Podfile 의 post_install 형태
const SAMPLE_PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'LiveMetro' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

const count = (haystack, needle) => haystack.split(needle).length - 1;

const runPlugin = async (contents, applyCount = 1) => {
  let config = { name: 'LiveMetro', slug: 'livemetro-subway-app' };
  for (let i = 0; i < applyCount; i += 1) {
    config = withPodDeploymentTarget(config);
  }
  const result = await config.mods.ios.podfile({
    ...config,
    modRequest: { platform: 'ios', platformProjectRoot: '/nonexistent' },
    modResults: { path: '/nonexistent/Podfile', language: 'rb', contents },
  });
  return result.modResults.contents;
};

describe('withPodDeploymentTarget', () => {
  it('inserts the clamp snippet once, after react_native_post_install(...)', async () => {
    const out = await runPlugin(SAMPLE_PODFILE);

    expect(count(out, MARKER_BEGIN)).toBe(1);
    expect(out).toContain("c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = pod_min_ios");
    expect(out).toContain("    pod_min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'\n");
    const rnCallEnd = out.indexOf(':ccache_enabled => ccache_enabled?(podfile_properties),\n    )');
    expect(rnCallEnd).toBeGreaterThan(-1);
    expect(out.indexOf(MARKER_BEGIN)).toBeGreaterThan(rnCallEnd);
    // post_install 블록의 end 보다 앞에 있어야 한다
    expect(out.indexOf(MARKER_BEGIN)).toBeLessThan(out.lastIndexOf('  end\nend'));
  });

  it('stays idempotent when applied twice', async () => {
    const once = await runPlugin(SAMPLE_PODFILE);
    const twice = await runPlugin(SAMPLE_PODFILE, 2);
    const reapplied = addPodDeploymentTargetClamp(once);

    expect(count(twice, MARKER_BEGIN)).toBe(1);
    expect(twice).toBe(once);
    expect(reapplied).toBe(once);
  });

  it('leaves the Podfile unchanged and warns (no throw) when post_install is missing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const podfile = "target 'LiveMetro' do\n  use_expo_modules!\nend\n";

    const out = await runPlugin(podfile);

    expect(out).toBe(podfile);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

// 삽입 스니펫을 실제 ruby 로 실행한다. 가짜 installer(Struct)를 만들고 결과 build_settings 를
// JSON 으로 stdout 에 내보낸다. 입력은 stdin 으로 넘긴다(임시 파일 없음).
const RUBY_HARNESS = [
  "require 'json'",
  'Conf = Struct.new(:build_settings)',
  'Target = Struct.new(:build_configurations)',
  'Project = Struct.new(:targets)',
  'Installer = Struct.new(:pods_project)',
  'input = JSON.parse(STDIN.read)',
  'podfile_properties = input["props"]',
  'installer = Installer.new(Project.new(input["targets"].map { |v| Target.new([Conf.new({ "IPHONEOS_DEPLOYMENT_TARGET" => v })]) }))',
  SNIPPET,
  'puts JSON.generate(installer.pods_project.targets.map { |t| t.build_configurations[0].build_settings["IPHONEOS_DEPLOYMENT_TARGET"] })',
].join('\n');

const runSnippetInRuby = (props, targets) => {
  const res = spawnSync('ruby', ['-e', RUBY_HARNESS], {
    input: JSON.stringify({ props, targets }),
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`ruby exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout);
};

const rubyProbe = spawnSync('ruby', ['-v'], { encoding: 'utf8' });
const hasRuby = !rubyProbe.error && rubyProbe.status === 0;

if (!hasRuby && process.env.CI) {
  describe('withPodDeploymentTarget snippet (ruby)', () => {
    it('requires ruby on PATH in CI', () => {
      throw new Error('ruby not found on PATH — CI must run the pod deployment clamp snippet, not skip it');
    });
  });
} else if (!hasRuby) {
  console.warn('[withPodDeploymentTarget.test] ruby not found on PATH — skipping ruby snippet execution tests');
  describe.skip('withPodDeploymentTarget snippet (ruby) — skipped: ruby not on PATH', () => {
    it('placeholder', () => {});
  });
} else {
  describe('withPodDeploymentTarget snippet (ruby)', () => {
    it('raises pods below the default 15.1 floor and keeps higher ones', () => {
      expect(runSnippetInRuby({}, [null, '12.0', '16.0', '15.10'])).toEqual(['15.1', '15.1', '16.0', '15.10']);
    });

    it('uses ios.deploymentTarget from Podfile.properties as the floor', () => {
      expect(runSnippetInRuby({ 'ios.deploymentTarget': '16.0' }, [null, '12.0', '16.0'])).toEqual([
        '16.0',
        '16.0',
        '16.0',
      ]);
    });

    it('compares versions numerically, not as floats or strings (15.10 > 15.2)', () => {
      expect(runSnippetInRuby({ 'ios.deploymentTarget': '15.2' }, ['15.10', '15.1', '9.0'])).toEqual([
        '15.10',
        '15.2',
        '15.2',
      ]);
    });
  });
}
