// LiveMetro — Login / Auth screen
// Globals: window.LoginScreen
// 노선 컬러로 만든 그라데이션 + 추상 라인 그래픽 히어로 + Face ID 메인 CTA
// + 소셜 로그인(Apple, Google, 카카오) + 익명(둘러보기) 진입.

const { useState: useAState, useEffect: useAEffect } = React;

// ─────────────── Hero artwork ───────────────
// 서울 지하철 노선 컬러로 만든 추상적인 라인/도트 그래픽.
// 실사 노선도가 아니라 LiveMetro 브랜드의 시각적 시그니처.
function LoginHero({ dark }) {
  const lines = [
    { color: '#00A84D', y: 64,  w: 220, dy: -12 }, // 2호선
    { color: '#0052A4', y: 96,  w: 260, dy: 0   }, // 1호선
    { color: '#EF7C1C', y: 128, w: 180, dy: 14  }, // 3호선
    { color: '#996CAC', y: 160, w: 240, dy: -6  }, // 5호선
    { color: '#D6406A', y: 192, w: 200, dy: 8   }, // 신분당
  ];
  return (
    <div style={{
      position: 'relative',
      height: 300,
      width: '100%',
      overflow: 'hidden',
      background: dark
        ? 'radial-gradient(120% 80% at 30% 20%, #1B2540 0%, #0B0E18 70%)'
        : 'radial-gradient(120% 80% at 30% 20%, #EAF2FF 0%, #F7FAFF 70%)',
    }}>
      {/* 추상 라인들 */}
      <svg viewBox="0 0 390 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {lines.map((l, i) => (
          <g key={i}>
            <path
              d={`M ${-20} ${l.y} Q 130 ${l.y + l.dy} 260 ${l.y + l.dy * 0.4} T 420 ${l.y - l.dy * 0.2}`}
              stroke={l.color}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              opacity={dark ? 0.85 : 0.92}
            />
            {/* 정거장 노드 */}
            <circle cx={70 + i * 12} cy={l.y + l.dy * 0.6} r="5" fill={dark ? '#0B0E18' : '#fff'} stroke={l.color} strokeWidth="3" />
            <circle cx={210 + i * 8} cy={l.y + l.dy * 0.2} r="5" fill={dark ? '#0B0E18' : '#fff'} stroke={l.color} strokeWidth="3" />
          </g>
        ))}
      </svg>

      {/* 펄스 핀 — "당신은 여기" */}
      <div style={{
        position: 'absolute', left: 168, top: 130,
        width: 18, height: 18, borderRadius: 999,
        background: 'var(--blue-500)',
        boxShadow: '0 0 0 6px rgba(0,102,255,0.18), 0 0 0 14px rgba(0,102,255,0.08)',
      }} />

      {/* 워드마크 */}
      <div style={{
        position: 'absolute', left: 24, bottom: 22,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: 'var(--blue-500)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 14px rgba(0,102,255,0.30)',
        }}>
          <Icon name="train-front" size={20} color="#fff" strokeWidth={2.2} />
        </div>
        <div>
          <div style={{
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em',
            color: dark ? '#fff' : 'var(--label-strong)',
            lineHeight: 1,
          }}>LiveMetro</div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
            marginTop: 4,
          }}>실시간 · ML 예측 · 커뮤니티</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Social button ───────────────
function SocialButton({ provider, label }) {
  const styles = {
    apple:  { bg: '#000',     fg: '#fff',         icon: 'apple',           border: 'none' },
    google: { bg: '#fff',     fg: '#1A1A1A',      icon: 'globe',           border: '1px solid var(--line-subtle)' },
    kakao:  { bg: '#FEE500',  fg: '#191919',      icon: 'message-circle',  border: 'none' },
  }[provider];
  return (
    <button style={{
      width: '100%', height: 52, borderRadius: 14,
      background: styles.bg, color: styles.fg,
      border: styles.border,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <Icon name={styles.icon} size={20} color={styles.fg} strokeWidth={2} />
      {label}
    </button>
  );
}

// ─────────────── Divider with label ───────────────
function OrDivider({ label = '또는' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--line-subtle)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', letterSpacing: '0.04em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--line-subtle)' }} />
    </div>
  );
}

// ─────────────── Login screen ───────────────
function LoginScreen({ dark = false }) {
  const [pulse, setPulse] = useAState(false);
  useAEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen
      dark={dark}
      style={{
        background: dark ? '#0B0E18' : 'var(--bg-base)',
        paddingTop: 54,
        paddingBottom: 0,
      }}
    >
      <LoginHero dark={dark} />

      {/* 본문 */}
      <div style={{ flex: 1, padding: '28px 24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
          color: dark ? '#fff' : 'var(--label-strong)',
          lineHeight: 1.25,
        }}>
          출퇴근, 1초도 낭비 없이.
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
          marginTop: 6, lineHeight: 1.5,
        }}>
          내 출퇴근 패턴을 학습해 도착 시간을 예측하고,<br/>
          실시간 혼잡도와 지연 정보를 알려드려요.
        </div>

        {/* Face ID 메인 CTA */}
        <button style={{
          marginTop: 24, height: 56, borderRadius: 16,
          background: 'var(--blue-500)', color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          position: 'relative',
        }}>
          {/* faceID glyph */}
          <span style={{
            width: 26, height: 26, borderRadius: 7,
            border: '2.4px solid #fff',
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* 코너 표시 */}
            <span style={{ position: 'absolute', top: -2, left: -2, width: 7, height: 7, borderTop: '2.4px solid #fff', borderLeft: '2.4px solid #fff' }} />
            <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderTop: '2.4px solid #fff', borderRight: '2.4px solid #fff' }} />
            <span style={{ position: 'absolute', bottom: -2, left: -2, width: 7, height: 7, borderBottom: '2.4px solid #fff', borderLeft: '2.4px solid #fff' }} />
            <span style={{ position: 'absolute', bottom: -2, right: -2, width: 7, height: 7, borderBottom: '2.4px solid #fff', borderRight: '2.4px solid #fff' }} />
            {/* 눈 */}
            <span style={{ position: 'absolute', top: 7, left: 5, width: 3, height: 3, borderRadius: 2, background: '#fff' }} />
            <span style={{ position: 'absolute', top: 7, right: 5, width: 3, height: 3, borderRadius: 2, background: '#fff' }} />
            {/* 입 */}
            <span style={{ position: 'absolute', bottom: 6, left: 6, right: 6, height: 2, borderBottom: '2px solid #fff', borderRadius: 2 }} />
          </span>
          Face ID로 계속하기
          {/* 펄스 인디케이터 */}
          <span style={{
            position: 'absolute', right: 18,
            width: 8, height: 8, borderRadius: 999,
            background: '#fff',
            opacity: pulse ? 1 : 0.4,
            transition: 'opacity 0.7s ease',
          }} />
        </button>

        {/* 비밀번호로 로그인 */}
        <button style={{
          marginTop: 10, height: 52, borderRadius: 14,
          background: 'transparent',
          color: dark ? '#fff' : 'var(--label-strong)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'var(--line-subtle)'}`,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 15, fontWeight: 700,
        }}>
          <Icon name="mail" size={18} color={dark ? '#fff' : 'var(--label-strong)'} strokeWidth={2} />
          이메일로 로그인
        </button>

        <div style={{ marginTop: 18 }}>
          <OrDivider label="간편 로그인" />
        </div>

        {/* 소셜 로그인 */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SocialButton provider="apple"  label="Apple로 계속하기" />
          <SocialButton provider="google" label="Google로 계속하기" />
          <SocialButton provider="kakao"  label="카카오로 계속하기" />
        </div>

        {/* 익명/둘러보기 */}
        <button style={{
          marginTop: 18, alignSelf: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          padding: '10px 12px',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700,
          color: dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)',
        }}>
          <Icon name="eye" size={15} color={dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)'} strokeWidth={2} />
          로그인 없이 둘러보기
          <Icon name="chevron-right" size={14} color={dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)'} strokeWidth={2} />
        </button>

        <div style={{ flex: 1 }} />

        {/* 약관 마이크로카피 */}
        <div style={{
          marginTop: 12, padding: '12px 8px 24px',
          textAlign: 'center',
          fontSize: 11, fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.45)' : 'var(--label-alt)',
          lineHeight: 1.55,
        }}>
          계속 진행하면 LiveMetro의<br/>
          <span style={{ textDecoration: 'underline', fontWeight: 700 }}>서비스 이용약관</span>
          {' '}및{' '}
          <span style={{ textDecoration: 'underline', fontWeight: 700 }}>개인정보 처리방침</span>
          에 동의하게 됩니다.
        </div>
      </div>
    </Screen>
  );
}

// ─────────────── Form field ───────────────
function FormField({ label, hint, error, icon, value, placeholder, type = 'text', dark, trailing }) {
  const [focused, setFocused] = useAState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.7)' : 'var(--label-neutral)' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.45)' : 'var(--label-alt)' }}>{hint}</span>}
      </div>
      <div style={{
        height: 50, borderRadius: 12,
        background: dark ? 'rgba(255,255,255,0.06)' : 'var(--bg-base)',
        border: `1px solid ${error ? 'var(--red-500)' : focused ? 'var(--blue-500)' : (dark ? 'rgba(255,255,255,0.14)' : 'var(--line-subtle)')}`,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
        transition: 'border-color 0.15s ease',
      }}>
        {icon && <Icon name={icon} size={18} color={dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)'} strokeWidth={2} />}
        <input
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
            color: dark ? '#fff' : 'var(--label-strong)',
          }}
        />
        {trailing}
      </div>
      {error && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="alert-circle" size={12} color="var(--red-500)" strokeWidth={2.4} />
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────── Checkbox row ───────────────
function CheckRow({ checked, required, label, expandable, dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: checked ? 'var(--blue-500)' : 'transparent',
        border: `1.5px solid ${checked ? 'var(--blue-500)' : (dark ? 'rgba(255,255,255,0.3)' : 'var(--line-subtle)')}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
      </span>
      <span style={{
        flex: 1, fontSize: 13, fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.85)' : 'var(--label-strong)',
      }}>
        {required && <span style={{ color: 'var(--blue-500)', marginRight: 4 }}>(필수)</span>}
        {!required && <span style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'var(--label-alt)', marginRight: 4 }}>(선택)</span>}
        {label}
      </span>
      {expandable && (
        <Icon name="chevron-right" size={16} color={dark ? 'rgba(255,255,255,0.5)' : 'var(--label-alt)'} strokeWidth={2} />
      )}
    </div>
  );
}

// ─────────────── Signup screen ───────────────
function SignupScreen({ dark = false }) {
  // 비밀번호 강도 표시
  const strength = 3; // 0-4
  const strengthLabels = ['', '약함', '보통', '안전', '매우 안전'];
  const strengthColors = ['', 'var(--red-500)', '#F59E0B', 'var(--green-500)', 'var(--green-700)'];

  return (
    <Screen
      dark={dark}
      style={{
        background: dark ? '#0B0E18' : 'var(--bg-base)',
        paddingTop: 54,
      }}
    >
      {/* 헤더 — 뒤로 + 진행 인디케이터 */}
      <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 9999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(112,115,124,0.08)',
        }}>
          <Icon name="chevron-left" size={22} color={dark ? '#fff' : 'var(--label-strong)'} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--blue-500)' }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--blue-500)' }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(112,115,124,0.18)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)', letterSpacing: '0.02em' }}>2 / 3</span>
      </div>

      {/* 타이틀 */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.25,
          color: dark ? '#fff' : 'var(--label-strong)',
        }}>
          계정 만들기
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, marginTop: 6, lineHeight: 1.5,
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--label-alt)',
        }}>
          이메일로 가입하면 출퇴근 패턴 학습과<br/>
          기기 간 동기화를 사용할 수 있어요.
        </div>
      </div>

      {/* 폼 */}
      <div style={{ padding: '16px 24px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField
          dark={dark}
          label="이메일"
          icon="mail"
          type="email"
          placeholder="you@example.com"
          value="jisoo.lee@"
        />

        <FormField
          dark={dark}
          label="닉네임"
          hint="2~10자"
          icon="user-round"
          placeholder="LiveMetro에서 사용할 이름"
          value="지수"
        />

        <div>
          <FormField
            dark={dark}
            label="비밀번호"
            hint="8자 이상 · 영문/숫자/기호"
            icon="lock"
            type="password"
            placeholder="••••••••"
            value="••••••••••"
            trailing={
              <Icon name="eye-off" size={18} color={dark ? 'rgba(255,255,255,0.5)' : 'var(--label-alt)'} strokeWidth={2} />
            }
          />
          {/* 강도 미터 */}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i <= strength ? strengthColors[strength] : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(112,115,124,0.14)'),
                  transition: 'background 0.2s ease',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: strengthColors[strength], minWidth: 44, textAlign: 'right' }}>
              {strengthLabels[strength]}
            </span>
          </div>
        </div>

        <FormField
          dark={dark}
          label="비밀번호 확인"
          icon="lock"
          type="password"
          placeholder="다시 한 번 입력"
          value="••••••••••"
          trailing={
            <span style={{
              width: 22, height: 22, borderRadius: 999,
              background: 'var(--green-500)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="check" size={14} color="#fff" strokeWidth={3} />
            </span>
          }
        />
      </div>

      {/* 약관 동의 */}
      <div style={{
        margin: '20px 24px 8px',
        padding: '14px 16px',
        borderRadius: 14,
        background: dark ? 'rgba(255,255,255,0.04)' : 'var(--bg-subtle-page)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--line-subtle)'}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingBottom: 10, marginBottom: 6,
          borderBottom: `1px dashed ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(112,115,124,0.18)'}`,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--blue-500)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="check" size={14} color="#fff" strokeWidth={3} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: dark ? '#fff' : 'var(--label-strong)' }}>
            전체 동의
          </span>
        </div>
        <CheckRow dark={dark} checked required label="이용약관" expandable />
        <CheckRow dark={dark} checked required label="개인정보 처리방침" expandable />
        <CheckRow dark={dark} checked required label="만 14세 이상입니다" />
        <CheckRow dark={dark} checked={false} label="마케팅 정보 수신" expandable />
      </div>

      {/* 가입 CTA */}
      <div style={{ padding: '12px 24px 0' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 16,
          background: 'var(--blue-500)', color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          boxShadow: '0 8px 20px rgba(0,102,255,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          가입하고 시작하기
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
      </div>

      {/* 로그인 링크 */}
      <div style={{
        padding: '18px 24px 24px', textAlign: 'center',
        fontSize: 13, fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.55)' : 'var(--label-alt)',
      }}>
        이미 계정이 있으신가요?{' '}
        <span style={{ color: 'var(--blue-500)', fontWeight: 800, textDecoration: 'underline' }}>로그인</span>
      </div>
    </Screen>
  );
}

window.LoginScreen = LoginScreen;
window.SignupScreen = SignupScreen;
