#!/bin/bash
# Output Secret Filter Hook for LiveMetro
# PostToolUse에서 Bash 출력의 시크릿을 마스킹합니다.
#
# @version 1.0.0
# @hook-config
# {"event": "PostToolUse", "matcher": "Bash", "command": "bash .claude/hooks/outputSecretFilter.sh"}
#
# 마스킹 대상:
# - API 키 (EXPO_PUBLIC_*, FIREBASE_*, GOOGLE_*)
# - Bearer 토큰
# - AWS 자격 증명
# - GitHub 토큰
# - Private 키
# - Base64 인코딩 시크릿
# - Firebase 프로젝트 설정값

# stdin에서 도구 결과 읽기
INPUT=$(cat)

# tool_output 필드 추출 (있으면)
OUTPUT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_output', data.get('stdout', '')))
except:
    print('')
" 2>/dev/null)

# 출력이 없으면 패스
if [ -z "$OUTPUT" ]; then
    exit 0
fi

# 시크릿 패턴 매칭 및 마스킹
MASKED="$OUTPUT"

# API 키 패턴 (key=value 또는 key: value)
MASKED=$(echo "$MASKED" | sed -E \
    -e 's/(EXPO_PUBLIC_[A-Z_]+=)[^ "'\'']+/\1[REDACTED]/g' \
    -e 's/(FIREBASE_[A-Z_]+=)[^ "'\'']+/\1[REDACTED]/g' \
    -e 's/(GOOGLE_[A-Z_]+=)[^ "'\'']+/\1[REDACTED]/g' \
    -e 's/(API_KEY=)[^ "'\'']+/\1[REDACTED]/g' \
    -e 's/(SECRET_KEY=)[^ "'\'']+/\1[REDACTED]/g' \
)

# Bearer 토큰
MASKED=$(echo "$MASKED" | sed -E 's/Bearer [A-Za-z0-9._\-]+/Bearer [REDACTED]/g')

# AWS Access Key (AKIA로 시작하는 20자)
MASKED=$(echo "$MASKED" | sed -E 's/AKIA[0-9A-Z]{16}/AKIA[REDACTED]/g')

# AWS Secret Key (40자 base64)
MASKED=$(echo "$MASKED" | sed -E 's/(aws_secret_access_key[=: ]+)[A-Za-z0-9\/+=]{40}/\1[REDACTED]/g')

# GitHub Personal Access Token
MASKED=$(echo "$MASKED" | sed -E 's/ghp_[A-Za-z0-9_]{36}/ghp_[REDACTED]/g')
MASKED=$(echo "$MASKED" | sed -E 's/github_pat_[A-Za-z0-9_]{82}/github_pat_[REDACTED]/g')

# Private Key 블록
MASKED=$(echo "$MASKED" | sed -E 's/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----.*-----END (RSA |EC |DSA )?PRIVATE KEY-----/[PRIVATE KEY REDACTED]/g')

# Firebase 설정값 (apiKey, authDomain 등)
MASKED=$(echo "$MASKED" | sed -E \
    -e 's/(apiKey['"'"'": ]+)[A-Za-z0-9_\-]{20,}/\1[REDACTED]/g' \
    -e 's/(authDomain['"'"'": ]+)[^"'"'"',]+/\1[REDACTED]/g' \
    -e 's/(messagingSenderId['"'"'": ]+)[0-9]{10,}/\1[REDACTED]/g' \
)

# npm 토큰
MASKED=$(echo "$MASKED" | sed -E 's/npm_[A-Za-z0-9]{36}/npm_[REDACTED]/g')

# 일반 토큰 패턴 (token=xxx, token: xxx)
MASKED=$(echo "$MASKED" | sed -E 's/(token[=: ]+["'"'"']?)[A-Za-z0-9._\-]{20,}/\1[REDACTED]/g')

# 마스킹 발생 여부 확인
if [ "$MASKED" != "$OUTPUT" ]; then
    echo "⚠️  [OutputSecretFilter] 시크릿이 마스킹되었습니다." >&2
fi

exit 0
