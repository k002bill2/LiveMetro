// LiveMetro — Routes, Delay Feed, Statistics, Map, Alerts, Onboarding, Settings
// Globals: window.{RoutesScreen, DelayFeedScreen, StatsScreen, MapScreen, AlertsScreen, OnboardingScreen, SettingsScreen}

const { useState: useSState } = React;

// ─────────────── ROUTES (alternative comparison) ───────────────
function RoutesScreen({ density = 'balanced' }) {
  const D = window.LM_DATA;
  const [sel, setSel] = useSState('r1');
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="chevron-left" size={26} strokeWidth={2} />
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-strong)', flex: 1, textAlign: 'center' }}>경로 비교</span>
        <span style={{ width: 26 }} />
      </div>

      {/* From-To */}
      <div style={{ padding: '12px 20px 12px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--line-subtle)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--label-strong)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-strong)', flex: 1 }}>홍대입구</span>
            <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700 }}>출발</span>
          </div>
          <div style={{ height: 1, background: 'rgba(112,115,124,0.16)', marginLeft: 36 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--blue-500)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-strong)', flex: 1 }}>강남</span>
            <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700 }}>도착</span>
            <Icon name="arrow-up-down" size={16} color="var(--label-alt)" />
          </div>
        </div>
      </div>

      {/* Time/option chips */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['지금 출발', '오전 8:32', '도착 시간 지정'].map((c, i) => (
          <span key={c} style={{
            padding: '8px 12px', borderRadius: 9999,
            background: i === 0 ? 'var(--blue-50)' : 'var(--bg-base)',
            color: i === 0 ? 'var(--blue-700)' : 'var(--label-neutral)',
            fontSize: 12, fontWeight: 700,
            border: i === 0 ? '1px solid rgba(0,102,255,0.20)' : '1px solid var(--line-subtle)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c}</span>
        ))}
      </div>

      {/* Route cards */}
      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {D.ROUTES.map(r => {
          const tone = window.CONG_TONE[r.cong];
          const isSel = sel === r.id;
          return (
            <div key={r.id} onClick={() => setSel(r.id)} style={{
              background: 'var(--bg-base)', borderRadius: 16, padding: 16,
              border: isSel ? '2px solid var(--blue-500)' : '1px solid var(--line-subtle)',
              boxShadow: isSel ? '0 4px 12px rgba(0,102,255,0.10)' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill tone={r.id === 'r1' ? 'primary' : r.id === 'r3' ? 'pos' : 'neutral'} size="sm">{r.label}</Pill>
                <Pill tone="neutral" size="sm">{r.tag}</Pill>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--label-alt)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.color }} />
                  {tone.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', color: 'var(--label-strong)' }}>{r.totalMin}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-neutral)' }}>분</span>
                <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--label-alt)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span><Icon name="arrow-right-left" size={11} style={{ verticalAlign: -1 }} /> 환승 {r.transfers}</span>
                  <span>· 도보 {r.walkMin}분</span>
                  <span>· {r.fare.toLocaleString()}원</span>
                </span>
              </div>

              {/* Visual journey strip */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 4, height: 24 }}>
                {r.legs.map((l, i) => {
                  if (l.type === 'walk') {
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', background: 'rgba(112,115,124,0.10)', borderRadius: 6, height: 24 }}>
                        <Icon name="footprints" size={11} color="var(--label-neutral)" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--label-neutral)' }}>{l.min}</span>
                      </div>
                    );
                  }
                  if (l.type === 'transfer') {
                    return <Icon key={i} name="arrow-right" size={12} color="var(--label-alt)" />;
                  }
                  // train leg — sized to stations
                  const lc = D.LINES[l.line].color;
                  const w = Math.max(36, 14 + l.stations * 7);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px',
                      height: 24, background: lc, color: '#fff', borderRadius: 6, minWidth: w,
                      flex: l.stations > 4 ? 1 : 'initial',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 800 }}>{D.LINES[l.line].label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{l.min}분</span>
                    </div>
                  );
                })}
              </div>

              {/* Detailed steps when selected */}
              {isSel && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed rgba(112,115,124,0.22)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {r.legs.filter(l => l.type === 'train').map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LineBadge line={l.line} size={20} />
                      <span style={{ fontSize: 13, color: 'var(--label-neutral)', fontWeight: 600, flex: 1 }}>
                        {l.from} <Icon name="arrow-right" size={11} style={{ verticalAlign: -1, color: 'var(--label-alt)' }} /> {l.to} ({l.stations}개역)
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>{l.dir}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 12px' }}>
        <button style={{
          width: '100%', height: 52, borderRadius: 12, border: 'none',
          background: 'var(--blue-500)', color: '#fff',
          fontSize: 15, fontWeight: 700,
        }}>이 경로로 길안내 시작</button>
      </div>

      <TabBar active="route" />
    </Screen>
  );
}

// ─────────────── DELAY FEED ───────────────
function DelayFeedScreen({ density = 'balanced' }) {
  const D = window.LM_DATA;
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em' }}>실시간 제보</div>
        <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="megaphone" size={18} color="#fff" strokeWidth={2.2} />
        </span>
      </div>
      <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--label-alt)', fontWeight: 600 }}>
        지난 1시간 · 실시간 제보 4건
      </div>

      {/* filter chips */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['전체', '지연', '신호장애', '혼잡', '내 노선만'].map((c, i) => (
          <span key={c} style={{
            padding: '8px 12px', borderRadius: 9999,
            background: i === 0 ? 'var(--label-strong)' : 'var(--bg-base)',
            color: i === 0 ? '#fff' : 'var(--label-neutral)',
            fontSize: 12, fontWeight: 700,
            border: i === 0 ? 'none' : '1px solid var(--line-subtle)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c}</span>
        ))}
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {D.DELAY_REPORTS.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg-base)', borderRadius: 16, padding: 16,
            border: '1px solid var(--line-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LineBadge line={r.line} size={22} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>{r.station}</span>
              {r.verified && <Pill tone="warn" size="sm">검증됨</Pill>}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--label-alt)', fontWeight: 600 }}>{r.time}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: 'var(--label-neutral)', fontWeight: 500, lineHeight: 1.5 }}>
              {r.msg}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill tone="neutral" size="sm">#{r.tag}</Pill>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="thumbs-up" size={14} color="var(--blue-500)" /> {r.votes}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="message-circle" size={14} /> 12
                </span>
                <Icon name="share-2" size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <TabBar active="feed" />
    </Screen>
  );
}

// ─────────────── STATS ───────────────
function StatsScreen() {
  const D = window.LM_DATA.STATS;
  const LINES = window.LM_DATA.LINES;
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="chevron-left" size={26} strokeWidth={2} />
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-strong)', flex: 1, textAlign: 'center' }}>나의 통계</span>
        <Icon name="calendar" size={20} />
      </div>

      <div style={{ padding: '8px 20px 4px', fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>
        2026년 5월 · 이번 주
      </div>

      {/* KPI grid */}
      <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: '정시 운행률', value: 92, unit: '%', tone: 'pos', delta: '+2%' },
          { label: '평균 출퇴근', value: 28, unit: '분', tone: 'neutral', delta: '-3분' },
          { label: '이용 횟수', value: 47, unit: '회', tone: 'neutral', delta: '+8회' },
          { label: '총 지연', value: 14, unit: '분', tone: 'neg', delta: '+4분' },
        ].map(k => {
          const c = k.tone === 'pos' ? '#00BF40' : k.tone === 'neg' ? '#FF4242' : 'var(--label-strong)';
          return (
            <div key={k.label} style={{ background: 'var(--bg-base)', borderRadius: 14, padding: 14, border: '1px solid var(--line-subtle)' }}>
              <div style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>{k.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: c, fontVariantNumeric: 'tabular-nums', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>{k.value}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-neutral)' }}>{k.unit}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700, marginTop: 2 }}>{k.delta} 지난주 대비</div>
            </div>
          );
        })}
      </div>

      {/* Weekly trend */}
      <SectionHeader title="주간 정시율 추이" subtitle="최근 7주" />
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, padding: 20, border: '1px solid var(--line-subtle)' }}>
          <div style={{ position: 'relative', height: 100 }}>
            {/* gridlines */}
            {[0, 1, 2].map(i => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 50}%`, height: 1, background: 'rgba(112,115,124,0.10)' }} />
            ))}
            {/* line chart */}
            <svg viewBox="0 0 280 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', position: 'relative' }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066FF" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const pts = D.weeklyTrend.map((v, i) => [i / 6 * 280, 100 - (v - 80) / 20 * 100]);
                const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
                return (
                  <>
                    <path d={`${path} L280,100 L0,100 Z`} fill="url(#g1)" />
                    <path d={path} fill="none" stroke="#0066FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill="#0066FF" stroke="var(--bg-base)" strokeWidth="1.5" />
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--label-alt)', fontWeight: 700 }}>
            {['7주전', '6주전', '5주전', '4주전', '3주전', '지난주', '이번주'].map(w => <span key={w}>{w}</span>)}
          </div>
        </div>
      </div>

      {/* Per-line donut */}
      <SectionHeader title="노선별 이용" subtitle="이번 주 47회" />
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, padding: 20, border: '1px solid var(--line-subtle)', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* donut */}
          <svg width="110" height="110" viewBox="0 0 42 42">
            {(() => {
              let off = 0;
              return D.byLine.map(l => {
                const c = LINES[l.line].color;
                const dash = `${l.pct} ${100 - l.pct}`;
                const elem = <circle key={l.line} cx="21" cy="21" r="15.915" fill="transparent" stroke={c} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={-off} />;
                off += l.pct;
                return elem;
              });
            })()}
            <text x="21" y="21" textAnchor="middle" dy="0.35em" fontSize="6" fontWeight="800" fill="var(--label-strong)">47회</text>
          </svg>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {D.byLine.map(l => (
              <div key={l.line} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineBadge line={l.line} size={18} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--label-neutral)' }}>{LINES[l.line].name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums' }}>{l.count}회</span>
                <span style={{ fontSize: 10, color: 'var(--label-alt)', fontWeight: 700, width: 28, textAlign: 'right' }}>{l.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day of week */}
      <SectionHeader title="요일별 지연" />
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, padding: 20, border: '1px solid var(--line-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, gap: 10 }}>
            {D.byDay.map(d => {
              const total = d.delays + d.onTime;
              const delayH = (d.delays / 5) * 100;
              const onH = (d.onTime / 5) * 100;
              return (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: '70%', height: '100%', display: 'flex', flexDirection: 'column-reverse', borderRadius: 6, overflow: 'hidden', background: 'rgba(112,115,124,0.08)' }}>
                    <div style={{ height: `${onH}%`, background: 'var(--blue-500)' }} />
                    <div style={{ height: `${delayH}%`, background: 'var(--red-500)' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-neutral)' }}>{d.day}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--label-alt)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--blue-500)' }} /> 정시
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red-500)' }} /> 지연
            </span>
          </div>
        </div>
      </div>

      <TabBar active="me" />
    </Screen>
  );
}

// ─────────────── MAP (line station list) ───────────────
function MapScreen() {
  const D = window.LM_DATA;
  const LINES = D.LINES;
  const lineIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const [selectedLine, setLine] = useSState('2');
  const ld = D.LINE_STATIONS[selectedLine] || D.LINE_STATIONS['2'];
  const lineColor = LINES[selectedLine].color;
  const lineName = LINES[selectedLine].name;

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon name="chevron-left" size={26} strokeWidth={2} />
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-strong)' }}>노선도</span>
        <Icon name="search" size={20} />
      </div>

      {/* Line picker chips — outline + line color */}
      <div style={{ padding: '14px 20px 8px', display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {lineIds.map(id => {
          const c = LINES[id].color;
          const active = id === selectedLine;
          return (
            <button key={id}
              onClick={() => setLine(id)}
              style={{
                flexShrink: 0, height: 48, minWidth: 84, padding: '0 18px', borderRadius: 9999,
                background: active ? c : 'var(--bg-base)',
                border: `2px solid ${c}`,
                color: active ? '#fff' : c,
                fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
                fontFamily: 'inherit', cursor: 'pointer',
                boxShadow: active ? `0 4px 10px ${c}40` : 'none',
                transition: 'all .15s ease',
              }}>
              {LINES[id].name}
            </button>
          );
        })}
      </div>

      {/* Title */}
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--line-subtle)' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em' }}>
          {lineName} 역 목록
        </div>
        <div style={{ fontSize: 13, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2 }}>
          총 {ld.total}개 역
        </div>
      </div>

      {/* Vertical timeline */}
      <div style={{ padding: '8px 0 24px' }}>
        {ld.stations.map((st, i) => {
          const isTransfer = st.transfers.length > 0;
          const isLast = i === ld.stations.length - 1;
          const isFirst = i === 0;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '64px 1fr 24px',
              alignItems: 'stretch', minHeight: 76,
            }}>
              {/* Rail column */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                {/* Line track */}
                {!isFirst && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: '50%',
                    left: '50%', width: 4, marginLeft: -2,
                    background: lineColor,
                  }} />
                )}
                {!isLast && (
                  <div style={{
                    position: 'absolute', top: '50%', bottom: 0,
                    left: '50%', width: 4, marginLeft: -2,
                    background: lineColor,
                  }} />
                )}
                {/* Node */}
                <div style={{
                  position: 'relative', alignSelf: 'center',
                  width: isTransfer ? 30 : 18,
                  height: isTransfer ? 30 : 18,
                  borderRadius: 9999,
                  background: isTransfer ? 'var(--bg-base)' : lineColor,
                  border: isTransfer ? `3px solid ${lineColor}` : 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1,
                }}>
                  {isTransfer && (
                    <Icon name="arrow-right-left" size={14} color={lineColor} strokeWidth={2.6} />
                  )}
                </div>
              </div>

              {/* Station info */}
              <div style={{ padding: '16px 4px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.01em' }}>
                  {st.ko}
                </div>
                <div style={{ fontSize: 13, color: 'var(--label-alt)', fontWeight: 500, marginTop: 2 }}>
                  {st.en}
                </div>
                {st.transfers.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    {st.transfers.map(t => <LineBadge key={t} line={t} size={20} />)}
                  </div>
                )}
              </div>

              {/* Chevron */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16 }}>
                <Icon name="chevron-right" size={18} color="var(--label-alt)" strokeWidth={2} />
              </div>
            </div>
          );
        })}
      </div>

      <TabBar active="route" />
    </Screen>
  );
}

// ─────────────── ALERTS ───────────────
function AlertsScreen() {
  const D = window.LM_DATA;
  const iconForType = (t) => ({
    arriving: 'train-front', depart: 'clock', delay: 'alert-triangle', community: 'megaphone',
    cert: 'file-text', weekly: 'bar-chart-3'
  }[t] || 'bell');
  const colorForType = (t) => ({
    arriving: 'var(--blue-500)', depart: 'var(--blue-500)', delay: 'var(--red-500)',
    community: 'var(--yellow-500)', cert: 'var(--violet-500)', weekly: 'var(--cyan-500)'
  }[t] || 'var(--label-alt)');

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em' }}>알림</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-500)' }}>모두 읽음</span>
      </div>

      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['전체', '읽지않음 2', '도착', '지연', '제보'].map((c, i) => (
          <span key={c} style={{
            padding: '6px 12px', borderRadius: 9999,
            background: i === 0 ? 'var(--label-strong)' : 'var(--bg-base)',
            color: i === 0 ? '#fff' : 'var(--label-neutral)',
            fontSize: 12, fontWeight: 700,
            border: i === 0 ? 'none' : '1px solid var(--line-subtle)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c}</span>
        ))}
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {D.ALERTS.map(a => (
          <div key={a.id} style={{
            background: a.read ? 'var(--bg-base)' : 'var(--blue-50)',
            borderRadius: 16, padding: 14,
            border: a.read ? '1px solid var(--line-subtle)' : '1px solid rgba(0,102,255,0.20)',
            display: 'flex', gap: 12,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 9999, flexShrink: 0,
              background: 'var(--bg-base)',
              border: '1px solid var(--line-subtle)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={iconForType(a.type)} size={18} color={colorForType(a.type)} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.line && <LineBadge line={a.line} size={18} />}
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>{a.title}</span>
                {!a.read && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--blue-500)', marginLeft: 'auto' }} />}
                <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700, marginLeft: a.read ? 'auto' : 0 }}>{a.time}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--label-neutral)', fontWeight: 500, lineHeight: 1.45 }}>
                {a.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <TabBar active="me" />
    </Screen>
  );
}

// ─────────────── ONBOARDING ───────────────
function OnboardingScreen() {
  return (
    <Screen style={{ background: 'var(--bg-base)' }}>
      <div style={{ padding: '20px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="chevron-left" size={26} color="var(--label-neutral)" />
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= 2 ? 'var(--blue-500)' : 'rgba(112,115,124,0.18)' }} />
          ))}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>건너뛰기</span>
      </div>

      <div style={{ padding: '32px 24px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '0.05em' }}>STEP 2 / 4</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.2 }}>
          평소 출퇴근<br />경로를 알려주세요
        </div>
        <div style={{ fontSize: 14, color: 'var(--label-alt)', fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
          매일 같은 시간에 출퇴근 정보를 알려드릴게요.<br />언제든지 변경할 수 있어요.
        </div>
      </div>

      {/* From / To selector */}
      <div style={{ padding: '8px 24px' }}>
        <div style={{ background: 'var(--bg-subtle-page)', borderRadius: 16, padding: 4 }}>
          {[
            { label: '출발', placeholder: '집 근처 역', value: '홍대입구', dot: 'var(--label-strong)' },
            { label: '도착', placeholder: '회사 근처 역', value: '강남', dot: 'var(--blue-500)' },
          ].map((f, i) => (
            <div key={f.label} style={{
              background: 'var(--bg-base)', borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: i === 0 ? 4 : 0,
              border: '1px solid var(--line-subtle)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: f.dot }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-strong)' }}>{f.value}</div>
              </div>
              <Icon name="chevron-right" size={18} color="var(--label-alt)" />
            </div>
          ))}
        </div>
      </div>

      {/* Time picker */}
      <SectionHeader title="출근 시간" subtitle="평일 기준" style={{ paddingTop: 24 }} />
      <div style={{ padding: '0 24px' }}>
        <div style={{ background: 'var(--bg-subtle-page)', borderRadius: 16, padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '-0.02em', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>08</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginTop: 2 }}>시</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(112,115,124,0.22)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '-0.02em', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>30</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginTop: 2 }}>분 출발</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['07:30', '08:00', '08:30', '09:00', '09:30'].map((t, i) => (
              <span key={t} style={{
                padding: '6px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                background: i === 2 ? 'var(--blue-500)' : 'var(--bg-base)',
                color: i === 2 ? '#fff' : 'var(--label-neutral)',
                border: i === 2 ? 'none' : '1px solid var(--line-normal)',
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Days */}
      <SectionHeader title="출근하는 요일" />
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: 8 }}>
        {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
          <span key={d} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: i < 5 ? 'var(--blue-500)' : 'var(--bg-base)',
            color: i < 5 ? '#fff' : 'var(--label-alt)',
            border: i < 5 ? 'none' : '1px solid var(--line-normal)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800,
          }}>{d}</span>
        ))}
      </div>

      <div style={{ padding: '24px 24px 12px' }}>
        <button style={{ width: '100%', height: 56, borderRadius: 14, border: 'none', background: 'var(--blue-500)', color: '#fff', fontSize: 16, fontWeight: 700 }}>다음</button>
      </div>
    </Screen>
  );
}

// ─────────────── SETTINGS ───────────────
function SettingsScreen() {
  const Section = ({ title, items }) => (
    <>
      <div style={{ padding: '20px 20px 8px', fontSize: 12, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ padding: '0 20px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--line-subtle)', overflow: 'hidden' }}>
          {items.map((it, i) => (
            <div key={it.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i === items.length - 1 ? 'none' : '1px solid rgba(112,115,124,0.10)',
            }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: it.bg || 'rgba(112,115,124,0.10)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={it.icon} size={16} color={it.fg || 'var(--label-neutral)'} strokeWidth={2} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-strong)' }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 600, marginTop: 1 }}>{it.sub}</div>}
              </div>
              {it.value && <span style={{ fontSize: 13, color: 'var(--label-alt)', fontWeight: 600 }}>{it.value}</span>}
              {it.toggle !== undefined ? (
                <span style={{
                  width: 44, height: 26, borderRadius: 9999,
                  background: it.toggle ? 'var(--blue-500)' : 'rgba(112,115,124,0.30)',
                  position: 'relative', flexShrink: 0,
                }}>
                  <span style={{ position: 'absolute', top: 3, left: it.toggle ? 21 : 3, width: 20, height: 20, borderRadius: 9999, background: 'var(--bg-base)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                </span>
              ) : <Icon name="chevron-right" size={16} color="var(--label-alt)" />}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em' }}>설정</div>
      </div>

      {/* Profile card */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, padding: 16, border: '1px solid var(--line-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: 9999, background: 'linear-gradient(135deg, #0066FF, #6FA8FF)', color: '#fff', fontSize: 22, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>지</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--label-strong)' }}>지수</div>
            <div style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2 }}>jisu@livemetro.app · 누적 47회</div>
          </div>
          <Icon name="chevron-right" size={18} color="var(--label-alt)" />
        </div>
      </div>

      <Section title="출퇴근 / 알림" items={[
        { icon: 'train-front', label: '출퇴근 설정', sub: '출퇴근 경로 및 알림 설정' },
        { icon: 'bell', label: '지연 알림', sub: '열차 지연 시 알림 받기' },
        { icon: 'clock', label: '알림 시간대', sub: '출퇴근 시간 설정' },
        { icon: 'volume-2', label: '소리 설정', sub: '알림음 및 진동 설정' },
      ]} />

      <Section title="지연 정보" items={[
        { icon: 'message-square', label: '실시간 제보', sub: '승객들의 실시간 지연 제보' },
        { icon: 'file-check', label: '지연증명서', sub: '지연 이력 및 증명서 발급' },
      ]} />

      <Section title="앱 설정" items={[
        { icon: 'globe', label: '언어', sub: '한국어' },
        { icon: 'moon', label: '테마', sub: '라이트 모드' },
        { icon: 'map-pin', label: '위치 권한', sub: '주변 역 검색을 위해 필요' },
        { icon: 'shield', label: '개인정보', sub: '데이터 사용 및 권한 관리' },
      ]} />

      <Section title="기타" items={[
        { icon: 'help-circle', label: '도움말 · 문의' },
        { icon: 'info', label: 'LiveMetro 정보', value: 'v1.0.0' },
        { icon: 'log-out', label: '로그아웃', fg: 'var(--red-500)' },
      ]} />

      <div style={{ padding: '24px 20px 32px', textAlign: 'center', fontSize: 11, color: 'var(--label-alt)', fontWeight: 600 }}>
        LiveMetro 1.0.0
      </div>

      <TabBar active="me" />
    </Screen>
  );
}

window.RoutesScreen = RoutesScreen;
window.DelayFeedScreen = DelayFeedScreen;
window.StatsScreen = StatsScreen;
window.MapScreen = MapScreen;
window.AlertsScreen = AlertsScreen;
window.OnboardingScreen = OnboardingScreen;
window.SettingsScreen = SettingsScreen;
