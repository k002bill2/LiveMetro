# codex-advisor-worker-bundle — 이 레포에는 사본을 두지 않습니다

조언자–작업자(Advisor–Worker–Codex) 번들의 **정본은 CCUES 레포**입니다.

- 설치기: `Claude-Code-Universal-Environment-Setup/docs/codex-advisor-worker-bundle/install.sh`
  (통합 설치기 `install.sh --with-advisor` 가 이 파일에 위임)
- 개정 이력: `~/.claude/HISTORY.md` (라이브 전용 — 설치기가 배포하지 않음)

이전에 여기 있던 사본은 정본과 드리프트한 상태였습니다. 실행하면 라이브 `~/.claude` 설정이
옛 버전으로 롤백될 수 있어 2026-10-03 하네스 감사 후속(A-3)에서 제거했습니다.

옛 사본이 필요하면 git 이력에서 꺼냅니다:

```bash
git show 7cd831c:docs/codex-advisor-worker-bundle/install.sh
git ls-tree --name-only 7cd831c docs/codex-advisor-worker-bundle/
```
