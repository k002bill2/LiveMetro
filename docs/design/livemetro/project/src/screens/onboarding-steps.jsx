// LiveMetro — Onboarding step pages (1: 환영, 3: 알림 권한, 4: 즐겨찾기 추천)
// Step 2 (출퇴근 경로) is OnboardingScreen in rest.jsx
// Globals: window.{OnboardingStep1Screen, OnboardingStep3Screen, OnboardingStep4Screen}

const { useState: useO1State, useEffect: useO1Effect } = React;

// Shared header — 4-step progress
function OnbHeader({ step, skip = true }) {
  return (
    <div style={{ padding: '20px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {step > 1
        ? <Icon name="chevron-left" size={26} color="var(--label-neutral)" />
        : <span style={{ width: 26 }} />}
      <div style={{ flex: 1, display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 999,
            background: i <= step ? 'var(--blue-500)' : 'rgba(112,115,124,0.18)',
          }} />
        ))}
      </div>
      {skip
        ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>건너뛰기</span>
        : <span style={{ width: 48 }} />}
    </div>
  );
}

function StepEyebrow({ step, total = 4 }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '0.05em' }}>
      STEP {step} / {total}
    </div>
  );
}

// ─────────────── STEP 1 — 환영 / 사용 동의 ───────────────
function OnboardingStep1Screen() {
  const [pulse, setPulse] = useO1State(false);
  useO1Effect(() => {
    const id = setInterval(() => setPulse(p => !p), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen style={{ background: 'var(--bg-base)' }}>
      <OnbHeader step={1} skip={false} />

      {/* Hero — abstract metro lines */}
      <div style={{ padding: '8px 0 0', position: 'relative', height: 220 }}>
        <svg viewBox="0 0 390 220" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="onb1-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="onb1-mask">
              <rect width="390" height="220" fill="url(#onb1-fade)" />
            </mask>
          </defs>
          <g mask="url(#onb1-mask)">
            {[
              { c: '#00A84D', y: 80,  dy: -10 },
              { c: '#0052A4', y: 110, dy: 0 },
              { c: '#EF7C1C', y: 140, dy: 12 },
              { c: '#996CAC', y: 170, dy: -6 },
            ].map((l, i) => (
              <path key={i}
                d={`M -20 ${l.y} Q 130 ${l.y + l.dy} 260 ${l.y + l.dy * 0.4} T 420 ${l.y - l.dy * 0.2}`}
                stroke={l.c} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.92"
              />
            ))}
          </g>
        </svg>

        {/* Center pulsing pin */}
        <div style={{
          position: 'absolute', left: '50%', top: 100,
          marginLeft: -22, width: 44, height: 44, borderRadius: 999,
          background: 'var(--blue-500)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: pulse
            ? '0 0 0 8px rgba(0,102,255,0.18), 0 0 0 18px rgba(0,102,255,0.08), 0 8px 20px rgba(0,102,255,0.30)'
            : '0 0 0 4px rgba(0,102,255,0.18), 0 0 0 10px rgba(0,102,255,0.08), 0 8px 20px rgba(0,102,255,0.30)',
          transition: 'box-shadow 0.7s ease',
        }}>
          <Icon name="train-front" size={22} color="#fff" strokeWidth={2.4} />
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '20px 24px 12px' }}>
        <StepEyebrow step={1} />
        <div style={{
          fontSize: 28, fontWeight: 800, color: 'var(--label-strong)',
          letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.2,
        }}>
          시작 전에<br />몇 가지만 확인할게요
        </div>
        <div style={{ fontSize: 14, color: 'var(--label-alt)', fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
          더 정확한 출퇴근 예측을 위해<br />아래 정보가 필요해요. 1분이면 끝나요.
        </div>
      </div>

      {/* Value props */}
      <div style={{ padding: '8px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: 'map-pin', bg: 'rgba(0,102,255,0.12)', fg: 'var(--blue-500)', title: '주변 역 자동 검색', sub: '근처 지하철역을 찾아 표시해요' },
          { icon: 'sparkles', bg: 'rgba(124,58,237,0.12)', fg: 'var(--violet-500)', title: 'ML 출퇴근 예측', sub: '내 패턴을 학습해 ±3분 정확도' },
          { icon: 'bell-ring', bg: 'rgba(255,180,0,0.16)', fg: '#A06A00', title: '실시간 지연 알림', sub: '내 노선 지연을 즉시 알려드려요' },
        ].map(v => (
          <div key={v.title} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 14px', borderRadius: 14,
            background: 'var(--bg-subtle-page)',
            border: '1px solid var(--line-subtle)',
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 10, background: v.bg,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={v.icon} size={20} color={v.fg} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>{v.title}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-alt)', marginTop: 2 }}>{v.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Privacy note */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(112,115,124,0.06)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: 'var(--label-alt)',
        }}>
          <Icon name="shield-check" size={14} color="var(--label-alt)" strokeWidth={2.2} style={{ marginTop: 1 }} />
          <span>모든 정보는 기기에만 저장되며,<br />언제든지 설정에서 변경할 수 있어요.</span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '14px 24px 24px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 14, border: 'none',
          background: 'var(--blue-500)', color: '#fff',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          시작하기
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
    </Screen>
  );
}

// ─────────────── STEP 3 — 알림 권한 ───────────────
function OnboardingStep3Screen() {
  const [delay, setDelay] = useO1State(true);
  const [arrive, setArrive] = useO1State(true);
  const [community, setCommunity] = useO1State(false);

  return (
    <Screen style={{ background: 'var(--bg-base)' }}>
      <OnbHeader step={3} />

      {/* Title */}
      <div style={{ padding: '32px 24px 16px' }}>
        <StepEyebrow step={3} />
        <div style={{
          fontSize: 28, fontWeight: 800, color: 'var(--label-strong)',
          letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.2,
        }}>
          어떤 알림을<br />받고 싶으세요?
        </div>
        <div style={{ fontSize: 14, color: 'var(--label-alt)', fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
          출퇴근 시간대에만 조용히 알려드려요.<br />언제든 끌 수 있어요.
        </div>
      </div>

      {/* Mock notification preview card */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(0,102,255,0.06), rgba(0,102,255,0.02))',
          borderRadius: 18, padding: 16,
          border: '1px solid rgba(0,102,255,0.20)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
            미리보기 · 잠금 화면
          </div>
          <div style={{
            background: 'var(--bg-base)', borderRadius: 14, padding: '12px 14px',
            border: '1px solid var(--line-subtle)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8, background: 'var(--blue-500)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="train-front" size={16} color="#fff" strokeWidth={2.4} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--label-strong)' }}>LiveMetro</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-alt)', marginLeft: 'auto' }}>지금</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-strong)', marginTop: 2 }}>
                홍대입구 → 강남, 오늘은 <span style={{ color: 'var(--blue-500)' }}>32분</span> 예상
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--label-alt)', marginTop: 2 }}>
                평소보다 4분 빠름 · 08:30 출발 권장
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { id: 'arrive', icon: 'clock', bg: 'rgba(0,102,255,0.12)', fg: 'var(--blue-500)', title: '출근 시간 알림', sub: '평소 출발 5분 전', value: arrive, set: setArrive },
          { id: 'delay', icon: 'alert-triangle', bg: 'rgba(255,66,66,0.10)', fg: 'var(--red-500)', title: '지연 알림', sub: '5분 이상 지연 시 즉시', value: delay, set: setDelay, recommend: true },
          { id: 'comm', icon: 'megaphone', bg: 'rgba(255,180,0,0.16)', fg: '#A06A00', title: '실시간 제보 알림', sub: '검증된 제보 도착 시', value: community, set: setCommunity },
        ].map(t => (
          <div key={t.id} style={{
            background: t.value ? 'var(--bg-base)' : 'var(--bg-subtle-page)',
            borderRadius: 14, padding: '14px 16px',
            border: t.value ? '2px solid var(--blue-500)' : '1px solid var(--line-subtle)',
            display: 'flex', alignItems: 'center', gap: 12,
            transition: 'all .15s ease',
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: 10, background: t.bg,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={t.icon} size={20} color={t.fg} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>{t.title}</span>
                {t.recommend && <Pill tone="primary" size="sm">추천</Pill>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-alt)', marginTop: 2 }}>{t.sub}</div>
            </div>
            {/* toggle */}
            <span onClick={() => t.set(!t.value)} style={{
              width: 44, height: 26, borderRadius: 9999, cursor: 'pointer',
              background: t.value ? 'var(--blue-500)' : 'rgba(112,115,124,0.30)',
              position: 'relative', flexShrink: 0,
              transition: 'background .15s ease',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: t.value ? 21 : 3,
                width: 20, height: 20, borderRadius: 9999, background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                transition: 'left .15s cubic-bezier(0.2,0,0.2,1)',
              }} />
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA */}
      <div style={{ padding: '24px 24px 24px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 14, border: 'none',
          background: 'var(--blue-500)', color: '#fff',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          허용하고 다음
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
    </Screen>
  );
}

// ─────────────── STEP 4 — 즐겨찾기 추천 ───────────────
function OnboardingStep4Screen() {
  const D = window.LM_DATA;
  const LINES = D.LINES;
  const [picked, setPicked] = useO1State(['gangnam', 'hongdae']);

  // Suggested stations — built from common Seoul stations
  const suggestions = [
    { id: 'hongdae',  name: '홍대입구', en: 'Hongik Univ.', lines: ['2', '6', '경의'], reason: '집 근처 · 출발역', recommend: true },
    { id: 'gangnam',  name: '강남',     en: 'Gangnam',      lines: ['2', '신분당'],     reason: '회사 근처 · 도착역', recommend: true },
    { id: 'sadang',   name: '사당',     en: 'Sadang',       lines: ['2', '4'],          reason: '환승 빈도 높음' },
    { id: 'seoulst',  name: '서울역',   en: 'Seoul Station', lines: ['1', '4', '경의'], reason: 'KTX/공항' },
    { id: 'yongsan',  name: '용산',     en: 'Yongsan',      lines: ['1', '경의'],       reason: '주변 역' },
    { id: 'jamsil',   name: '잠실',     en: 'Jamsil',       lines: ['2', '8'],          reason: '주변 역' },
  ];

  const togglePick = id => setPicked(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);

  return (
    <Screen style={{ background: 'var(--bg-base)' }}>
      <OnbHeader step={4} />

      {/* Title */}
      <div style={{ padding: '32px 24px 12px' }}>
        <StepEyebrow step={4} />
        <div style={{
          fontSize: 28, fontWeight: 800, color: 'var(--label-strong)',
          letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.2,
        }}>
          자주 가는 역을<br />골라주세요
        </div>
        <div style={{ fontSize: 14, color: 'var(--label-alt)', fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
          홈 화면 상단에 빠르게 확인할 수 있어요.<br />최소 1개 이상 선택해주세요.
        </div>
      </div>

      {/* Search bar (decorative) */}
      <div style={{ padding: '8px 24px 12px' }}>
        <div style={{
          height: 44, borderRadius: 12,
          background: 'var(--bg-subtle-page)',
          border: '1px solid var(--line-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
        }}>
          <Icon name="search" size={16} color="var(--label-alt)" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-alt)' }}>역 이름 검색</span>
        </div>
      </div>

      {/* Section label */}
      <div style={{
        padding: '4px 24px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 12, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <span>추천</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'none', letterSpacing: 0, color: 'var(--label-alt)' }}>
          {picked.length}개 선택됨
        </span>
      </div>

      {/* Suggested grid */}
      <div style={{ padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map(s => {
          const on = picked.includes(s.id);
          return (
            <div key={s.id} onClick={() => togglePick(s.id)} style={{
              padding: '12px 14px', borderRadius: 14,
              background: on ? 'rgba(0,102,255,0.06)' : 'var(--bg-base)',
              border: on ? '2px solid var(--blue-500)' : '1px solid var(--line-subtle)',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              transition: 'all .15s ease',
            }}>
              {/* Star */}
              <span style={{
                width: 36, height: 36, borderRadius: 9999,
                background: on ? 'var(--blue-500)' : 'rgba(112,115,124,0.10)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="star" size={16} color={on ? '#fff' : 'var(--label-alt)'} strokeWidth={2.2}
                  style={on ? { fill: '#fff' } : {}} />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--label-strong)' }}>{s.name}</span>
                  {s.recommend && <Pill tone="primary" size="sm">추천</Pill>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {s.lines.map(l => LINES[l] && <LineBadge key={l} line={l} size={16} />)}
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label-alt)', marginLeft: 4 }}>{s.reason}</span>
                </div>
              </div>

              {/* Check */}
              <span style={{
                width: 24, height: 24, borderRadius: 9999, flexShrink: 0,
                background: on ? 'var(--blue-500)' : 'transparent',
                border: on ? 'none' : '2px solid rgba(112,115,124,0.28)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {on && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA — completion */}
      <div style={{ padding: '20px 24px 24px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 14, border: 'none',
          background: picked.length > 0 ? 'var(--blue-500)' : 'rgba(112,115,124,0.30)',
          color: '#fff',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: picked.length > 0 ? '0 8px 20px rgba(0,102,255,0.30)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: picked.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
          {picked.length > 0 ? `${picked.length}개 추가하고 시작하기` : '역을 선택해주세요'}
          {picked.length > 0 && <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />}
        </button>
      </div>
    </Screen>
  );
}

window.OnboardingStep1Screen = OnboardingStep1Screen;
window.OnboardingStep3Screen = OnboardingStep3Screen;
window.OnboardingStep4Screen = OnboardingStep4Screen;
