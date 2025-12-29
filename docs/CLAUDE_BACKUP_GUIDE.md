# Claude Code Configuration Backup Guide

이 가이드는 LiveMetro 프로젝트의 Claude Code 설정을 백업하고 복원하는 자동화 시스템에 대해 설명합니다.

## 📋 목차

- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [백업 시스템 구성](#백업-시스템-구성)
- [사용 방법](#사용-방법)
- [자동화](#자동화)
- [문제 해결](#문제-해결)

---

## 개요

Claude Code 설정 백업 시스템은 다음을 자동으로 관리합니다:

- **Skills**: 프로젝트별 맞춤 스킬 정의
- **Agents**: 전문화된 에이전트 설정
- **Commands**: 커스텀 명령어
- **Hooks**: Git 훅 및 이벤트 핸들러
- **Configuration**: MCP 서버 및 기타 설정 파일

### 백업 대상 파일

```
.claude/
├── agents/                    # 전문 에이전트 정의
│   ├── mobile-ui-specialist.md
│   ├── backend-integration-specialist.md
│   └── performance-optimizer.md
├── commands/                  # 커스텀 명령어
│   ├── check-health.md
│   └── test-coverage.md
├── skills/                    # 프로젝트 스킬
│   ├── react-native-development/
│   ├── firebase-integration/
│   ├── api-integration/
│   └── ...
├── hooks/                     # 이벤트 훅
├── mcp.json                   # MCP 서버 설정
├── settings.local.json        # 로컬 설정
└── README.md                  # Claude 프로젝트 문서
```

---

## 빠른 시작

### 1. 백업 생성

```bash
# 현재 Claude 설정 백업
npm run backup:claude
```

**출력 예시:**
```
🔄 Claude Code Configuration Backup

──────────────────────────────────────────────────
📊 Source size: 245.67 KB
📦 Creating backup: backup-2025-12-29_14-30-00
✅ Backup completed in 125ms
📂 Backup location: /path/to/.claude-backups/backup-2025-12-29_14-30-00

──────────────────────────────────────────────────
✨ Total backups: 5
📁 Backup directory: /path/to/.claude-backups
──────────────────────────────────────────────────
```

### 2. 백업 목록 확인

```bash
# 사용 가능한 모든 백업 나열
npm run restore:claude:list
```

### 3. 복원하기

```bash
# 인터랙티브 모드 (백업 선택)
npm run restore:claude

# 최신 백업에서 복원
npm run restore:claude:latest

# 특정 백업에서 복원
npm run restore:claude -- --backup=backup-2025-12-29_14-30-00
```

---

## 백업 시스템 구성

### 디렉토리 구조

```
liveMetro/
├── .claude/                          # Claude Code 설정 (백업 대상)
├── .claude-backups/                  # 백업 저장소 (로컬)
│   ├── backup-2025-12-29_14-30-00/
│   │   ├── agents/
│   │   ├── skills/
│   │   ├── commands/
│   │   └── backup-metadata.json     # 백업 메타데이터
│   └── backup-2025-12-28_10-15-00/
├── scripts/
│   ├── backupClaudeConfig.ts        # 백업 스크립트
│   └── restoreClaudeConfig.ts       # 복원 스크립트
├── .github/workflows/
│   └── claude-config-backup.yml     # GitHub Actions 워크플로우
└── .husky/
    └── pre-commit                    # Git pre-commit 훅
```

### 백업 메타데이터

각 백업에는 `backup-metadata.json` 파일이 포함됩니다:

```json
{
  "timestamp": "2025-12-29T14:30:00.000Z",
  "sourceDir": ".claude",
  "backupSize": "245.67 KB",
  "backupSizeBytes": 251565,
  "files": [
    "agents/mobile-ui-specialist.md",
    "skills/react-native-development/SKILL.md",
    "mcp.json",
    ...
  ]
}
```

---

## 사용 방법

### 백업 생성

#### 기본 백업

```bash
npm run backup:claude
```

#### 커스텀 출력 디렉토리

```bash
npm run backup:claude -- --output=/custom/backup/path
```

#### 최대 백업 개수 지정

```bash
npm run backup:claude -- --max-backups=20
```

### 백업 복원

#### 인터랙티브 모드

```bash
npm run restore:claude
```

사용 가능한 백업 목록이 표시되고, 번호를 입력하여 선택할 수 있습니다:

```
📦 Available Backups:

────────────────────────────────────────────────────────────────────────────────
1. backup-2025-12-29_14-30-00
   📅 Date: 2025-12-29 14:30:00
   📊 Size: 245.67 KB
   📄 Files: 47
   ⭐ LATEST

2. backup-2025-12-28_10-15-00
   📅 Date: 2025-12-28 10:15:00
   📊 Size: 243.21 KB
   📄 Files: 45

────────────────────────────────────────────────────────────────────────────────

Enter backup number to restore (or "q" to quit):
```

#### 최신 백업 복원

```bash
npm run restore:claude:latest
```

#### 확인 없이 복원 (자동화용)

```bash
npm run restore:claude:latest -- --yes
```

#### 백업 목록만 보기

```bash
npm run restore:claude:list
```

### 안전 기능

**자동 안전 백업**: 복원 전에 현재 설정을 자동으로 백업합니다:

```
⚠️  Warning: Target directory exists and will be replaced!

Do you want to continue? (y/N): y

📦 Creating safety backup of current config...
✅ Safety backup created: pre-restore-2025-12-29T14-35-00-000Z
```

이 안전 백업은 `.claude-backups/` 디렉토리에 `pre-restore-` 접두사와 함께 저장됩니다.

---

## 자동화

### 1. Git Pre-Commit Hook

`.claude/` 디렉토리에 변경사항이 있을 때 자동으로 백업을 생성합니다.

**설치 (Husky 사용):**

```bash
# Husky 설치 (프로젝트에 이미 설치되어 있음)
npm install --save-dev husky

# Husky 초기화
npx husky install

# Pre-commit hook 활성화 (이미 설정됨)
chmod +x .husky/pre-commit
```

**동작 방식:**

1. `git commit` 실행
2. `.claude/` 디렉토리 변경사항 감지
3. 자동으로 백업 생성
4. 백업이 커밋에 포함됨 (선택 사항)

### 2. GitHub Actions

매일 자동으로 백업을 생성하고 GitHub Artifacts로 저장합니다.

**트리거:**
- **스케줄**: 매일 오전 2시 (UTC)
- **수동**: GitHub Actions 탭에서 수동 실행
- **Push**: `.claude/` 디렉토리 변경 시 main 브랜치에 푸시

**워크플로우 파일**: `.github/workflows/claude-config-backup.yml`

**Artifacts 보관 기간**: 30일

**수동 실행:**

1. GitHub 저장소로 이동
2. **Actions** 탭 클릭
3. **Claude Config Backup** 워크플로우 선택
4. **Run workflow** 버튼 클릭

**Artifacts 다운로드:**

1. Actions 탭에서 완료된 워크플로우 실행 클릭
2. Artifacts 섹션에서 `claude-config-backup-{run_number}` 다운로드

### 3. 백업 보관 정책

**로컬 백업:**
- 기본값: 최근 10개 백업 유지
- 오래된 백업은 자동 삭제
- `--max-backups` 옵션으로 조정 가능

**GitHub Artifacts:**
- 30일 보관
- GitHub 저장소 설정에서 조정 가능

---

## 문제 해결

### 일반적인 문제

#### 1. `ts-node` 명령을 찾을 수 없음

**증상:**
```
sh: ts-node: command not found
```

**해결:**
```bash
npm install
```

#### 2. 백업 디렉토리가 너무 큼

**증상:**
```
⚠️  Backup directory size: 2.5 GB
```

**해결:**
```bash
# 오래된 백업 수동 삭제
rm -rf .claude-backups/backup-2025-11-*

# 또는 최대 백업 개수 줄이기
npm run backup:claude -- --max-backups=5
```

#### 3. 복원 시 권한 오류

**증상:**
```
❌ Error: EACCES: permission denied
```

**해결:**
```bash
# .claude 디렉토리 권한 확인
ls -la .claude

# 필요시 권한 수정
chmod -R u+w .claude
```

#### 4. Git hook이 실행되지 않음

**증상:**
백업이 자동으로 생성되지 않음

**해결:**
```bash
# Hook 파일 실행 권한 확인
chmod +x .husky/pre-commit

# Husky 재설치
npx husky install
```

### 백업 무결성 검증

```bash
# 백업 메타데이터 확인
cat .claude-backups/backup-2025-12-29_14-30-00/backup-metadata.json

# 백업 파일 개수 확인
find .claude-backups/backup-2025-12-29_14-30-00 -type f | wc -l
```

### 백업 내용 비교

```bash
# 두 백업 간 차이 확인
diff -r .claude-backups/backup-1/ .claude-backups/backup-2/

# 현재 설정과 백업 비교
diff -r .claude/ .claude-backups/backup-2025-12-29_14-30-00/
```

---

## 고급 사용법

### 백업 스크립트 직접 실행

```bash
# TypeScript 직접 실행
ts-node scripts/backupClaudeConfig.ts --output=/tmp/backup --max-backups=5

# 복원 스크립트
ts-node scripts/restoreClaudeConfig.ts --backup=backup-2025-12-29_14-30-00 --yes
```

### 원격 백업

GitHub Actions를 사용하여 자동으로 원격 백업이 생성됩니다. 수동으로 원격 백업을 설정하려면:

```bash
# 백업 생성
npm run backup:claude

# Git에 추가 (.gitignore에서 .claude-backups/ 주석 처리 필요)
git add .claude-backups/
git commit -m "chore: manual Claude config backup"
git push
```

### CI/CD 통합

```yaml
# .github/workflows/your-workflow.yml
- name: Backup Claude Config
  run: npm run backup:claude

- name: Upload backup
  uses: actions/upload-artifact@v4
  with:
    name: claude-backup
    path: .claude-backups/
```

---

## 모범 사례

1. **정기적인 백업**: 중요한 변경 전에 항상 백업 생성
2. **백업 검증**: 복원 전에 백업 메타데이터 확인
3. **버전 관리**: 중요한 마일스톤마다 백업에 태그 지정
4. **오프사이트 백업**: GitHub Artifacts를 활용한 원격 백업
5. **복원 테스트**: 정기적으로 복원 프로세스 테스트

---

## Clone to Other Projects

백업된 설정을 다른 프로젝트에 복제할 수 있습니다.

### Quick Clone

```bash
# 호환성 체크 (Dry run)
npm run clone:claude:check -- --target=/path/to/other/project

# 실제 복제
npm run clone:claude -- --target=/path/to/other/project

# 특정 백업에서 복제
npm run clone:claude -- --target=/path/to/other/project --backup=backup-2025-12-29_14-30-00
```

### 자세한 내용

Clone 기능에 대한 자세한 내용은 다음 문서를 참고하세요:
- **상세 가이드**: [docs/CLAUDE_CLONE_GUIDE.md](./CLAUDE_CLONE_GUIDE.md)
- **체크리스트**: [docs/CLAUDE_CLONE_CHECKLIST.md](./CLAUDE_CLONE_CHECKLIST.md)

---

## 참고 자료

- [Claude Code 공식 문서](https://claude.ai/code)
- [Clone 가이드](./CLAUDE_CLONE_GUIDE.md)
- [Clone 체크리스트](./CLAUDE_CLONE_CHECKLIST.md)
- [Husky 문서](https://typicode.github.io/husky/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)

---

## 라이선스

이 백업 시스템은 LiveMetro 프로젝트의 일부이며 MIT 라이선스를 따릅니다.
