# Claude Code Configuration Clone Checklist

다른 프로젝트에 설정을 복제할 때 확인해야 할 빠른 체크리스트

## 📝 Clone 전 확인사항

### 대상 프로젝트 기본 요구사항
- [ ] 대상 프로젝트 디렉토리 경로 확인
- [ ] 쓰기 권한 확인
- [ ] Git 저장소인 경우 uncommitted 변경사항 커밋

### 기술 스택 호환성
- [ ] Node.js 프로젝트 (package.json 존재)
- [ ] TypeScript 사용 여부
- [ ] React Native/Expo 여부
- [ ] Firebase 사용 여부
- [ ] Jest 테스트 환경 여부

### Clone 옵션 결정
- [ ] 현재 설정 vs 특정 백업 선택
- [ ] `settings.local.json` 포함 여부
- [ ] Dry run으로 먼저 체크

---

## 🚀 Clone 실행

### 1. Dry Run (호환성 체크)
```bash
npm run clone:claude:check -- --target=/path/to/project
```

**확인사항**:
- [ ] 에러 없음
- [ ] 경고 내용 검토 완료
- [ ] 정보성 메시지 확인

### 2. 실제 Clone
```bash
npm run clone:claude -- --target=/path/to/project
```

**확인사항**:
- [ ] 복제 성공 메시지 확인
- [ ] CUSTOMIZATION_NEEDED.md 생성 확인

---

## ✏️ 커스터마이징 (필수)

### 1. 프로젝트 참조 변경
```bash
cd /path/to/project/.claude
grep -r "LiveMetro" .
```

**파일별 수정**:
- [ ] `README.md` - 프로젝트 이름 변경
- [ ] `agents/*.md` - 각 agent 설명 업데이트
- [ ] `skills/*/SKILL.md` - skill 설명 업데이트

### 2. Skills 정리

**제거해야 할 Skills** (해당하는 경우 체크):
- [ ] `subway-data-processor` (지하철 데이터 처리 불필요)
- [ ] `location-services` (GPS 기능 불필요)
- [ ] `notification-system` (다른 푸시 서비스 사용)

**수정해야 할 Skills**:
- [ ] `react-native-development` - 프로젝트 컨텍스트 변경
- [ ] `firebase-integration` - Firebase 미사용 시 제거
- [ ] `api-integration` - API 엔드포인트 업데이트
- [ ] `test-automation` - 테스트 패턴 업데이트

### 3. Agents 커스터마이징

각 Agent 파일 수정:
- [ ] `mobile-ui-specialist.md` - 프로젝트명, 도메인 지식
- [ ] `backend-integration-specialist.md` - 백엔드 시스템 정보
- [ ] `performance-optimizer.md` - 성능 목표 업데이트

### 4. MCP 설정

**`.claude/mcp.json` 확인**:
- [ ] 절대 경로 제거/수정
- [ ] 불필요한 서버 비활성화
- [ ] 프로젝트별 설정 반영

**환경 변수 설정**:
```bash
cd /path/to/project
cat >> .env << EOF
TWENTYFIRST_API_KEY=your_key
TAVILY_API_KEY=your_key
EOF
```

- [ ] `.env` 파일 생성
- [ ] 필요한 API 키 추가
- [ ] 프로젝트별 환경 변수 설정

### 5. Commands 검증

**`.claude/commands/` 파일들**:
- [ ] `check-health.md` - npm 스크립트 확인
- [ ] `test-coverage.md` - coverage 설정 확인
- [ ] 커스텀 commands - 프로젝트 경로 업데이트

### 6. skill-rules.json

**이 파일은 프로젝트 루트에 있습니다!**

```bash
# LiveMetro에서 복사
cp /path/to/livemetro/skill-rules.json /path/to/project/
```

- [ ] `skill-rules.json` 복사
- [ ] 파일 패턴 업데이트
- [ ] 제거한 skill 규칙 삭제
- [ ] 우선순위 조정

---

## ✅ 검증

### 파일 검증
```bash
cd /path/to/project

# LiveMetro 참조 남아있는지
grep -r "LiveMetro" .claude/

# 하드코딩 경로 확인
grep -r "/Users/younghwankang" .claude/
```

- [ ] LiveMetro 참조 모두 제거
- [ ] 하드코딩 경로 모두 제거
- [ ] 프로젝트별 설정으로 대체 완료

### Claude Code 테스트

**대상 프로젝트에서 실행**:
```bash
cd /path/to/project
code .
```

**기능 테스트**:
- [ ] Skills 로드 확인: "list available skills"
- [ ] Agent 작동: "@mobile-ui-specialist hello"
- [ ] Command 실행: "/check-health"
- [ ] MCP 서버 연결: "show MCP servers"

### 실제 작업 테스트

간단한 작업으로 검증:
- [ ] Skill 사용: "Using react-native-development skill, create a Button"
- [ ] Agent 호출: "@mobile-ui-specialist review current screen"
- [ ] Command 실행: "/check-health" 성공

---

## 🧹 정리

### 최종 확인
- [ ] `CUSTOMIZATION_NEEDED.md` 모든 항목 완료
- [ ] 불필요한 파일 제거
- [ ] Git 커밋 준비

### 정리 작업
```bash
cd /path/to/project/.claude

# 커스터마이징 완료 후 가이드 제거
rm CUSTOMIZATION_NEEDED.md

# Git 커밋
git add .claude/
git add skill-rules.json
git commit -m "chore: add Claude Code configuration from LiveMetro"
```

- [ ] 가이드 파일 제거
- [ ] Git 커밋
- [ ] 팀원에게 공유

---

## 🎯 성공 기준

모든 항목이 완료되면:

✅ **기술적 성공**
- 모든 Skills 로드됨
- 모든 Agents 응답함
- 모든 Commands 실행됨
- MCP 서버 연결됨

✅ **내용적 성공**
- 프로젝트 특화된 설명
- 올바른 기술 스택 참조
- 적절한 예시 코드
- 정확한 파일 경로

✅ **팀 차원 성공**
- 팀원들이 사용 가능
- 일관된 개발 경험
- 생산성 향상 확인

---

## 🚨 주의사항

### 하지 말아야 할 것

❌ **Clone만 하고 커스터마이징 안 함**
- 결과: LiveMetro 참조로 혼란, 동작 안 함

❌ **모든 Skills를 그대로 사용**
- 결과: 불필요한 Skills로 성능 저하

❌ **MCP API 키 복사**
- 결과: 보안 위험, 키 공유 금지

❌ **settings.local.json 커밋**
- 결과: 개인 설정이 팀 전체에 적용

### 해야 할 것

✅ **단계별 검증**
✅ **팀원과 공유 전 테스트**
✅ **문서화**
✅ **지속적 업데이트**

---

## 📊 체크리스트 진행률

완료된 항목: ____ / 전체 항목

- Clone 전: ____ / 10
- Clone 실행: ____ / 5
- 커스터마이징: ____ / 20
- 검증: ____ / 10
- 정리: ____ / 5

**총 진행률**: _____%

---

## 📞 도움이 필요한 경우

- [상세 Clone 가이드](./CLAUDE_CLONE_GUIDE.md)
- [백업 시스템 가이드](./CLAUDE_BACKUP_GUIDE.md)
- [Claude Code 공식 문서](https://claude.ai/code)

---

**체크리스트 버전**: 1.0
**Last Updated**: 2025-12-29
