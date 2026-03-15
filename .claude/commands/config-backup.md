---
name: config-backup
description: Claude Code 설정 백업/복원 시스템 - backup, restore, verify, diff, list 지원
argument-hint: [backup|restore|verify|diff|list]
allowed-tools: Read, Write, Bash(cp *), Bash(diff *)
---

# Claude Code Config Backup System

설정 백업/복원/검증/비교 시스템입니다.

**저장 위치**: `.claude/backups/` (프로젝트 내)

## 서브커맨드 분기

인자 `$ARGUMENTS`를 파싱하여 서브커맨드를 결정합니다:

| 인자 | 동작 |
|------|------|
| `backup [name]` | 백업 생성 |
| `restore <name>` | 백업 복원 |
| `verify <name>` | 백업 검증 |
| `diff [b1] [b2]` | 백업 비교 |
| `list` | 백업 목록 |
| (없음) | 도움말 표시 |

---

## 1. backup [custom-name]

### 환경 준비 및 백업명 생성

```bash
mkdir -p .claude/backups
```

포맷: `{YYYYMMDD}_{HHMMSS}_{project-name}[_custom-name]`

### Manifest 생성

`.claude/` 디렉토리를 스캔하여 메타데이터를 수집하고 `backup-manifest.json` 작성.

### 아카이브 및 체크섬 생성

```bash
tar -czf "${BACKUP_DIR}/claude-config.tar.gz" -C "$(pwd)" .claude/
cd .claude && find . -type f -exec shasum -a 256 {} \; > "${BACKUP_DIR}/checksums.sha256" && cd ..
```

---

## 2. list

백업 목록을 표시합니다. 각 백업의 `backup-manifest.json`을 읽어 테이블로 표시.

---

## 3. verify <backup-name>

백업 무결성을 검증합니다:
- 아카이브 무결성 확인 (`tar -tzf`)
- 체크섬 검증 (`shasum -a 256 -c`)
- Manifest 필수 필드 확인

---

## 4. restore <backup-name> [--dry-run] [--only <path>]

백업을 복원합니다:
1. 먼저 `verify` 워크플로우를 실행
2. 현재 설정 안전 백업 생성 (`.claude.bak.{timestamp}`)
3. `--dry-run`: 실제 복원 없이 변경 사항만 표시
4. `--only`: 특정 경로만 복원
5. `settings.local.json`은 항상 보존

---

## 5. diff <backup1> [backup2]

백업 간 또는 백업과 현재 설정을 비교합니다:
- 인자 1개: `backup1` vs 현재 `.claude/`
- 인자 2개: `backup1` vs `backup2`

---

## 도움말 (인자 없음)

```
Usage: /config-backup <command> [options]

Commands:
  backup [name]     Create a new backup
  restore <name>    Restore from a backup
  verify <name>     Verify backup integrity
  diff [b1] [b2]    Compare backups or backup vs current
  list              List all available backups

Options:
  --dry-run         Preview changes without applying
  --only <path>     Restore specific path only

Storage: .claude/backups/
```

## 에러 처리

| 에러 | 처리 |
|------|------|
| 백업 디렉토리 없음 | 자동 생성 |
| 백업명 중복 | 카운터 추가 (`_1`, `_2`) |
| 백업 없음 | 사용 가능한 백업 목록 표시 |
| 검증 실패 | 구체적 실패 항목 표시 |
| 권한 오류 | 경로 및 권한 안내 |
