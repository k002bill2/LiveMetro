/**
 * metro.blocklist.js — .claude/ 차단 패턴 앵커 회귀 테스트 (#444).
 *
 * 앵커 없는 `/[\/\\]\.claude[\/\\].*\/` 는 Metro를 .claude/worktrees/<lane> 안에서
 * 띄우면 그 worktree 자체 경로까지 막아 index.bundle 이 404가 났다. 패턴은 프로젝트
 * 루트(__dirname) 바로 아래의 .claude/ 만 막아야 한다.
 * 루트 파일에는 path alias가 없으므로 상대 require를 쓴다(.js 모듈이라 타입을 명시).
 */
const { buildClaudeBlockPattern } = require('../metro.blocklist') as {
  buildClaudeBlockPattern: (projectRoot: string) => RegExp;
};

describe('buildClaudeBlockPattern', () => {
  it('blocks nested worktrees under the main checkout root', () => {
    const re = buildClaudeBlockPattern('/r/LiveMetro');

    expect(re.test('/r/LiveMetro/.claude/worktrees/x/src/a.ts')).toBe(true);
    expect(re.test('/r/LiveMetro/src/a.ts')).toBe(false);
  });

  it('does not block the project itself when the root is a worktree under .claude/', () => {
    const re = buildClaudeBlockPattern('/r/LiveMetro/.claude/worktrees/x');

    expect(re.test('/r/LiveMetro/.claude/worktrees/x/src/a.ts')).toBe(false);
    expect(re.test('/r/LiveMetro/.claude/worktrees/x/.claude/foo.ts')).toBe(true);
  });

  it('handles Windows path separators', () => {
    const re = buildClaudeBlockPattern('C:\\r\\LiveMetro');

    expect(re.test('C:\\r\\LiveMetro\\.claude\\worktrees\\x\\a.ts')).toBe(true);
    expect(re.test('C:\\r\\LiveMetro\\src\\a.ts')).toBe(false);
  });

  it('escapes regex metacharacters in the root path', () => {
    const re = buildClaudeBlockPattern('/r/Live.Metro (1)');

    expect(re.test('/r/Live.Metro (1)/.claude/foo.ts')).toBe(true);
    // '.' 가 임의 문자로 해석되면 아래가 차단된다.
    expect(re.test('/r/LiveXMetro (1)/.claude/foo.ts')).toBe(false);
    expect(re.test('/r/Live.Metro (1)/src/a.ts')).toBe(false);
  });
});
