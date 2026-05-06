// LiveMetro — Onboarding Step 2.5: 역 선택 (출발/환승/도착)
// Globals: window.OnboardingStationPickerScreen

const { useState: useOSPState } = React;

function OnboardingStationPickerScreen() {
  // Which slot is being edited: 'from' | 'transfer' | 'to'
  const [activeSlot, setActiveSlot] = useOSPState('transfer');
  const [from, setFrom] = useOSPState({ name: '홍대입구', lines: ['2', 'gj', 'gx'] });
  const [transfer, setTransfer] = useOSPState(null); // null = 환승 없음 (직행)
  const [to, setTo] = useOSPState({ name: '강남', lines: ['2', 'sb'] });
  const [query, setQuery] = useOSPState('');
  const [browseMode, setBrowseMode] = useOSPState(false); // false = 추천, true = 노선별 전체 목록
  const [selectedLineId, setSelectedLineId] = useOSPState('2');

  // Recommended stations relative to active slot
  const RECOMMENDED = {
    from: [
      { name: '홍대입구', lines: ['2', 'gj', 'gx'], reason: 'GPS 위치 기반', distance: '180m' },
      { name: '합정',     lines: ['2', '6'],        reason: '근처 역',      distance: '720m' },
      { name: '신촌',     lines: ['2'],             reason: '근처 역',      distance: '880m' },
    ],
    transfer: [
      { name: '직행 (환승 없음)', lines: [], reason: '추천 · 가장 빠름', direct: true, time: '28분' },
      { name: '합정',   lines: ['2', '6'],     reason: '2호선 ↔ 6호선', time: '32분' },
      { name: '신도림', lines: ['1', '2'],     reason: '2호선 ↔ 1호선', time: '34분' },
      { name: '교대',   lines: ['2', '3', 'sb'], reason: '2호선 ↔ 신분당', time: '30분' },
    ],
    to: [
      { name: '강남',   lines: ['2', 'sb'],    reason: '저장된 회사 위치', distance: '회사' },
      { name: '역삼',   lines: ['2'],          reason: '강남 인근',         distance: '600m' },
      { name: '삼성',   lines: ['2'],          reason: '강남 인근',         distance: '1.3km' },
    ],
  };

  // Recent searches
  const RECENT = ['홍대입구', '강남', '왕십리', '잠실'];

  // Full station list grouped by line (for manual browse)
  const ALL_LINES = [
    {
      id: '2', name: '2호선', color: '#00A84D',
      stations: [
        '시청', '을지로입구', '을지로3가', '을지로4가', '동대문역사문화공원',
        '신당', '상왕십리', '왕십리', '한양대', '뚝섬', '성수',
        '건대입구', '구의', '강변', '잠실나루', '잠실', '잠실새내', '종합운동장',
        '삼성', '선릉', '역삼', '강남', '교대', '서초', '방배', '사당',
        '낙성대', '서울대입구', '봉천', '신림', '신대방', '구로디지털단지',
        '대림', '신도림', '문래', '영등포구청', '당산', '합정', '홍대입구',
        '신촌', '이대', '아현', '충정로',
      ],
    },
    {
      id: 'sb', name: '신분당선', color: '#A40070',
      stations: ['강남', '양재', '청계산입구', '판교', '정자', '미금', '동천', '수지구청', '성복', '상현', '광교중앙', '광교'],
    },
    {
      id: '1', name: '1호선', color: '#0052A4',
      stations: ['소요산', '의정부', '회룡', '도봉산', '창동', '광운대', '청량리', '제기동', '동대문', '종로5가', '종각', '시청', '서울역', '용산', '노량진', '신도림', '구로', '가산디지털단지', '인천'],
    },
    {
      id: '4', name: '4호선', color: '#00A5DE',
      stations: ['당고개', '노원', '쌍문', '미아', '길음', '성신여대입구', '한성대입구', '혜화', '동대문', '충무로', '명동', '회현', '서울역', '숙대입구', '삼각지', '이촌', '동작', '이수', '사당', '남태령'],
    },
    {
      id: '5', name: '5호선', color: '#996CAC',
      stations: ['방화', '김포공항', '발산', '우장산', '화곡', '까치산', '신정', '목동', '오목교', '여의도', '여의나루', '마포', '공덕', '애오개', '충정로', '서대문', '광화문', '종로3가', '동대문역사문화공원', '청구', '왕십리', '마장', '답십리', '장한평'],
    },
    {
      id: '8', name: '8호선', color: '#E6186C',
      stations: ['암사', '천호', '강동구청', '몽촌토성', '잠실', '석촌', '송파', '가락시장', '문정', '장지', '복정', '산성', '남한산성입구', '단대오거리', '신흥', '수진', '모란'],
    },
    {
      id: 'gj', name: '경의중앙선', color: '#77C4A3',
      stations: ['문산', '파주', '월롱', '금촌', '운정', '야당', '탄현', '일산', '백마', '풍산', '화전', '수색', '디지털미디어시티', '가좌', '신촌', '서강대', '홍대입구', '공덕', '효창공원앞', '용산', '이촌', '서빙고', '한남', '옥수', '응봉', '왕십리'],
    },
    {
      id: '6', name: '6호선', color: '#CD7C2F',
      stations: ['응암', '역촌', '불광', '독바위', '연신내', '구산', '새절', '증산', '디지털미디어시티', '월드컵경기장', '마포구청', '망원', '합정', '상수', '광흥창', '대흥', '공덕', '효창공원앞', '삼각지', '녹사평', '이태원', '한강진', '버티고개', '약수'],
    },
  ];

  const slotMeta = {
    from:     { label: '출발역',    icon: 'home',         color: 'var(--label-strong)' },
    transfer: { label: '환승역',    icon: 'arrow-left-right', color: '#A06A00' },
    to:       { label: '도착역',    icon: 'building-2',   color: 'var(--blue-500)' },
  };

  const currentValue = activeSlot === 'from' ? from : activeSlot === 'transfer' ? transfer : to;

  const StationChip = ({ name, lines, isSelected, onClick, reason, distance, time, direct, showLines = true }) => (
    <div onClick={onClick} style={{
      padding: '14px 14px',
      background: 'var(--bg-base)',
      border: isSelected ? '2px solid var(--blue-500)' : '1px solid var(--line-subtle)',
      borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
    }}>
      {showLines && lines.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 26 }}>
          {lines.slice(0, 2).map(l => <LineBadge key={l} line={l} size={22} />)}
        </div>
      ) : direct ? (
        <span style={{
          width: 26, height: 26, borderRadius: 9999,
          background: 'rgba(0,168,77,0.14)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="zap" size={14} strokeWidth={2.4} color="var(--green-700)" />
        </span>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.01em' }}>{name}</div>
        {reason && (
          <div style={{ fontSize: 11, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2 }}>
            {reason}{distance ? ` · ${distance}` : ''}{time ? ` · ${time}` : ''}
          </div>
        )}
      </div>
      {isSelected ? (
        <span style={{
          width: 22, height: 22, borderRadius: 9999, background: 'var(--blue-500)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="check" size={14} strokeWidth={3} color="#fff" />
        </span>
      ) : (
        <span style={{
          width: 22, height: 22, borderRadius: 9999, border: '2px solid rgba(112,115,124,0.30)',
        }} />
      )}
    </div>
  );

  const SlotRow = ({ slot, value }) => {
    const meta = slotMeta[slot];
    const isActive = activeSlot === slot;
    const empty = value === null || value === undefined;
    return (
      <div onClick={() => setActiveSlot(slot)} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px',
        background: isActive ? 'var(--bg-base)' : 'transparent',
        border: isActive ? '2px solid var(--blue-500)' : '1px solid transparent',
        borderRadius: 12,
        cursor: 'pointer',
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9999,
          background: empty ? 'rgba(112,115,124,0.10)' : `color-mix(in oklch, ${meta.color} 14%, transparent)`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={meta.icon} size={15} strokeWidth={2.2} color={empty ? 'var(--label-alt)' : meta.color} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: isActive ? 'var(--blue-500)' : 'var(--label-alt)', letterSpacing: '0.04em' }}>
            {meta.label}{slot === 'transfer' && ' (선택)'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: empty ? 'var(--label-alt)' : 'var(--label-strong)', marginTop: 1, letterSpacing: '-0.01em' }}>
            {empty ? (slot === 'transfer' ? '환승 없음 (직행)' : '역을 선택해주세요') : value.name}
          </div>
        </div>
        {!empty && value.lines && value.lines.length > 0 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {value.lines.slice(0, 2).map(l => <LineBadge key={l} line={l} size={18} />)}
          </div>
        )}
      </div>
    );
  };

  const handleSelect = (item) => {
    if (activeSlot === 'from') {
      setFrom({ name: item.name, lines: item.lines });
      setActiveSlot('transfer');
    } else if (activeSlot === 'transfer') {
      if (item.direct) {
        setTransfer(null);
      } else {
        setTransfer({ name: item.name, lines: item.lines });
      }
      setActiveSlot('to');
    } else {
      setTo({ name: item.name, lines: item.lines });
    }
    setQuery('');
  };

  const isSelected = (item) => {
    if (activeSlot === 'from') return from?.name === item.name;
    if (activeSlot === 'transfer') {
      if (item.direct) return transfer === null;
      return transfer?.name === item.name;
    }
    return to?.name === item.name;
  };

  const recommended = RECOMMENDED[activeSlot];
  const filtered = query
    ? recommended.filter(r => r.name.includes(query))
    : recommended;

  const canProceed = from && to;

  return (
    <Screen style={{ background: 'var(--bg-subtle-page)' }}>
      {/* Header — progress + back */}
      <div style={{ padding: '20px 20px 4px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-base)' }}>
        <Icon name="chevron-left" size={26} color="var(--label-neutral)" />
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= 2 ? 'var(--blue-500)' : 'rgba(112,115,124,0.18)' }} />
          ))}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label-alt)' }}>건너뛰기</span>
      </div>

      {/* Title */}
      <div style={{ padding: '20px 24px 16px', background: 'var(--bg-base)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue-500)', letterSpacing: '0.05em' }}>STEP 2 / 4 · 경로 설정</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.025em', marginTop: 6, lineHeight: 1.25 }}>
          어디서 어디까지<br />이동하시나요?
        </div>
      </div>

      {/* Slots — visual route */}
      <div style={{ padding: '12px 20px 16px', background: 'var(--bg-base)', borderBottom: '1px solid var(--line-subtle)' }}>
        <div style={{ background: 'var(--bg-subtle-page)', borderRadius: 16, padding: 8, position: 'relative' }}>
          <SlotRow slot="from" value={from} />
          {/* connector line */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 26px' }}>
            <div style={{ width: 2, height: 12, background: 'rgba(112,115,124,0.30)', marginLeft: 14 }} />
          </div>
          <SlotRow slot="transfer" value={transfer} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 26px' }}>
            <div style={{ width: 2, height: 12, background: 'rgba(112,115,124,0.30)', marginLeft: 14 }} />
          </div>
          <SlotRow slot="to" value={to} />
        </div>
      </div>

      {/* Active slot label + manual toggle (출발/도착 only) */}
      <div style={{ padding: '16px 24px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--label-strong)', letterSpacing: '-0.01em' }}>
            {slotMeta[activeSlot].label}{activeSlot === 'transfer' ? ' 추천' : (browseMode ? ' 직접 선택' : ' 검색')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--label-alt)', fontWeight: 600, marginTop: 2 }}>
            {activeSlot === 'from'     && (browseMode ? '노선을 선택하고 역을 골라주세요' : '집 근처 역을 선택해주세요')}
            {activeSlot === 'transfer' && '직행이 가장 빨라요. 필요시 환승역을 선택하세요'}
            {activeSlot === 'to'       && (browseMode ? '노선을 선택하고 역을 골라주세요' : '회사 근처 역을 선택해주세요')}
          </div>
        </div>
        {activeSlot !== 'transfer' && (
          <span onClick={() => { setBrowseMode(b => !b); setQuery(''); }} style={{
            padding: '8px 12px', borderRadius: 9999, fontSize: 11.5, fontWeight: 800,
            background: browseMode ? 'var(--blue-500)' : 'var(--bg-base)',
            color: browseMode ? '#fff' : 'var(--blue-500)',
            border: browseMode ? 'none' : '1px solid var(--blue-500)',
            display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0,
          }}>
            <Icon name={browseMode ? 'sparkles' : 'list'} size={12} strokeWidth={2.4} color={browseMode ? '#fff' : 'var(--blue-500)'} />
            {browseMode ? '추천 보기' : '직접 선택'}
          </span>
        )}
      </div>

      {/* Search bar */}
      <div style={{ padding: '4px 24px 12px' }}>
        <div style={{
          height: 44, borderRadius: 12, background: 'var(--bg-base)',
          border: '1px solid var(--line-subtle)',
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
        }}>
          <Icon name="search" size={18} color="var(--label-alt)" />
          <input
            placeholder={`${slotMeta[activeSlot].label} 이름으로 검색`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: 'var(--label-strong)' }}
          />
          {query && (
            <span onClick={() => setQuery('')} style={{ width: 18, height: 18, borderRadius: 9999, background: 'rgba(112,115,124,0.30)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="x" size={11} strokeWidth={3} color="#fff" />
            </span>
          )}
        </div>
      </div>

      {/* Recent searches (only for from/to in recommend mode, not transfer, not browse) */}
      {!query && activeSlot !== 'transfer' && !browseMode && (
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', marginBottom: 8 }}>최근 검색</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RECENT.map(r => (
              <span key={r} style={{
                padding: '6px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                background: 'var(--bg-base)', color: 'var(--label-neutral)',
                border: '1px solid var(--line-subtle)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="clock" size={11} strokeWidth={2} color="var(--label-alt)" />
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT: Browse-by-line (manual) OR Recommended list */}
      {browseMode && activeSlot !== 'transfer' ? (
        <>
          {/* Line tabs - horizontal scroll */}
          <div style={{ padding: '0 0 10px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', marginBottom: 8 }}>노선 선택</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingRight: 24, scrollbarWidth: 'none' }}>
              <style>{`.lm-line-tabs::-webkit-scrollbar{display:none}`}</style>
              {ALL_LINES.map(line => {
                const isOn = selectedLineId === line.id;
                return (
                  <span key={line.id} className="lm-line-tabs"
                    onClick={() => setSelectedLineId(line.id)}
                    style={{
                      padding: '8px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 800,
                      background: isOn ? line.color : 'var(--bg-base)',
                      color: isOn ? '#fff' : 'var(--label-neutral)',
                      border: isOn ? 'none' : '1px solid var(--line-subtle)',
                      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      cursor: 'pointer',
                    }}>
                    <LineBadge line={line.id} size={18} />
                    {line.name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Station list for selected line */}
          <div style={{ padding: '0 24px 12px' }}>
            {(() => {
              const line = ALL_LINES.find(l => l.id === selectedLineId);
              const stations = query ? line.stations.filter(s => s.includes(query)) : line.stations;
              const currentName = activeSlot === 'from' ? from?.name : to?.name;

              if (stations.length === 0) {
                return (
                  <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--label-alt)', fontWeight: 600 }}>
                    "{query}"와(과) 일치하는 역이 없어요
                  </div>
                );
              }

              return (
                <div style={{
                  background: 'var(--bg-base)', borderRadius: 14,
                  border: '1px solid var(--line-subtle)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 14px', fontSize: 11, fontWeight: 800,
                    color: 'var(--label-alt)', letterSpacing: '0.04em',
                    background: 'var(--bg-subtle-page)',
                    borderBottom: '1px solid var(--line-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span>{line.name} · 총 {line.stations.length}개역</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label-alt)' }}>가나다순</span>
                  </div>
                  {stations.map((stName, idx) => {
                    const isSel = stName === currentName;
                    return (
                      <div key={stName + idx}
                        onClick={() => handleSelect({ name: stName, lines: [line.id] })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px',
                          borderBottom: idx === stations.length - 1 ? 'none' : '1px solid rgba(112,115,124,0.08)',
                          background: isSel ? 'rgba(0,102,255,0.06)' : 'transparent',
                          cursor: 'pointer',
                        }}>
                        <span style={{
                          width: 12, height: 12, borderRadius: 9999,
                          border: `3px solid ${line.color}`,
                          background: isSel ? line.color : '#fff',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, fontSize: 14.5, fontWeight: isSel ? 800 : 600, color: 'var(--label-strong)' }}>
                          {stName}
                        </div>
                        {isSel ? (
                          <span style={{
                            width: 22, height: 22, borderRadius: 9999, background: 'var(--blue-500)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon name="check" size={13} strokeWidth={3} color="#fff" />
                          </span>
                        ) : (
                          <Icon name="chevron-right" size={15} color="var(--label-alt)" strokeWidth={2} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      ) : (
        /* Recommended list */
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--label-alt)', letterSpacing: '0.04em', marginBottom: 8 }}>
            {activeSlot === 'transfer' ? '환승역 추천' : (query ? '검색 결과' : '추천')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((item, i) => (
              <StationChip
                key={item.name + i}
                name={item.name}
                lines={item.lines}
                reason={item.reason}
                distance={item.distance}
                time={item.time}
                direct={item.direct}
                isSelected={isSelected(item)}
                onClick={() => handleSelect(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA — sticky-ish */}
      <div style={{ padding: '16px 24px 24px', marginTop: 'auto' }}>
        <button style={{
          width: '100%', height: 56, borderRadius: 14, border: 'none',
          background: canProceed ? 'var(--blue-500)' : 'rgba(112,115,124,0.20)',
          color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          다음 단계
          <Icon name="arrow-right" size={18} color="#fff" strokeWidth={2.4} />
        </button>
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11.5, color: 'var(--label-alt)', fontWeight: 600 }}>
          {transfer === null
            ? `${from?.name || '—'} → ${to?.name || '—'} · 직행`
            : `${from?.name || '—'} → ${transfer.name} → ${to?.name || '—'} · 환승 1회`}
        </div>
      </div>
    </Screen>
  );
}

window.OnboardingStationPickerScreen = OnboardingStationPickerScreen;
