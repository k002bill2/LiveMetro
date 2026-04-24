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

# Firebase Service Account JSON private_key 필드
MASKED=$(echo "$MASKED" | sed -E 's/("private_key"[[:space:]]*:[[:space:]]*")[^"]+(")/\1[REDACTED]\2/g')

# Firebase Service Account client_email / client_id
MASKED=$(echo "$MASKED" | sed -E \
    -e 's/("client_email"[[:space:]]*:[[:space:]]*")[^"]+(")/\1[REDACTED]\2/g' \
    -e 's/("private_key_id"[[:space:]]*:[[:space:]]*")[^"]+(")/\1[REDACTED]\2/g' \
)

# Expo push token (ExponentPushToken[xxxxx] 또는 ExpoPushToken[xxxxx])
MASKED=$(echo "$MASKED" | sed -E 's/(Expo(nent)?PushToken)\[[^]]+\]/\1[REDACTED]/g')

# OAuth client secret 패턴 (client_secret, clientSecret)
MASKED=$(echo "$MASKED" | sed -E 's/(client[_-]?secret[=: "'"'"']+)[A-Za-z0-9._\-]{16,}/\1[REDACTED]/g')

# Google API key (AIza로 시작하는 39자)
MASKED=$(echo "$MASKED" | sed -E 's/AIza[A-Za-z0-9_\-]{35}/AIza[REDACTED]/g')

# Slack 토큰 (xoxb-, xoxp-, xoxa-, xoxs-)
MASKED=$(echo "$MASKED" | sed -E 's/xox[baps]-[A-Za-z0-9\-]+/xox*-[REDACTED]/g')

# Stripe 키 (sk_live, sk_test, pk_live, rk_live)
MASKED=$(echo "$MASKED" | sed -E 's/(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}/\1_\2_[REDACTED]/g')

# JWT 토큰 (세 파트 base64.base64.base64)
MASKED=$(echo "$MASKED" | sed -E 's/eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/[JWT_REDACTED]/g')

# 마스킹 발생 여부 확인
if [ "$MASKED" != "$OUTPUT" ]; then
    echo "⚠️  [OutputSecretFilter] 시크릿이 마스킹되었습니다." >&2
fi

exit 0
