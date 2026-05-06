// LiveMetro — Signup Step 1 (verification) and Step 3 (complete)
// Globals: window.{SignupStep1Screen, SignupStep3Screen}
// Step 2 (account form) is in auth.jsx as SignupScreen.

const { useState: useS1State, useEffect: useS1Effect } = React;

// ─────────────── Shared signup chrome ───────────────
function SignupHeader({ step, dark }) {
  return (
    <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        width: 36, height: 36, borderRadius: 9999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(112,115,124,0.08)',
      }}>
        <Icon name="chevron-left" size={22} color={dark ? '#fff' : 'var(--label-strong)'} strokeWidth={2.2} />
      </span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? 'var(--blue-500)' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(112,115,124,0.18)'),
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)', letterSpacing: '0.02em' }}>{step} / 3</span>
    </div>
  );
}

// ─────────────── Step 1 — 본인 인증 (phone verification) ───────────────
function SignupStep1Screen({ dark = false }) {
  const [phase, setPhase] = useS1State('input'); // input | code
  const [seconds, setSeconds] = useS1State(168); // 02:48
  const [code, setCode] = useS1State(['1', '2', '3', '4', '', '']);
  const [carrier, setCarrier] = useS1State('SKT');

  useS1Effect(() => {
    if (phase !== 'code') return;
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <Screen
      dark={dark}
      style={{
        background: dark ? '#0B0E18' : 'var(--bg-base)',
        paddingTop: 54,
      }}
    >
      <SignupHeader step={1} dark={dark} />

      {/* Title */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '0.05em' }}>STEP 1 / 3</div>
        <div style={{
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.25, marginTop: 6,
          color: dark ? '#fff' : 'var(--label-strong)',
        }}>
          본인 인증
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, marginTop: 6, lineHeight: 1.5,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
        }}>
          {phase === 'input'
            ? <>휴대폰 번호로 인증을 진행해요.<br/>입력하신 번호는 본인 확인 외 사용되지 않아요.</>
            : <>전송된 6자리 인증번호를<br/>입력해주세요.</>}
        </div>
      </div>

      {/* Carrier picker */}
      {phase === 'input' && (
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)', marginBottom: 8 }}>통신사</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { id: 'SKT', label: 'SKT' },
              { id: 'KT', label: 'KT' },
              { id: 'LGU', label: 'LG U+' },
              { id: 'SKT-mvno', label: 'SKT 알뜰폰' },
              { id: 'KT-mvno', label: 'KT 알뜰폰' },
              { id: 'LGU-mvno', label: 'LG 알뜰폰' },
            ].map(c => {
              const on = carrier === c.id;
              return (
                <span key={c.id} onClick={() => setCarrier(c.id)} style={{
                  height: 44, borderRadius: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? (dark ? 'rgba(0,102,255,0.18)' : 'var(--blue-50)') : (dark ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle-page)'),
                  color: on ? 'var(--blue-500)' : (dark ? 'rgba(255,255,255,0.75)' : 'var(--label-neutral)'),
                  border: `1px solid ${on ? 'rgba(0,102,255,0.30)' : (dark ? 'rgba(255,255,255,0.10)' : 'var(--line-subtle)')}`,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>{c.label}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Phone input */}
      {phase === 'input' && (
        <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField
            dark={dark}
            label="이름"
            icon="user-round"
            placeholder="홍길동"
            value="이지수"
          />
          <div>
            <FormField
              dark={dark}
              label="휴대폰 번호"
              hint="' - ' 없이 입력"
              icon="smartphone"
              type="tel"
              placeholder="01012345678"
              value="01098765432"
              trailing={
                <span style={{
                  height: 30, padding: '0 10px', borderRadius: 8,
                  background: 'var(--blue-500)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                }} onClick={() => setPhase('code')}>인증 요청</span>
              }
            />
          </div>
          <FormField
            dark={dark}
            label="생년월일"
            icon="calendar"
            placeholder="YYMMDD"
            value="950813"
          />
        </div>
      )}

      {/* Code input phase */}
      {phase === 'code' && (
        <>
          <div style={{ padding: '16px 24px 0' }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: dark ? 'rgba(0,102,255,0.10)' : 'var(--blue-50)',
              border: '1px solid rgba(0,102,255,0.20)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="message-square" size={16} color="var(--blue-500)" strokeWidth={2.2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-700)', flex: 1 }}>
                010-9876-5432로 전송됨
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue-500)', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
            </div>
          </div>

          {/* OTP boxes */}
          <div style={{ padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {[0, 1, 2, 3, 4, 5].map(i => {
                const v = code[i];
                const filled = !!v;
                const isFocus = !filled && code.findIndex(x => !x) === i;
                return (
                  <div key={i} style={{
                    flex: 1, aspectRatio: '1 / 1', maxWidth: 52,
                    borderRadius: 12,
                    background: dark ? 'rgba(255,255,255,0.06)' : 'var(--bg-base)',
                    border: `2px solid ${isFocus ? 'var(--blue-500)' : filled ? (dark ? 'rgba(255,255,255,0.20)' : 'rgba(112,115,124,0.30)') : (dark ? 'rgba(255,255,255,0.10)' : 'var(--line-subtle)')}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 800,
                    color: dark ? '#fff' : 'var(--label-strong)',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif',
                    position: 'relative',
                  }}>
                    {v}
                    {isFocus && <span style={{
                      position: 'absolute', bottom: 10, left: '50%', marginLeft: -1,
                      width: 2, height: 22, background: 'var(--blue-500)',
                      animation: 'lm-blink 1s steps(2) infinite',
                    }} />}
                  </div>
                );
              })}
            </div>
            <style>{`@keyframes lm-blink { 50% { opacity: 0; } }`}</style>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)' }}>
              인증번호가 오지 않았나요?{' '}
              <span style={{ color: 'var(--blue-500)', fontWeight: 800, textDecoration: 'underline' }}>재전송</span>
            </div>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Footer note + CTA */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: dark ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle-page)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 11.5, fontWeight: 600, lineHeight: 1.5,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
        }}>
          <Icon name="shield-check" size={14} color={dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)'} strokeWidth={2.2} style={{ marginTop: 1 }} />
          <span>본인 인증은 NICE 평가정보를 통해 처리되며,<br/>입력하신 정보는 LiveMetro에 저장되지 않아요.</span>
        </div>
      </div>

      <div style={{ padding: '14px 24px 24px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 16,
          background: 'var(--blue-500)', color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {phase === 'input' ? '인증 요청' : '인증 완료'}
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
    </Screen>
  );
}

// ─────────────── Step 3 — 가입 완료 (welcome) ───────────────
function SignupStep3Screen({ dark = false }) {
  const [pulse, setPulse] = useS1State(false);
  useS1Effect(() => {
    const id = setInterval(() => setPulse(p => !p), 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen
      dark={dark}
      style={{
        background: dark ? '#0B0E18' : 'var(--bg-base)',
        paddingTop: 54,
      }}
    >
      <SignupHeader step={3} dark={dark} />

      {/* Hero — animated checkmark in concentric rings */}
      <div style={{ padding: '32px 24px 8px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          position: 'relative', width: 160, height: 160,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 9999,
            background: 'rgba(0,102,255,0.06)',
            transform: pulse ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 1.2s ease',
          }} />
          <span style={{
            position: 'absolute', inset: 18, borderRadius: 9999,
            background: 'rgba(0,102,255,0.12)',
          }} />
          <span style={{
            position: 'absolute', inset: 36, borderRadius: 9999,
            background: 'var(--blue-500)',
            boxShadow: '0 12px 28px rgba(0,102,255,0.35)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="check" size={48} color="#fff" strokeWidth={3} />
          </span>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ padding: '20px 24px 8px', textAlign: 'center' }}>
        <div style={{
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.25,
          color: dark ? '#fff' : 'var(--label-strong)',
        }}>
          환영해요, 지수님
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, marginTop: 8, lineHeight: 1.5,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
        }}>
          가입이 완료되었어요.<br/>
          출퇴근을 더 똑똑하게 만들 준비가 끝났어요.
        </div>
      </div>

      {/* Account summary card */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{
          background: dark ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle-page)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--line-subtle)'}`,
          borderRadius: 16, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 9999,
            background: 'linear-gradient(135deg, #0066FF, #6FA8FF)',
            color: '#fff', fontSize: 18, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>지</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#fff' : 'var(--label-strong)' }}>지수</div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              jisoo.lee@livemetro.app
            </div>
          </div>
          <Pill tone="pos" size="sm">
            <Icon name="badge-check" size={11} color="var(--green-700)" strokeWidth={2.4} />
            인증 완료
          </Pill>
        </div>
      </div>

      {/* Next-up checklist */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)',
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10,
        }}>다음 단계 · 1분이면 끝나요</div>

        <div style={{
          background: dark ? 'rgba(255,255,255,0.04)' : 'var(--bg-base)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--line-subtle)'}`,
          borderRadius: 16, overflow: 'hidden',
        }}>
          {[
            { icon: 'train-front', label: '출퇴근 경로 등록', sub: '집·회사 역만 골라주세요', tone: 'next' },
            { icon: 'bell', label: '알림 시간 설정', sub: '평소 출발 시간 기준', tone: 'todo' },
            { icon: 'star', label: '자주 가는 역 추가', sub: '즐겨찾기로 빠르게 확인', tone: 'todo' },
          ].map((it, i, arr) => (
            <div key={it.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(112,115,124,0.10)'}`,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: it.tone === 'next' ? 'var(--blue-500)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(112,115,124,0.10)'),
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={it.icon} size={18} color={it.tone === 'next' ? '#fff' : (dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)')} strokeWidth={2} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#fff' : 'var(--label-strong)' }}>{it.label}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)', marginTop: 1 }}>{it.sub}</div>
              </div>
              {it.tone === 'next'
                ? <Pill tone="primary" size="sm">지금</Pill>
                : <Icon name="chevron-right" size={16} color={dark ? 'rgba(255,255,255,0.35)' : 'var(--label-alt)'} />}
            </div>
          ))}
        </div>
      </div>

      {/* Welcome bonus */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,102,255,0.10) 0%, rgba(124,58,237,0.08) 100%)',
          border: '1px dashed rgba(0,102,255,0.30)',
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="gift" size={18} color="var(--blue-500)" strokeWidth={2.2} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: dark ? '#fff' : 'var(--label-strong)', flex: 1, lineHeight: 1.45 }}>
            첫 가입 보너스 <span style={{ color: 'var(--blue-500)', fontWeight: 800 }}>30일 ML 예측 무제한</span> 활성화됨
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA — primary advances to onboarding */}
      <div style={{ padding: '14px 24px 12px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 16,
          background: 'var(--blue-500)', color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          출퇴근 설정하러 가기
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
        <button style={{
          marginTop: 8, width: '100%', height: 48,
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, fontWeight: 700,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
        }}>
          나중에 할게요 · 홈으로
        </button>
      </div>
    </Screen>
  );
}

window.SignupStep1Screen = SignupStep1Screen;
window.SignupStep3Screen = SignupStep3Screen;
