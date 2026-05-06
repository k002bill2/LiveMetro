# Wanted Bundle v5 Delta

> 작성일: 2026-05-06
> v5 핸드오프: claude.ai/design `KH-aDzvj4o5QITdGfvLChA`
> v3 핸드오프: claude.ai/design `j01iuVhlroduq84dc3azIA`
> 페치 결과: HTTP/2 200 + `application/gzip` (`LiveMetro-handoff.tar.gz`, 19MB) — May 6 새 share token 즉시 페치 성공

## 0. 결론

**v5는 v3와 코드 100% 동일**. 신규 디자인 의도 0건. 차이는 다음 두 PNG 2장뿐:

| 신규 자료 | 크기 | 의미 |
|----------|------|------|
| `pasted-1777743918147-0.png` | 184KB | 노선도 v2 시각 ground truth (2호선 역 목록 mock-up) |
| `pasted-1777802788702-0.png` | 126KB | 설정 화면 시각 ground truth (4-row + 2-row + 3-row 그룹) |

기타 차이(`.design-canvas.state.json`)는 캔버스 UI 메타로 implementation에 무관.

## 1. byte-level diff 결과

```
$ diff -rq .tmp/design-fetch/livemetro/ .tmp/design-fetch-v5/livemetro/
Files .tmp/design-fetch/livemetro/project/.design-canvas.state.json
  and .tmp/design-fetch-v5/livemetro/project/.design-canvas.state.json differ
Only in .tmp/design-fetch-v5/livemetro/project/uploads: pasted-1777743918147-0.png
Only in .tmp/design-fetch-v5/livemetro/project/uploads: pasted-1777802788702-0.png
```

**100% 동일**:
- `README.md` (chats=3, 가이드 동일)
- `chats/chat1.md`, `chats/chat2.md`, `chats/chat3.md`
- `project/src/screens/{auth, auth-signup-steps, commute-prediction, main, onboarding-station-picker, onboarding-steps, rest, settings-detail}.jsx` (8개)
- `project/src/{atoms.jsx, data.js}`
- `project/lib/{android-frame, design-canvas, ios-frame, metro-tokens.css, tweaks-panel, wanted-tokens.css}.{jsx,css}`
- `project/uploads/implementation-status.md`
- `project/{LiveMetro.html, LiveMetro-print.html}`

## 2. v3 페치 PNG 누락 분석

`docs/design/wanted-bundle-gap.md:244`는 두 PNG를 v3 번들 자료로 명시했으나, 실제 v3 tar.gz(`.tmp/design-fetch/`)에는 누락됐었습니다. 가능성:

1. v3 페치(2026-05-05) 시점의 핸드오프 생성 로직이 PNG asset을 제외했음
2. 사용자가 v5 export 직전에 PNG 2장을 디자인 캔버스에 추가했고 v5 번들이 이를 포함
3. v3 페치 시 부분 다운로드 실패 (가능성 낮음 — 19MB 정상 사이즈)

가장 가능성 높은 시나리오: claude.ai/design의 핸드오프 export가 시간이 지나며 더 많은 자료를 포함하도록 개선 — 같은 디자인이라도 더 풍부한 번들 발급.

이번 페치 자료는 처음 `docs/design/wanted-bundle/uploads/`에 commit됐다가, 사용자가 직접 다운로드한 offline 핸드오프 미러(`docs/design/livemetro/project/uploads/`)로 단일화됐다 — 후속 commit에서 wanted-bundle/uploads/는 삭제, livemetro/project/uploads/만 single source of truth.

## 3. PNG ↔ 현재 구현 시각 매핑

### 3.1 PNG 1 (노선도 v2) ↔ `src/screens/map/SubwayMapScreen.tsx:177-322`

| 시안 시각 요소 | 코드 위치 | 일치도 |
|---------------|----------|--------|
| 호선 칩: 2호선 활성=녹색 채움+흰 텍스트, 1/3/4호선 비활성=흰 배경+컬러 border+컬러 텍스트 | line 197-218 | ✅ 1:1 |
| height 48 + radius 9999 + box-shadow on active | line 195-207 | ✅ |
| "2호선 역 목록" 22px 800w + "총 51개 역" 13px alt | line 233-238 | ✅ |
| 1px 구분선 + 8px 상단 padding | `stationListHeader` style | ✅ |
| 수직 컬러 트랙 (4px) + 환승 노드(흰 원+컬러 border+↔) + 일반 노드(컬러 채움) | line 248-278 (`ArrowRightLeft size=14 strokeWidth=2.6`) | ✅ 1:1 (stroke 정확히 동일) |
| ko 17px 800w + en 13px alt + transfer badges (1/3/4/5/6) | line 285-313 | ✅ (badge 텍스트는 §4에서 marginal 갭 식별) |
| 우측 chevron-right 18px alt | line 318 | ✅ |

### 3.2 PNG 2 (설정 화면) ↔ `src/screens/settings/SettingsScreen.tsx`

| 시안 시각 요소 | 코드 위치 | 일치도 |
|---------------|----------|--------|
| 4-row 카드 (출퇴근/지연알림/알림시간대/소리) | line 322 이후 그룹 1 | ✅ 행 매핑 |
| "지연 정보" 라벨 + 2-row 카드 (실시간 제보/지연증명서) | line 355-356, 361-367 | ✅ |
| "앱 설정" 라벨 + 3-row 카드 (언어/테마/위치 권한) | line 376 | ✅ |
| 둥근 회색 아이콘 박스 (40x40 추정) | atom (`SettingSection`/`Row`) | 🔍 정밀 atom audit 필요 (별도) |
| Subtitle 정적 vs 동적 (테마=라이트, 언어=한국어) | 동적 (현재 상태) — 구현이 더 풍부 | ✅ 의도 일치 |

PNG 2는 화면 위쪽이 잘려 있어 첫 그룹 라벨 처리(존재/부재)는 단정 어려움 — 별도 검증 필요.

## 4. 식별된 마이크로 갭 (Phase B 후보)

**Transfer badge 한글 lineId 표시 (line 290-313)**

```tsx
{station.transferLines.map((transferLine) => (
  <View key={transferLine} style={[styles.transferBadge, { backgroundColor: transferColor }]}>
    <Text style={[styles.transferBadgeText, { color: transferTextColor }]}>
      {transferLine}   {/* lineId 그대로 */}
    </Text>
  </View>
))}
```

- **정상 케이스**: lineId가 `"1"~"9"` → PNG 1과 정확히 일치
- **잠재 갭**: lineId가 `"공항철도"`, `"경의선"`, `"수인분당선"` 등 한글 → 작은 transfer badge 안에서 텍스트 잘림 가능성. 시안 PNG는 한글 케이스를 보여주지 않음
- **검증 필요**: 한글 lineId 환승역(예: 김포공항)이 실제로 작은 badge 안에서 어떻게 보이는지

후속 작업(Phase B)에서 코드 점검 + LINE_NAMES short label 매핑(`"공항철도"→"공항"` 등) 활용 또는 LineBadge atom 교체를 평가.

## 5. 부록 — 자료 위치

```
docs/design/
├── wanted-bundle-gap.md         # 24-아트보드 갭 인벤토리 (P0 0건)
├── wanted-bundle-v5-delta.md    # 본 문서
├── wanted-livemetro-template.html
├── wanted-visual-audit.md
├── wanted-bundle/               # decoded JS 시안 (런타임 제외 트래킹)
│   ├── 3d77f00f-….js (atoms)
│   ├── 65629bcd-….js (Home/Favorites/StationDetail)
│   ├── 83fe8f1a-….js (Login)
│   ├── 9a7fe457-….js (CommutePrediction)
│   ├── ee09cc40-….js (Routes/Delay/Stats/Map/Alerts/Onboarding/Settings)
│   ├── 69d6b7ba-….js (Android frame)
│   └── bcda7471-….js (LM_DATA mock)
└── livemetro/                   # offline 핸드오프 미러 — single source of truth
    ├── README.md
    └── project/
        ├── LiveMetro.html
        ├── lib/                 # tokens + frame jsx
        ├── src/                 # atoms.jsx, data.js, screens/*.jsx (audit ground truth)
        └── uploads/
            ├── implementation-status.md
            ├── pasted-1777743918147-0.png   # 노선도 v2 ground truth
            └── pasted-1777802788702-0.png   # 설정 화면 ground truth
```

미래 audit에서 PNG 자료를 시각 ground truth로 활용. line-level 정밀 비교는 6절 "검증 필요 항목 13건"의 별도 sweep phase에서 수행.
