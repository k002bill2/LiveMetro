/**
 * metro.blocklist — Metro blockList 패턴 빌더 (#444).
 *
 * .claude/ 하네스 디렉터리(.claude/worktrees/* 는 전체 저장소 사본)를 Metro 크롤에서
 * 제외하되, 프로젝트 루트(projectRoot) 바로 아래의 .claude/ 만 막는다. 앵커 없는
 * 패턴은 Metro를 .claude/worktrees/<lane> 안에서 띄우면 그 worktree 자체 경로까지
 * 매칭해 index.bundle 이 404가 났다. 순수 함수로 분리해 jest에서 검증한다.
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} projectRoot Metro 프로젝트 루트(보통 __dirname)
 * @returns {RegExp} <projectRoot>/.claude/ 이하 경로에만 매칭하는 패턴
 */
const buildClaudeBlockPattern = (projectRoot) =>
  new RegExp(`^${escapeRegExp(projectRoot)}[\\/\\\\]\\.claude[\\/\\\\].*`);

module.exports = { buildClaudeBlockPattern };
