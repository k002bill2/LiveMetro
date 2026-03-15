---
name: start-dev
description: Expo dev 서버 시작 (옵션: --ios, --android, --clear, --tunnel)
argument-hint: [--ios|--android|--clear|--tunnel]
allowed-tools: Bash(npx expo*)
---

Expo 개발 서버를 시작합니다.

사용자가 전달한 인자: `$ARGUMENTS`

## 옵션 처리

아래 옵션을 인자에서 파싱하여 `npx expo start` 커맨드에 추가하세요:

| 옵션 | 플래그 | 설명 |
|------|--------|------|
| `--ios` | `--ios` | iOS 시뮬레이터에서 실행 |
| `--android` | `--android` | Android 에뮬레이터에서 실행 |
| `--clear` | `--clear` | 캐시 초기화 후 시작 |
| `--tunnel` | `--tunnel` | 터널 모드 (실기기 연결) |

옵션은 조합 가능합니다. 예: `/start-dev --ios --clear`

인자가 없으면 `npx expo start`만 실행합니다.

## 실행

Bash 도구로 해당 커맨드를 실행하세요. 서버는 포그라운드에서 실행되므로 사용자에게 실행 중임을 알려주세요.
