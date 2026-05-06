// LiveMetro — Home, Favorites, Station Detail screens
// Globals: window.{HomeScreen, FavoritesScreen, StationDetailScreen}

const { useState: useHState, useEffect: useHEffect } = React;

// ─────────────── HOME ───────────────
function HomeScreen({ density = 'balanced', congStyle = 'bar' }) {
  const D = window.LM_DATA;
  const compact = density === 'dense';

  // live arrivals - simulate countdown
  const [tick, setTick] = useHState(0);
  useHEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      {/* Top bar */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>2026.05.03 (수) · 오전 8:32</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em', marginTop: 2 }}>
            안녕하세요, 지수님
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 40, height: 40, borderRadius: 9999, background: 'var(--bg-base)', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-subtle)' }}>
            <Icon name="bell" size={20} />
            <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 999, background: 'var(--red-500)', border: '2px solid #fff' }} />
          </span>
        </div>
      </div>

      {/* ML predict hero card */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0066FF 0%, #0044BB 100%)',
          borderRadius: 24, padding: '20px 22px', color: '#fff',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,68,187,0.20)',
        }}>
          {/* deco */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -60, right: 20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', opacity: 0.85 }}>
              <Icon name="sparkles" size={12} strokeWidth={2.4} color="#fff" />
              ML 출퇴근 예측
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, opacity: 0.9 }}>
              홍대입구 → 강남
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>28</span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>분</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 8px', background: 'rgba(255,255,255,0.18)', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="trending-down" size={11} strokeWidth={2.4} color="#fff" />
                평소보다 -3분
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8, fontWeight: 600 }}>
              지금 출발하면 오전 9:00 도착 · 신뢰도 87%
            </div>
          </div>
        </div>
      </div>

      {/* Commute route card — visualized legs */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          background: 'var(--bg-base)', border: '1px solid var(--line-subtle)',
          borderRadius: 18, padding: '14px 16px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em' }}>
              <Icon name="route" size={12} strokeWidth={2.2} color="var(--label-alt)" />
              오늘의 출근 경로
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--blue-500)' }}>
              경로 변경 <Icon name="chevron-right" size={12} strokeWidth={2.4} color="var(--blue-500)" />
            </span>
          </div>

          {/* Route timeline — horizontal */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Origin */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9999,
                background: 'rgba(0,102,255,0.10)', border: '2px solid var(--blue-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="home" size={16} strokeWidth={2.2} color="var(--blue-500)" />
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 800, color: 'var(--label-strong)' }}>홍대입구</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-alt)', marginTop: 1 }}>08:32</div>
            </div>

            {/* Leg 1: walk */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, height: 2, borderTop: '2px dotted var(--label-alt)', opacity: 0.4 }} />
                <Icon name="footprints" size={13} strokeWidth={2} color="var(--label-alt)" />
                <div style={{ flex: 1, height: 2, borderTop: '2px dotted var(--label-alt)', opacity: 0.4 }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 9.5, fontWeight: 700, color: 'var(--label-alt)' }}>도보 4분</div>
            </div>

            {/* Mid: 2호선 ride */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <LineBadge line="2" size={36} />
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 800, color: 'var(--label-strong)' }}>2호선</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--label-alt)', marginTop: 1 }}>직행 18분</div>
            </div>

            {/* Leg 2: ride line */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, height: 3, background: '#00A84D', borderRadius: 2 }} />
                <Icon name="train-front" size={13} strokeWidth={2} color="#00A84D" />
                <div style={{ flex: 1, height: 3, background: '#00A84D', borderRadius: 2 }} />
              </div>
              <div style={{ marginTop: 4, fontSize: 9.5, fontWeight: 700, color: 'var(--green-700)' }}>8개역 · 잠실 방면</div>
            </div>

            {/* Destination */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9999,
                background: 'var(--blue-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="building-2" size={16} strokeWidth={2.2} color="#fff" />
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 800, color: 'var(--label-strong)' }}>강남</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue-500)', marginTop: 1 }}>09:00</div>
            </div>
          </div>

          {/* Route facts row */}
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line-subtle)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>0회</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)', marginTop: 1 }}>환승</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line-subtle)', borderRight: '1px solid var(--line-subtle)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>8개역</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)', marginTop: 1 }}>이동</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>1,450<span style={{ fontSize: 10, marginLeft: 1 }}>원</span></div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)', marginTop: 1 }}>요금</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { icon: 'search', label: '경로검색' },
          { icon: 'map', label: '노선도' },
          { icon: 'megaphone', label: '제보' },
          { icon: 'file-text', label: '증명서' },
        ].map(q => (
          <div key={q.label} style={{
            background: 'var(--bg-base)', border: '1px solid var(--line-subtle)',
            borderRadius: 14, padding: '14px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <Icon name={q.icon} size={20} strokeWidth={1.8} color="var(--label-neutral)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-neutral)' }}>{q.label}</span>
          </div>
        ))}
      </div>

      {/* Nearby stations - GPS based */}
      <SectionHeader title="주변 역" subtitle="GPS 기반 · 도보 거리순" style={{ paddingTop: 18 }} action={
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-700)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(0,168,77,0.10)', borderRadius: 9999 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green-500)' }} />
          홍대 인근
        </span>
      } />
      <div style={{ padding: '0 0 4px 20px', display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <style>{`.lm-nearby-row::-webkit-scrollbar{display:none}`}</style>
        {D.NEARBY_STATIONS.map((n, idx) => {
          const firstArr = n.arrivals[0];
          const tone = window.CONG_TONE[firstArr.cong];
          return (
            <div key={n.stationId} className="lm-nearby-row" style={{
              flex: '0 0 220px',
              background: 'var(--bg-base)', borderRadius: 16,
              border: '1px solid var(--line-subtle)',
              padding: '14px 14px 12px',
              marginRight: idx === D.NEARBY_STATIONS.length - 1 ? 20 : 0,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* distance badge */}
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)' }}>
                <Icon name="map-pin" size={11} strokeWidth={2.2} color="var(--label-alt)" />
                {n.distance < 1000 ? `${n.distance}m` : `${(n.distance / 1000).toFixed(1)}km`}
              </div>

              {/* line badges */}
              <div style={{ display: 'flex', gap: 4 }}>
                {n.lines.slice(0, 3).map(l => <LineBadge key={l} line={l} size={20} />)}
              </div>

              {/* station name */}
              <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.01em' }}>
                {n.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="footprints" size={11} strokeWidth={2} color="var(--label-alt)" />
                도보 {n.walkMin}분 · {n.exit}
              </div>

              {/* divider */}
              <div style={{ height: 1, background: 'var(--line-subtle)', margin: '10px 0 8px' }} />

              {/* next arrival */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineBadge line={firstArr.line} size={18} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--label-neutral)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstArr.dest}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue-500)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{firstArr.min}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-500)' }}>분</span>
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: tone.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: tone.color }} />
                {tone.label}
                {n.arrivals.length > 1 && (
                  <span style={{ marginLeft: 6, color: 'var(--label-alt)', fontWeight: 600 }}>+{n.arrivals.length - 1}대 더</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Favorites - live arrivals */}
      <SectionHeader title="즐겨찾는 역" subtitle="실시간 도착" action={
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-alt)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          전체 보기 <Icon name="chevron-right" size={14} strokeWidth={2} />
        </span>
      } />
      <div style={{ padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {D.FAVORITES.slice(0, 3).map((f, i) => {
          const st = D.STATIONS.find(s => s.id === f.stationId);
          const sec = (60 - (tick % 60));
          const showSec = i === 0;
          const tone = window.CONG_TONE[f.cong];
          return (
            <div key={f.stationId} style={{
              background: 'var(--bg-base)', borderRadius: 16, padding: '14px 16px',
              border: '1px solid var(--line-subtle)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 56 }}>
                {f.lines.slice(0, 2).map(l => <LineBadge key={l} line={l} size={22} />)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.nickname && <Pill tone="primary" size="sm">{f.nickname}</Pill>}
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--label-strong)' }}>{st.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--label-alt)', marginTop: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f.dest} 방면
                  <span>·</span>
                  <span style={{ color: tone.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.color }} />
                    {tone.label}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-500)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{f.nextMin}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-500)' }}>분</span>
                  {showSec && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-500)', fontVariantNumeric: 'tabular-nums', marginLeft: 2 }}>{String(sec).padStart(2, '0')}초</span>}
                </div>
                {showSec && <div style={{ fontSize: 10, color: 'var(--green-700)', fontWeight: 700, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--green-500)' }} />
                  곧 도착
                </div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Community delays */}
      <SectionHeader title="실시간 제보" subtitle="근처 노선" style={{ paddingTop: 16 }} />
      <div style={{ padding: '0 20px 16px' }}>
        <Card padding={14}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <LineBadge line="2" size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>강남역 신호장애</span>
                <Pill tone="warn" size="sm">검증됨</Pill>
              </div>
              <div style={{ fontSize: 13, color: 'var(--label-neutral)', marginTop: 4, fontWeight: 500 }}>
                교대~강남 구간 약 5분 정차 중
              </div>
              <div style={{ fontSize: 11, color: 'var(--label-alt)', marginTop: 6, fontWeight: 600 }}>
                12분 전 · 47명 확인
              </div>
            </div>
          </div>
        </Card>
      </div>

      <TabBar active="home" />
    </Screen>
  );
}

// ─────────────── FAVORITES ───────────────
function FavoritesScreen({ density = 'balanced' }) {
  const D = window.LM_DATA;
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.02em' }}>즐겨찾기</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--bg-base)', border: '1px solid var(--line-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up-down" size={16} />
          </span>
          <span style={{ width: 36, height: 36, borderRadius: 9999, background: 'var(--blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} />
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px 8px' }}>
        <div style={{
          height: 44, borderRadius: 12, background: 'rgba(112,115,124,0.10)',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
        }}>
          <Icon name="search" size={18} color="var(--label-alt)" />
          <input placeholder="역 이름으로 검색" readOnly style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: 'var(--label-neutral)' }} />
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['전체', '2호선', '신분당', '8호선', '4호선'].map((c, i) => (
          <span key={c} style={{
            padding: '6px 12px', borderRadius: 9999,
            background: i === 0 ? 'var(--label-strong)' : 'var(--bg-base)',
            color: i === 0 ? '#fff' : 'var(--label-neutral)',
            fontSize: 13, fontWeight: 700,
            border: i === 0 ? 'none' : '1px solid var(--line-subtle)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c}</span>
        ))}
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {D.FAVORITES.map((f, i) => {
          const st = D.STATIONS.find(s => s.id === f.stationId);
          const tone = window.CONG_TONE[f.cong];
          return (
            <div key={f.stationId} style={{
              background: 'var(--bg-base)', borderRadius: 16, padding: '14px 8px 14px 16px',
              border: '1px solid var(--line-subtle)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* drag handle */}
              <Icon name="grip-vertical" size={16} color="var(--label-alt)" />
              <div style={{ display: 'flex', gap: 4 }}>
                {f.lines.map(l => <LineBadge key={l} line={l} size={22} />)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.nickname && <Pill tone="primary" size="sm">{f.nickname}</Pill>}
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--label-strong)' }}>{st.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--label-alt)', marginTop: 3, fontWeight: 600 }}>
                  {f.dest} 방면 · <span style={{ color: tone.color }}>{tone.label}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', paddingRight: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue-500)', fontVariantNumeric: 'tabular-nums' }}>{f.nextMin}<span style={{ fontSize: 11, marginLeft: 1 }}>분</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <TabBar active="fav" />
    </Screen>
  );
}

// ─────────────── STATION DETAIL ───────────────
function StationDetailScreen({ density = 'balanced', congStyle = 'bar' }) {
  const D = window.LM_DATA;
  const arrivals = D.ARRIVALS_GANGNAM;
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      {/* Top with back + favorite */}
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--label-neutral)' }}>
          <Icon name="chevron-left" size={26} strokeWidth={2} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Icon name="share-2" size={20} />
          <Icon name="star" size={20} color="var(--blue-500)" strokeWidth={2.2} style={{ marginLeft: 6 }} />
        </div>
      </div>

      {/* Station hero */}
      <div style={{ padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LineBadge line="2" size={32} />
          <LineBadge line="sb" size={32} />
        </div>
        <div style={{ marginTop: 12, fontSize: 32, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.025em' }}>
          강남
        </div>
        <div style={{ fontSize: 13, color: 'var(--label-alt)', marginTop: 2, fontWeight: 600 }}>
          Gangnam · 222 · 신분당 D07
        </div>
      </div>

      {/* Direction tabs */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ background: 'rgba(112,115,124,0.10)', borderRadius: 12, padding: 4, display: 'flex' }}>
          {['상행 (서울대입구)', '하행 (잠실)'].map((t, i) => (
            <span key={t} style={{
              flex: 1, textAlign: 'center', padding: '8px 10px', borderRadius: 9,
              background: i === 1 ? 'var(--bg-base)' : 'transparent',
              fontSize: 13, fontWeight: 700,
              color: i === 1 ? 'var(--label-strong)' : 'var(--label-alt)',
              boxShadow: i === 1 ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Live arrivals */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {arrivals.map((a, i) => {
          const isFirst = i === 0;
          return (
            <div key={i} style={{
              background: 'var(--bg-base)', borderRadius: 16, padding: 16,
              border: isFirst ? '2px solid var(--blue-500)' : '1px solid var(--line-subtle)',
              boxShadow: isFirst ? '0 4px 12px rgba(0,102,255,0.12)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LineBadge line={a.line} size={26} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label-strong)' }}>{a.dest}</div>
                  <div style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2 }}>
                    {a.cars}량 편성 · 다음역 교대
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: isFirst ? 'var(--blue-500)' : 'var(--label-strong)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{a.minutes}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isFirst ? 'var(--blue-500)' : 'var(--label-neutral)' }}>분</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)', fontVariantNumeric: 'tabular-nums', marginLeft: 2 }}>{String(a.seconds).padStart(2, '0')}초</span>
                  </div>
                  {isFirst && <Pill tone="primary" size="sm" style={{ marginTop: 4 }}>곧 도착</Pill>}
                </div>
              </div>

              {/* car-by-car congestion */}
              {a.congestion && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed rgba(112,115,124,0.20)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)' }}>칸별 혼잡도</span>
                    <span style={{ fontSize: 10, color: 'var(--label-alt)', fontWeight: 600 }}>← 전 / 후 →</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                    {a.congestion.map((c, j) => {
                      const tone = window.congFromPct(c);
                      const color = window.CONG_TONE[tone].color;
                      return (
                        <div key={j} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ width: '100%', height: 28, background: 'rgba(112,115,124,0.08)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${c}%`, background: color }} />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--label-alt)' }}>{j + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Exit info */}
      <SectionHeader title="출구 안내" style={{ paddingTop: 24 }} />
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, padding: 16, border: '1px solid var(--line-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { n: '1', d: '강남역사거리, GFC' },
            { n: '6', d: '뉴욕제과, 미금사거리' },
            { n: '10', d: '강남대로, 신논현' },
            { n: '11', d: '강남파이낸스센터' },
          ].map(e => (
            <div key={e.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-50)', color: 'var(--blue-700)', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{e.n}</span>
              <span style={{ fontSize: 12, color: 'var(--label-neutral)', fontWeight: 600 }}>{e.d}</span>
            </div>
          ))}
        </div>
      </div>

      <TabBar active="home" />
    </Screen>
  );
}

window.HomeScreen = HomeScreen;
window.FavoritesScreen = FavoritesScreen;
window.StationDetailScreen = StationDetailScreen;
