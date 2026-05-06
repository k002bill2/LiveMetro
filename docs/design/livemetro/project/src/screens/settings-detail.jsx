// LiveMetro — Settings DETAIL pages (drill-in from main Settings list)
// Globals: window.{SettingsCommuteScreen, SettingsAlertsScreen, SettingsAlertTimeScreen, SettingsSoundScreen, SettingsThemeScreen}

const { useState: useSetState } = React;

// ─────────────── Shared chrome ───────────────
function DetailHeader({ title, right }) {
  return (
    <div style={{
      padding: '8px 16px 8px 12px', display: 'flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-subtle-page)',
      position: 'sticky', top: 0, zIndex: 5,
    }}>
      <span style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevron-left" size={26} strokeWidth={2} color="var(--label-strong)" />
      </span>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--label-strong)', flex: 1, textAlign: 'center', letterSpacing: '-0.01em' }}>{title}</span>
      <span style={{ width: 36, minWidth: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, fontWeight: 700, color: 'var(--blue-500)' }}>
        {right || ''}
      </span>
    </div>
  );
}

function GroupLabel({ children, hint }) {
  return (
    <div style={{
      padding: '20px 24px 8px',
      fontSize: 12, fontWeight: 800, color: 'var(--label-alt)',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    }}>
      <span>{children}</span>
      {hint && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
    </div>
  );
}

function GroupCard({ children, footer }) {
  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--line-subtle)', overflow: 'hidden' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '8px 4px 0', fontSize: 11.5, color: 'var(--label-alt)', fontWeight: 500, lineHeight: 1.45 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <span onClick={() => onChange && onChange(!on)} style={{
      width: 44, height: 26, borderRadius: 9999,
      background: on ? 'var(--blue-500)' : 'rgba(112,115,124,0.30)',
      position: 'relative', flexShrink: 0, cursor: 'pointer',
      transition: 'background .15s ease',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: 9999, background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left .15s cubic-bezier(0.2,0,0.2,1)',
      }} />
    </span>
  );
}

function Row({ icon, iconBg, iconFg, label, sub, value, right, divider = true, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      borderBottom: last || !divider ? 'none' : '1px solid rgba(112,115,124,0.10)',
    }}>
      {icon && (
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          background: iconBg || 'rgba(112,115,124,0.10)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={icon} size={16} color={iconFg || 'var(--label-neutral)'} strokeWidth={2} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-strong)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--label-alt)', fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {value && <span style={{ fontSize: 13, color: 'var(--label-alt)', fontWeight: 600 }}>{value}</span>}
      {right}
    </div>
  );
}

// ─────────────── Route + transfer station picker ───────────────
function RouteWithTransfer({ from, fromDot, to, toDot, transfer, onEdit, editing, options, selected, onSelect }) {
  const D = window.LM_DATA;
  const LINES = D.LINES;
  return (
    <>
      <div style={{ background: 'var(--bg-subtle-page)', borderRadius: 12, padding: '12px 14px' }}>
        {/* 출발 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: fromDot }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-strong)', flex: 1 }}>{from}</span>
          <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700 }}>출발</span>
        </div>

        {/* 환승 노드 — 다이아몬드 */}
        {transfer && transfer.transfers > 0 ? (
          <>
            <div style={{ height: 8, marginLeft: 3, borderLeft: '2px dotted rgba(112,115,124,0.30)' }} />
            <div onClick={onEdit} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '4px 0',
            }}>
              <span style={{
                width: 11, height: 11, marginLeft: -2,
                background: 'var(--bg-base)', border: '2px solid var(--label-alt)',
                transform: 'rotate(45deg)',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-strong)', flex: 1, marginLeft: 2 }}>
                {transfer.name} <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 600 }}>· 환승</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--blue-500)' }}>
                {editing ? '닫기' : '변경'}
                <Icon name={editing ? 'chevron-up' : 'chevron-down'} size={12} color="var(--blue-500)" strokeWidth={2.4} />
              </span>
            </div>
            <div style={{ height: 8, marginLeft: 3, borderLeft: '2px dotted rgba(112,115,124,0.30)' }} />
          </>
        ) : (
          // 환승 없음 — "직행" 표시 + 변경 가능
          <>
            <div style={{ height: 8, marginLeft: 3, borderLeft: '2px dotted rgba(112,115,124,0.30)' }} />
            <div onClick={onEdit} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0',
            }}>
              <span style={{ width: 7, height: 7, marginLeft: 0, borderRadius: 999, background: 'rgba(0,191,64,0.65)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-neutral)', flex: 1 }}>
                직행 · 환승 없음
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--blue-500)' }}>
                {editing ? '닫기' : '환승 추가'}
                <Icon name={editing ? 'chevron-up' : 'chevron-down'} size={12} color="var(--blue-500)" strokeWidth={2.4} />
              </span>
            </div>
            <div style={{ height: 8, marginLeft: 3, borderLeft: '2px dotted rgba(112,115,124,0.30)' }} />
          </>
        )}

        {/* 도착 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: toDot }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-strong)', flex: 1 }}>{to}</span>
          <span style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 700 }}>도착</span>
        </div>
      </div>

      {/* 환승역 옵션 패널 */}
      {editing && (
        <div style={{
          marginTop: 8, background: 'var(--bg-base)', border: '1px solid var(--line-subtle)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            background: 'rgba(0,102,255,0.04)',
            borderBottom: '1px solid var(--line-subtle)',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11.5, fontWeight: 700, color: 'var(--label-neutral)',
          }}>
            <Icon name="sparkles" size={12} color="var(--blue-500)" strokeWidth={2.4} />
            <span>{from} → {to} 추천 경로</span>
          </div>
          {options.map((opt, i) => {
            const on = selected === opt.id;
            return (
              <div key={opt.id} onClick={() => onSelect(opt.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderBottom: i === options.length - 1 ? 'none' : '1px solid rgba(112,115,124,0.10)',
                cursor: 'pointer',
                background: on ? 'rgba(0,102,255,0.06)' : 'transparent',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
                  border: on ? '6px solid var(--blue-500)' : '2px solid rgba(112,115,124,0.30)',
                  background: '#fff',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)' }}>
                      {opt.transfers === 0 ? '직행' : opt.name}
                    </span>
                    {opt.recommend && <Pill tone="primary" size="sm">추천</Pill>}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label-alt)', marginTop: 2 }}>
                    {opt.reason}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--label-strong)', fontVariantNumeric: 'tabular-nums' }}>
                    {opt.mins}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-alt)' }}>분</span>
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)', marginTop: 1 }}>
                    {opt.transfers === 0 ? '환승 0' : `환승 ${opt.transfers}회`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─────────────── 1) 출퇴근 설정 (Commute setup detail) ───────────────
function SettingsCommuteScreen() {
  const [enabled, setEnabled] = useSetState(true);
  const [returnEnabled, setReturnEnabled] = useSetState(true);
  const [smart, setSmart] = useSetState(true);
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const [active, setActive] = useSetState([true, true, true, true, true, false, false]);
  // 환승역: '자동'(시스템 추천) | '직접 지정' — 출근/퇴근 각각
  const [outTransfer, setOutTransfer] = useSetState('hapjeong'); // 합정 (2호선 직결)
  const [inTransfer, setInTransfer] = useSetState('hapjeong');
  // 후보 환승역 — 홍대입구 ↔ 강남
  const transferOptions = [
    { id: 'hapjeong',  name: '합정',     fromLine: '2', toLine: '2', mins: 32, transfers: 0, recommend: true,  reason: '환승 없음 · 가장 빠름' },
    { id: 'sindorim',  name: '신도림',   fromLine: '2', toLine: '2', mins: 38, transfers: 1, recommend: false, reason: '내선 ↔ 외선 환승' },
    { id: 'sadang',    name: '사당',     fromLine: '2', toLine: '4', mins: 36, transfers: 1, recommend: false, reason: '4호선 환승' },
    { id: 'gyodae',    name: '교대',     fromLine: '2', toLine: '3', mins: 39, transfers: 1, recommend: false, reason: '3호선 환승' },
  ];
  const [editing, setEditing] = useSetState(null); // 'out' | 'in' | null

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <DetailHeader title="출퇴근 설정" right="저장" />

      {/* Hero summary card — current commute */}
      <div style={{ padding: '4px 20px 8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0066FF 0%, #2C7BFF 100%)',
          borderRadius: 20, padding: '20px 20px 18px', color: '#fff',
          boxShadow: '0 8px 24px rgba(0,102,255,0.20)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85 }}>
            <Icon name="train-front" size={14} color="#fff" strokeWidth={2.4} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>오늘 출근 예측</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.025em', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>32</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>분</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, opacity: 0.9, padding: '4px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.18)' }}>±3분</span>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
            <span>홍대입구</span>
            <Icon name="arrow-right" size={14} color="#fff" />
            <span>강남</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, opacity: 0.85, fontWeight: 600 }}>
            평일 08:30 출발 · 2호선 직행 · 환승 0회
          </div>
        </div>
      </div>

      {/* 1. Master switch */}
      <GroupLabel>출퇴근 알림</GroupLabel>
      <GroupCard>
        <Row
          icon="bell-ring" iconBg="rgba(0,102,255,0.12)" iconFg="var(--blue-500)"
          label="출퇴근 알림 사용"
          sub="설정한 시간에 출발 정보를 알려드려요"
          right={<Toggle on={enabled} onChange={setEnabled} />}
          divider={false} last
        />
      </GroupCard>

      {/* 2. Routes — 출근 / 퇴근 */}
      <GroupLabel>경로</GroupLabel>
      <GroupCard>
        {/* 출근 */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(112,115,124,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Pill tone="primary" size="sm">출근</Pill>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-strong)' }}>평일 매일</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--blue-500)' }}>편집</span>
          </div>
          <RouteWithTransfer
            from="홍대입구" fromDot="var(--label-strong)"
            to="강남" toDot="var(--blue-500)"
            transfer={transferOptions.find(t => t.id === outTransfer)}
            onEdit={() => setEditing(editing === 'out' ? null : 'out')}
            editing={editing === 'out'}
            options={transferOptions}
            selected={outTransfer}
            onSelect={(id) => { setOutTransfer(id); setEditing(null); }}
          />
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={13} color="var(--label-alt)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-neutral)' }}>08:30 출발</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--label-alt)', fontWeight: 600 }}>· 도착 ~09:02</span>
          </div>
        </div>

        {/* 퇴근 */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Pill tone="neutral" size="sm">퇴근</Pill>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-strong)' }}>평일 매일</span>
            <Toggle on={returnEnabled} onChange={setReturnEnabled} />
          </div>
          <div style={{ opacity: returnEnabled ? 1 : 0.45 }}>
            <RouteWithTransfer
              from="강남" fromDot="var(--blue-500)"
              to="홍대입구" toDot="var(--label-strong)"
              transfer={transferOptions.find(t => t.id === inTransfer)}
              onEdit={() => setEditing(editing === 'in' ? null : 'in')}
              editing={editing === 'in'}
              options={transferOptions}
              selected={inTransfer}
              onSelect={(id) => { setInTransfer(id); setEditing(null); }}
            />
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={13} color="var(--label-alt)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-neutral)' }}>18:30 출발</span>
          </div>
        </div>
      </GroupCard>

      {/* 3. Days */}
      <GroupLabel>출근하는 요일</GroupLabel>
      <GroupCard>
        <div style={{ padding: '16px 14px', display: 'flex', gap: 6 }}>
          {days.map((d, i) => (
            <span key={d}
              onClick={() => { const n = [...active]; n[i] = !n[i]; setActive(n); }}
              style={{
                flex: 1, height: 44, borderRadius: 12,
                background: active[i] ? 'var(--blue-500)' : 'var(--bg-base)',
                color: active[i] ? '#fff' : 'var(--label-alt)',
                border: active[i] ? 'none' : '1px solid rgba(112,115,124,0.22)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}>{d}</span>
          ))}
        </div>
      </GroupCard>

      {/* 4. Smart features */}
      <GroupLabel>스마트 기능</GroupLabel>
      <GroupCard footer="머신러닝이 평소 이용 패턴을 학습해 더 정확한 예측을 제공해요. 데이터는 기기에만 저장됩니다.">
        <Row
          icon="sparkles" iconBg="rgba(124,58,237,0.12)" iconFg="var(--violet-500)"
          label="ML 출퇴근 시간 예측"
          sub="과거 이용 데이터 기반 정확도 ±3분"
          right={<Toggle on={smart} onChange={setSmart} />}
        />
        <Row
          icon="route"
          label="대안 경로 자동 추천"
          sub="지연 발생 시 더 빠른 경로 알림"
          right={<Toggle on={true} onChange={() => {}} />}
        />
        <Row
          icon="map-pin"
          label="자동 출발 감지"
          sub="집/회사 근처에서 자동 알림"
          value="일부 시간"
          last
        />
      </GroupCard>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

// ─────────────── 2) 지연 알림 (Delay alerts detail) ───────────────
function SettingsAlertsScreen() {
  const D = window.LM_DATA;
  const LINES = D.LINES;
  const [delayMaster, setDelayMaster] = useSetState(true);
  const [threshold, setThreshold] = useSetState(5); // minutes
  const [picked, setPicked] = useSetState(['2', '9']);
  const [community, setCommunity] = useSetState(true);
  const [pushHigh, setPushHigh] = useSetState(true);

  const togglePick = (id) => {
    setPicked(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  };

  const thresholdSteps = [3, 5, 10, 15];

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <DetailHeader title="지연 알림" />

      {/* Master */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{
          background: delayMaster ? 'linear-gradient(135deg, #0066FF 0%, #2C7BFF 100%)' : 'var(--bg-base)',
          color: delayMaster ? '#fff' : 'var(--label-strong)',
          border: delayMaster ? 'none' : '1px solid var(--line-subtle)',
          borderRadius: 18, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12,
            background: delayMaster ? 'rgba(255,255,255,0.18)' : 'rgba(255,66,66,0.10)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="alert-triangle" size={22} color={delayMaster ? '#fff' : 'var(--red-500)'} strokeWidth={2.2} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>지연 알림</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, opacity: delayMaster ? 0.9 : 1, color: delayMaster ? '#fff' : 'var(--label-alt)' }}>
              {delayMaster ? '내 노선의 지연을 실시간으로 알려드려요' : '지연 알림이 꺼져 있어요'}
            </div>
          </div>
          <Toggle on={delayMaster} onChange={setDelayMaster} />
        </div>
      </div>

      {/* Threshold */}
      <GroupLabel hint={`${threshold}분 이상 지연`}>알림 기준</GroupLabel>
      <GroupCard footer="설정한 시간보다 짧은 지연은 알림이 오지 않아요.">
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--label-alt)', marginBottom: 12 }}>
            {thresholdSteps.map(s => (
              <span key={s} style={{ color: s === threshold ? 'var(--blue-500)' : 'var(--label-alt)' }}>{s}분</span>
            ))}
          </div>
          {/* track */}
          <div style={{ position: 'relative', height: 28 }}>
            <div style={{ position: 'absolute', top: 12, left: 8, right: 8, height: 4, borderRadius: 999, background: 'rgba(112,115,124,0.18)' }} />
            <div style={{
              position: 'absolute', top: 12, left: 8,
              width: `calc(${(thresholdSteps.indexOf(threshold) / (thresholdSteps.length - 1)) * 100}% - 0px)`,
              maxWidth: 'calc(100% - 16px)',
              height: 4, borderRadius: 999, background: 'var(--blue-500)',
            }} />
            {thresholdSteps.map((s, i) => {
              const left = `calc(8px + ${(i / (thresholdSteps.length - 1)) * 100}% - ${(i / (thresholdSteps.length - 1)) * 16}px)`;
              const isActive = s === threshold;
              return (
                <span key={s} onClick={() => setThreshold(s)} style={{
                  position: 'absolute', top: isActive ? 4 : 8, left,
                  width: isActive ? 20 : 12, height: isActive ? 20 : 12,
                  marginLeft: isActive ? -10 : -6,
                  borderRadius: 999,
                  background: isActive ? '#fff' : 'rgba(112,115,124,0.32)',
                  border: isActive ? '4px solid var(--blue-500)' : 'none',
                  boxShadow: isActive ? '0 2px 6px rgba(0,102,255,0.30)' : 'none',
                  cursor: 'pointer',
                }} />
              );
            })}
          </div>
        </div>
      </GroupCard>

      {/* Lines */}
      <GroupLabel hint={`${picked.length}개 선택됨`}>알림 받을 노선</GroupLabel>
      <GroupCard>
        <div style={{ padding: '14px 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '경의'].map(id => {
            const L = LINES[id];
            if (!L) return null;
            const on = picked.includes(id);
            return (
              <span key={id} onClick={() => togglePick(id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 12px 8px 8px', borderRadius: 9999,
                background: on ? L.color : 'var(--bg-subtle-page)',
                color: on ? '#fff' : 'var(--label-neutral)',
                border: on ? 'none' : '1px solid rgba(112,115,124,0.22)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                transition: 'all .15s ease',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 9999,
                  background: on ? 'rgba(255,255,255,0.22)' : L.color,
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{L.label}</span>
                {L.name}
                {on && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
              </span>
            );
          })}
        </div>
      </GroupCard>

      {/* Sources */}
      <GroupLabel>알림 종류</GroupLabel>
      <GroupCard>
        <Row
          icon="building-2"
          label="공식 운영기관 발표"
          sub="서울교통공사 · 코레일 공지"
          right={<Toggle on={true} onChange={() => {}} />}
        />
        <Row
          icon="megaphone" iconBg="rgba(255,180,0,0.16)" iconFg="#A06A00"
          label="실시간 제보"
          sub="검증된 사용자 제보 3건 이상"
          right={<Toggle on={community} onChange={setCommunity} />}
        />
        <Row
          icon="zap" iconBg="rgba(255,66,66,0.10)" iconFg="var(--red-500)"
          label="긴급 푸시"
          sub="10분 이상 심각한 지연만 진동/소리"
          right={<Toggle on={pushHigh} onChange={setPushHigh} />}
          last
        />
      </GroupCard>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

// ─────────────── 3) 알림 시간대 (Quiet hours / windows) ───────────────
function SettingsAlertTimeScreen() {
  const [quiet, setQuiet] = useSetState(true);

  // 24h timeline graphic — show commute windows + quiet hours
  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <DetailHeader title="알림 시간대" right="저장" />

      {/* 24h timeline visualization */}
      <div style={{ padding: '8px 20px 4px' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 18, padding: '20px 18px', border: '1px solid var(--line-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>24시간 알림</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.015em', marginTop: 6 }}>
            평일 알림 활성 시간
          </div>

          {/* Bar */}
          <div style={{ position: 'relative', marginTop: 18, height: 48 }}>
            {/* base track */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(112,115,124,0.10)' }} />

            {/* quiet hours band (00-07, 23-24) — striped */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(7/24)*100}%`,
              borderRadius: '12px 0 0 12px',
              background: 'repeating-linear-gradient(45deg, rgba(112,115,124,0.20), rgba(112,115,124,0.20) 6px, rgba(112,115,124,0.10) 6px, rgba(112,115,124,0.10) 12px)',
            }} />
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(1/24)*100}%`,
              borderRadius: '0 12px 12px 0',
              background: 'repeating-linear-gradient(45deg, rgba(112,115,124,0.20), rgba(112,115,124,0.20) 6px, rgba(112,115,124,0.10) 6px, rgba(112,115,124,0.10) 12px)',
            }} />

            {/* commute morning 07-10 */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(7/24)*100}%`, width: `${(3/24)*100}%`,
              background: 'var(--blue-500)',
            }}>
              <span style={{ position: 'absolute', top: -22, left: 4, fontSize: 10, fontWeight: 800, color: 'var(--blue-700)' }}>출근</span>
            </div>
            {/* daytime 10-17 light blue */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(10/24)*100}%`, width: `${(7/24)*100}%`,
              background: 'rgba(0,102,255,0.20)',
            }} />
            {/* commute evening 17-21 */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(17/24)*100}%`, width: `${(4/24)*100}%`,
              background: 'var(--blue-500)',
            }}>
              <span style={{ position: 'absolute', top: -22, left: 4, fontSize: 10, fontWeight: 800, color: 'var(--blue-700)' }}>퇴근</span>
            </div>
            {/* evening 21-23 light */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${(21/24)*100}%`, width: `${(2/24)*100}%`,
              background: 'rgba(0,102,255,0.20)',
            }} />

            {/* hour ticks */}
            {[0, 6, 12, 18, 24].map(h => (
              <span key={h} style={{
                position: 'absolute', bottom: -22, left: `${(h/24)*100}%`,
                transform: h === 0 ? 'translateX(0)' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: 10, fontWeight: 700, color: 'var(--label-alt)',
                fontVariantNumeric: 'tabular-nums',
              }}>{h.toString().padStart(2, '0')}</span>
            ))}
          </div>

          {/* legend */}
          <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11.5, fontWeight: 700, color: 'var(--label-neutral)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue-500)' }} /> 출퇴근 (강조)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(0,102,255,0.20)' }} /> 일반
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(45deg, rgba(112,115,124,0.50), rgba(112,115,124,0.50) 3px, transparent 3px, transparent 6px)' }} /> 방해 금지
            </span>
          </div>
        </div>
      </div>

      {/* Commute time windows */}
      <GroupLabel>출퇴근 알림 시간</GroupLabel>
      <GroupCard>
        <div style={{ padding: '16px 16px', borderBottom: '1px solid rgba(112,115,124,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Pill tone="primary" size="sm">출근</Pill>
            <span style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>출발 전부터 알림</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <TimeBox label="시작" time="07:00" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>—</span>
            <TimeBox label="종료" time="10:00" />
          </div>
        </div>
        <div style={{ padding: '16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Pill tone="neutral" size="sm">퇴근</Pill>
            <span style={{ fontSize: 12, color: 'var(--label-alt)', fontWeight: 700 }}>퇴근 1시간 전부터 알림</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <TimeBox label="시작" time="17:00" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>—</span>
            <TimeBox label="종료" time="21:00" />
          </div>
        </div>
      </GroupCard>

      {/* Quiet hours */}
      <GroupLabel>방해 금지</GroupLabel>
      <GroupCard footer="방해 금지 시간에는 긴급 지연 알림도 무음으로 와요.">
        <Row
          icon="moon" iconBg="rgba(112,115,124,0.10)"
          label="방해 금지 사용"
          sub="설정 시간 동안 무음"
          right={<Toggle on={quiet} onChange={setQuiet} />}
        />
        <div style={{ padding: '16px 16px', opacity: quiet ? 1 : 0.45 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <TimeBox label="시작" time="23:00" muted />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>—</span>
            <TimeBox label="종료" time="07:00" muted />
          </div>
        </div>
        <Row
          icon="calendar"
          label="주말은 종일 무음"
          sub="토 · 일"
          right={<Toggle on={true} onChange={() => {}} />}
          last
        />
      </GroupCard>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

function TimeBox({ label, time, muted }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px', borderRadius: 12,
      background: muted ? 'rgba(112,115,124,0.08)' : 'var(--bg-subtle-page)',
      border: '1px solid rgba(112,115,124,0.16)',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: muted ? 'var(--label-neutral)' : 'var(--label-strong)', letterSpacing: '-0.015em', marginTop: 4, fontVariantNumeric: 'tabular-nums', fontFamily: 'Wanted Sans Variable, Pretendard, sans-serif' }}>{time}</div>
    </div>
  );
}

// ─────────────── 4) 소리 설정 (Sound & vibration) ───────────────
function SettingsSoundScreen() {
  const [mode, setMode] = useSetState('both'); // sound | vibe | both | silent
  const [volume, setVolume] = useSetState(0.7);
  const [tone, setTone] = useSetState('chime');
  const [arrivalSound, setArrivalSound] = useSetState(true);
  const [delaySound, setDelaySound] = useSetState(true);

  const tones = [
    { id: 'chime', label: '차임', desc: '부드러운 종소리' },
    { id: 'doorbell', label: '도어벨', desc: '지하철 안내음' },
    { id: 'beep', label: '비프', desc: '짧고 명료' },
    { id: 'wave', label: '웨이브', desc: '잔잔한 파도' },
  ];

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      <DetailHeader title="소리 설정" />

      {/* Mode selector — 2x2 */}
      <GroupLabel>알림 방식</GroupLabel>
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'both', icon: 'bell-ring', label: '소리 + 진동', desc: '모든 채널' },
            { id: 'sound', icon: 'volume-2', label: '소리만', desc: '진동 없음' },
            { id: 'vibe', icon: 'vibrate', label: '진동만', desc: '무음' },
            { id: 'silent', icon: 'bell-off', label: '무음', desc: '배지만' },
          ].map(m => {
            const on = mode === m.id;
            return (
              <div key={m.id} onClick={() => setMode(m.id)} style={{
                background: on ? 'var(--blue-500)' : 'var(--bg-base)',
                color: on ? '#fff' : 'var(--label-strong)',
                border: on ? 'none' : '1px solid var(--line-subtle)',
                borderRadius: 16, padding: '16px 14px',
                cursor: 'pointer', boxShadow: on ? '0 4px 12px rgba(0,102,255,0.18)' : 'none',
                transition: 'all .15s ease',
              }}>
                <Icon name={m.icon} size={22} color={on ? '#fff' : 'var(--label-strong)'} strokeWidth={2} />
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>{m.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, opacity: on ? 0.85 : 1, color: on ? '#fff' : 'var(--label-alt)' }}>{m.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume */}
      <GroupLabel hint={`${Math.round(volume * 100)}%`}>알림 볼륨</GroupLabel>
      <GroupCard>
        <div style={{ padding: '18px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="volume-1" size={18} color="var(--label-alt)" />
          <div style={{ flex: 1, position: 'relative', height: 22 }}>
            <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 4, borderRadius: 999, background: 'rgba(112,115,124,0.18)' }} />
            <div style={{ position: 'absolute', top: 9, left: 0, width: `${volume * 100}%`, height: 4, borderRadius: 999, background: 'var(--blue-500)' }} />
            <span style={{
              position: 'absolute', top: 0, left: `${volume * 100}%`, marginLeft: -11,
              width: 22, height: 22, borderRadius: 999, background: '#fff',
              border: '4px solid var(--blue-500)', boxShadow: '0 2px 6px rgba(0,102,255,0.30)',
            }} />
          </div>
          <Icon name="volume-2" size={20} color="var(--label-alt)" />
        </div>
      </GroupCard>

      {/* Sound picker */}
      <GroupLabel>알림음</GroupLabel>
      <GroupCard>
        {tones.map((t, i) => {
          const on = tone === t.id;
          return (
            <div key={t.id} onClick={() => setTone(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', cursor: 'pointer',
              borderBottom: i === tones.length - 1 ? 'none' : '1px solid rgba(112,115,124,0.10)',
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 9999,
                background: on ? 'rgba(0,102,255,0.12)' : 'rgba(112,115,124,0.10)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="play" size={14} color={on ? 'var(--blue-500)' : 'var(--label-neutral)'} strokeWidth={2.4} style={{ marginLeft: 1 }} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label-strong)' }}>{t.label}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label-alt)', marginTop: 1 }}>{t.desc}</div>
              </div>
              <span style={{
                width: 22, height: 22, borderRadius: 9999,
                border: on ? '6px solid var(--blue-500)' : '2px solid rgba(112,115,124,0.30)',
                background: '#fff', flexShrink: 0,
              }} />
            </div>
          );
        })}
      </GroupCard>

      {/* Per-event */}
      <GroupLabel>이벤트별</GroupLabel>
      <GroupCard footer="개별 이벤트마다 소리를 끄거나 켤 수 있어요.">
        <Row icon="train-front" iconBg="rgba(0,102,255,0.12)" iconFg="var(--blue-500)" label="열차 도착" sub="3분 전 알림" right={<Toggle on={arrivalSound} onChange={setArrivalSound} />} />
        <Row icon="alert-triangle" iconBg="rgba(255,66,66,0.10)" iconFg="var(--red-500)" label="지연 발생" sub="실시간 지연" right={<Toggle on={delaySound} onChange={setDelaySound} />} />
        <Row icon="megaphone" iconBg="rgba(255,180,0,0.16)" iconFg="#A06A00" label="실시간 제보" sub="검증된 제보 도착 시" right={<Toggle on={false} onChange={() => {}} />} last />
      </GroupCard>

      <div style={{ height: 24 }} />
    </Screen>
  );
}

window.SettingsCommuteScreen = SettingsCommuteScreen;
window.SettingsAlertsScreen = SettingsAlertsScreen;
window.SettingsAlertTimeScreen = SettingsAlertTimeScreen;
window.SettingsSoundScreen = SettingsSoundScreen;
