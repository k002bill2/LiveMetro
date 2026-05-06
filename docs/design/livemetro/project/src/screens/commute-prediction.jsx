// LiveMetro — Hero screen: ML 출퇴근 예측
// Globals: window.CommutePredictionScreen

const { useState: useCPState, useEffect: useCPEffect } = React;

function CommutePredictionScreen({ density = 'balanced', congStyle = 'bar' }) {
  const D = window.LM_DATA.COMMUTE_PREDICTION;
  const LINES = window.LM_DATA.LINES;
  const compact = density === 'dense';

  // Animated number
  const [displayMin, setDisplayMin] = useCPState(0);
  useCPEffect(() => {
    let raf, start;
    const target = D.predicted_min;
    const dur = 900;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayMin(Math.round(target * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const line2 = LINES['2'];

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      {/* App nav */}
      <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--label-alt)' }}>
          <Icon name="chevron-left" size={26} strokeWidth={2} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>홈</span>
        </div>
        <Icon name="settings-2" size={22} strokeWidth={1.8} />
      </div>

      {/* Hero header */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 9999,
            background: 'rgba(0,102,255,0.10)', color: 'var(--blue-700)',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
          }}>
            <Icon name="sparkles" size={12} strokeWidth={2.2} />
            ML 예측
          </span>
          <span style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 600 }}>오늘 오전 8:32</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--label-strong)' }}>
          오늘 출근, 약
        </div>
      </div>

      {/* Big number card */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: 'var(--bg-base)', borderRadius: 24, padding: '24px 24px 20px',
          border: '1px solid rgba(112,115,124,0.12)',
          boxShadow: '0 1px 2px rgba(23,23,23,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif',
              fontSize: 96, fontWeight: 800, lineHeight: 0.92,
              letterSpacing: '-0.05em', color: 'var(--label-strong)',
              fontVariantNumeric: 'tabular-nums',
            }}>{displayMin}</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--label-neutral)', letterSpacing: '-0.02em' }}>분</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Pill tone="pos" size="md">
                <Icon name="trending-down" size={12} strokeWidth={2.4} />
                <span>3분 빨라요</span>
              </Pill>
            </span>
          </div>

          {/* Range bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginBottom: 6 }}>
              <span>최단 {D.range[0]}분</span>
              <span style={{ color: 'var(--blue-500)' }}>예상 {D.predicted_min}분</span>
              <span>최장 {D.range[1]}분</span>
            </div>
            <div style={{ position: 'relative', height: 8, background: 'rgba(112,115,124,0.12)', borderRadius: 999 }}>
              {/* range fill */}
              <div style={{
                position: 'absolute',
                left: `${((D.range[0] - 20) / 20) * 100}%`,
                width: `${((D.range[1] - D.range[0]) / 20) * 100}%`,
                top: 0, bottom: 0,
                background: 'linear-gradient(90deg, rgba(0,102,255,0.25), rgba(0,102,255,0.55), rgba(0,102,255,0.25))',
                borderRadius: 999,
              }} />
              {/* predicted marker */}
              <div style={{
                position: 'absolute',
                left: `${((D.predicted_min - 20) / 20) * 100}%`,
                top: -3, width: 14, height: 14,
                background: 'var(--bg-base)', border: '3px solid var(--blue-500)',
                borderRadius: 9999, transform: 'translateX(-50%)',
                boxShadow: '0 2px 4px rgba(0,102,255,0.3)',
              }} />
            </div>
          </div>

          {/* Confidence */}
          <div style={{
            marginTop: 14, paddingTop: 14,
            borderTop: '1px dashed rgba(112,115,124,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield-check" size={16} strokeWidth={2} color="var(--blue-500)" />
              <span style={{ fontSize: 13, color: 'var(--label-neutral)', fontWeight: 600 }}>예측 신뢰도</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums' }}>87%</span>
              <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 600 }}>· 지난 30일 학습</span>
            </div>
          </div>
        </div>
      </div>

      {/* Route summary */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, color: 'var(--label-strong)' }}>
          <span>{D.origin}</span>
          <Icon name="arrow-right" size={16} strokeWidth={2.4} color="var(--label-alt)" />
          <span>{D.destination}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--label-alt)', fontWeight: 600 }}>경로 보기</span>
        </div>
      </div>

      {/* Segment breakdown */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: 'var(--bg-base)', borderRadius: 16, padding: 4,
          border: '1px solid var(--line-subtle)',
        }}>
          {D.segments.map((s, i) => {
            const isLast = i === D.segments.length - 1;
            const lineColor = s.line ? LINES[s.line].color : 'var(--label-alt)';
            const segIcon = s.type === 'walk' ? 'footprints' : s.type === 'wait' ? 'clock' : 'train-front';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: compact ? '10px 12px' : '12px 12px',
                borderBottom: isLast ? 'none' : '1px solid rgba(112,115,124,0.10)',
              }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 9999,
                  background: s.type === 'ride' ? lineColor : 'rgba(112,115,124,0.10)',
                  color: s.type === 'ride' ? '#fff' : 'var(--label-neutral)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={segIcon} size={16} strokeWidth={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s.label}
                    {s.line && <LineBadge line={s.line} size={18} />}
                    {s.congestion && <CongestionDots level={s.congestion} />}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--label-alt)', marginTop: 2, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.desc}
                  </div>
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--label-strong)',
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>{s.min}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginLeft: 1 }}>분</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly congestion forecast */}
      <SectionHeader title="시간대별 혼잡도 예측" subtitle="2호선 잠실 방면" style={{ paddingTop: 24 }} />
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: 'var(--bg-base)', borderRadius: 16, padding: '24px 16px 16px',
          border: '1px solid var(--line-subtle)',
          position: 'relative',
        }}>
          {/* Y-axis legend */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 10, fontWeight: 700, color: 'var(--label-alt)' }}>
            <span style={{ display: 'inline-flex', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00BF40' }} /> 여유
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FFB400' }} /> 보통
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF7A1A' }} /> 혼잡
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF4242' }} /> 매우혼잡
              </span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, gap: 6, position: 'relative' }}>
            {/* Background gridlines */}
            {[25, 50, 75].map(p => (
              <div key={p} style={{
                position: 'absolute', left: 0, right: 0, bottom: `${p}%`,
                height: 1, borderTop: '1px dashed rgba(112,115,124,0.16)',
                pointerEvents: 'none',
              }} />
            ))}
            {/* "지금" highlight column */}
            {(() => {
              const nowIdx = D.hourly.findIndex(h => h.isNow);
              const left = (nowIdx / D.hourly.length) * 100;
              const w = (1 / D.hourly.length) * 100;
              return (
                <div style={{
                  position: 'absolute', top: -8, bottom: -8,
                  left: `${left}%`, width: `${w}%`,
                  background: 'rgba(0,102,255,0.06)',
                  borderRadius: 8, pointerEvents: 'none',
                }} />
              );
            })()}

            {D.hourly.map((h, i) => {
              const tone = congFromPct(h.cong);
              const c = window.CONG_TONE[tone].color;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: h.isNow ? c : 'var(--label-alt)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{h.cong}%</span>
                  <div style={{
                    width: '100%', height: `${h.cong * 0.85}%`, minHeight: 10,
                    background: h.isNow
                      ? `linear-gradient(180deg, ${c} 0%, ${c}DD 100%)`
                      : `${c}66`,
                    borderRadius: 6,
                    border: h.isNow ? `2px solid ${c}` : `1px solid ${c}33`,
                    boxShadow: h.isNow ? `0 4px 10px ${c}40` : 'none',
                    position: 'relative',
                  }}>
                    {h.isNow && (
                      <div style={{
                        position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--label-strong)', color: '#fff',
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}>
                        지금
                        <span style={{
                          position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                          width: 6, height: 6, background: 'var(--label-strong)',
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {D.hourly.map((h, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700,
                color: h.isNow ? 'var(--label-strong)' : 'var(--label-alt)',
                fontVariantNumeric: 'tabular-nums',
              }}>{h.time}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Factors */}
      <SectionHeader title="예측에 반영된 요소" style={{ paddingTop: 24 }} />
      <div style={{ padding: '0 20px' }}>
        <div style={{
          background: 'var(--bg-base)', borderRadius: 16,
          border: '1px solid var(--line-subtle)', overflow: 'hidden',
        }}>
          {D.factors.map((f, i) => {
            const tone = f.tone === 'pos' ? '#00BF40' : f.tone === 'neg' ? '#FF4242' : 'var(--label-alt)';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i === D.factors.length - 1 ? 'none' : '1px solid rgba(112,115,124,0.10)',
              }}>
                <Icon name={f.icon} size={18} strokeWidth={1.8} color={tone} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-neutral)', flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tone }}>{f.impact}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly comparison */}
      <SectionHeader title="이번 주 추이" subtitle="평균 대비 오늘 -3분" style={{ paddingTop: 24 }} />
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          background: 'var(--bg-base)', borderRadius: 16, padding: 20,
          border: '1px solid var(--line-subtle)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, height: 140,
        }}>
          {D.weekly.map((w, i) => {
            const max = 36;
            const h = (w.min / max) * 90;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: w.isToday ? 'var(--blue-500)' : 'var(--label-alt)',
                }}>{w.min}분</div>
                <div style={{
                  width: '100%', height: `${h}%`, minHeight: 8,
                  background: w.isToday ? 'var(--blue-500)' : 'rgba(112,115,124,0.18)',
                  borderRadius: 8,
                }} />
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: w.isToday ? 'var(--blue-500)' : 'var(--label-neutral)',
                }}>{w.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 16px' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 14, border: 'none',
          background: 'var(--blue-500)', color: '#fff',
          fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer',
        }}>
          <Icon name="bell" size={18} strokeWidth={2.2} />
          출발 시간에 알려드릴게요 (8:32)
        </button>
      </div>
    </Screen>
  );
}

window.CommutePredictionScreen = CommutePredictionScreen;
