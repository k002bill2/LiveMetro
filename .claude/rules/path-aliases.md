# Path Aliases

상대 경로 import 금지. 항상 path alias 사용:

| Alias | Path |
|-------|------|
| `@/` | `src/` |
| `@components/` | `src/components/` |
| `@screens/` | `src/screens/` |
| `@services/` | `src/services/` |
| `@models/` | `src/models/` |
| `@utils/` | `src/utils/` |
| `@hooks/` | `src/hooks/` |

잘못된 예: `import X from '../../components/X'`
올바른 예: `import X from '@components/X'`
