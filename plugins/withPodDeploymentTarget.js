/**
 * withPodDeploymentTarget — Xcode 27 대응: pod 타깃 IPHONEOS_DEPLOYMENT_TARGET 하한 보정 (#445).
 *
 * Why this exists:
 * - Xcode 27 은 IPHONEOS_DEPLOYMENT_TARGET < 15.0 인 타깃을 거부한다. 일부 pod 는
 *   podspec 에 더 낮은 배포 대상을 선언해 Pods 프로젝트 빌드가 실패한다.
 * - expo-build-properties 의 ios.deploymentTarget 은 앱(APPLICATION) 타깃과
 *   Podfile.properties(→ `platform :ios`)만 바꾸고 개별 pod 타깃은 건드리지 않는다
 *   (node_modules/expo-build-properties/build/ios.js:76-97).
 * - ios/ 는 prebuild 생성물(git 미추적)이라 Podfile 을 직접 고치면 다음 prebuild 에서
 *   사라진다. 그래서 config plugin 으로 post_install 에 보정 스니펫을 삽입한다.
 *
 * 하한값은 Ruby 실행 시점에 Podfile.properties 의 ios.deploymentTarget(없으면 15.1)을
 * 읽는다. 하한보다 낮은 pod 타깃만 올리고 더 높은 값은 그대로 둔다. 비교는 Gem::Version
 * (to_f 는 '15.10' 을 15.1 로 읽어 15.2 하한에서 잘못 올린다). 값이 nil/빈 문자열이면
 * 하한 미만으로 보고 하한을 채운다.
 *
 * 멱등성: 마커 주석이 이미 있으면 아무것도 하지 않는다.
 * post_install 블록이 없으면 throw 하지 않고 경고만 남긴 채 원문을 그대로 반환한다.
 */
const { withPodfile } = require('@expo/config-plugins');

const MARKER_BEGIN = '# @generated begin withPodDeploymentTarget (#445)';
const MARKER_END = '# @generated end withPodDeploymentTarget';

const SNIPPET = [
  `    ${MARKER_BEGIN}`,
  "    pod_min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'",
  '    installer.pods_project.targets.each do |t|',
  '      t.build_configurations.each do |c|',
  "        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_s",
  "        if current.empty? || Gem::Version.new(current) < Gem::Version.new(pod_min_ios)",
  "          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = pod_min_ios",
  '        end',
  '      end',
  '    end',
  `    ${MARKER_END}`,
].join('\n');

/** `open` 위치의 '(' 와 짝이 맞는 ')' 의 인덱스. 없으면 -1. */
const findClosingParen = (contents, open) => {
  let depth = 0;
  for (let i = open; i < contents.length; i += 1) {
    if (contents[i] === '(') depth += 1;
    if (contents[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** `index` 가 속한 줄의 끝(개행 다음) 위치. */
const endOfLine = (contents, index) => {
  const newline = contents.indexOf('\n', index);
  return newline === -1 ? contents.length : newline + 1;
};

/**
 * Podfile 문자열의 post_install 블록에 보정 스니펫을 1회 삽입한 새 문자열을 반환한다.
 * @param {string} contents Podfile 원문
 * @returns {string}
 */
const addPodDeploymentTargetClamp = (contents) => {
  if (contents.includes(MARKER_BEGIN)) return contents;

  const postInstall = contents.search(/post_install do \|installer\|/);
  if (postInstall === -1) {
    console.warn('[withPodDeploymentTarget] Podfile 에 post_install 블록이 없어 pod 배포 대상 보정을 건너뜁니다.');
    return contents;
  }

  const rnCall = contents.indexOf('react_native_post_install(', postInstall);
  const closing = rnCall === -1 ? -1 : findClosingParen(contents, rnCall + 'react_native_post_install'.length);
  const insertAt = closing === -1 ? endOfLine(contents, postInstall) : endOfLine(contents, closing);
  const prefix = contents.slice(0, insertAt);
  const glue = prefix.endsWith('\n') ? '' : '\n';

  return `${prefix}${glue}${SNIPPET}\n${contents.slice(insertAt)}`;
};

const withPodDeploymentTarget = (config) =>
  withPodfile(config, (mod) => {
    mod.modResults.contents = addPodDeploymentTargetClamp(mod.modResults.contents);
    return mod;
  });

module.exports = withPodDeploymentTarget;
module.exports.MARKER_BEGIN = MARKER_BEGIN;
module.exports.addPodDeploymentTargetClamp = addPodDeploymentTargetClamp;
module.exports.SNIPPET = SNIPPET;
