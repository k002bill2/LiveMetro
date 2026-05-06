// LiveMetro — atoms (LineBadge, Pill, CongestionBar, Icon helpers)
// Globals: window.LM (LineBadge, Pill, etc.)

const LM_LINES = window.LM_DATA.LINES;

// Circular line badge — Seoul metro style
function LineBadge({ line, size = 24 }) {
  const L = LM_LINES[line];
  if (!L) return null;
  const fontSize = size <= 18 ? 11 : size <= 24 ? 13 : size <= 32 ? 15 : 18;
  // Korean lines that need 2-char fit (분당, 신분당, 경의, 공항)
  const isLong = L.label.length > 1;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: isLong ? 'auto' : size, height: size, minWidth: size,
      padding: isLong ? `0 ${Math.round(size * 0.32)}px` : 0,
      borderRadius: 9999, background: L.color, color: '#fff',
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontWeight: 800, fontSize,
      letterSpacing: '-0.01em',
      lineHeight: 1,
      flexShrink: 0,
    }}>{L.label}</span>
  );
}

// Soft pill (status, label)
function Pill({ children, tone = 'neutral', size = 'md' }) {
  const tones = {
    neutral: { bg: 'rgba(112,115,124,0.10)', fg: 'var(--label-neutral)' },
    primary: { bg: 'var(--blue-50)',          fg: 'var(--blue-700)' },
    pos:     { bg: 'rgba(0,191,64,0.10)',    fg: 'var(--green-700)' },
    neg:     { bg: 'rgba(255,66,66,0.10)',   fg: 'var(--red-700)' },
    warn:    { bg: 'rgba(255,180,0,0.16)',   fg: '#A06A00' },
    cool:    { bg: 'rgba(0,152,178,0.10)',   fg: 'var(--cyan-500)' },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: { padding: '2px 8px', fontSize: 11, height: 20 },
    md: { padding: '4px 10px', fontSize: 12, height: 24 },
    lg: { padding: '6px 12px', fontSize: 13, height: 28 },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      borderRadius: 9999, background: t.bg, color: t.fg,
      fontWeight: 700, ...sizes[size], lineHeight: 1, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// Congestion: 4-step → color
const CONG_TONE = {
  low:   { color: '#00BF40', label: '여유',   pct: 0.30 },
  mid:   { color: '#FFB400', label: '보통',   pct: 0.55 },
  high:  { color: '#FF7A1A', label: '혼잡',   pct: 0.80 },
  vhigh: { color: '#FF4242', label: '매우혼잡', pct: 0.95 },
};
function congFromPct(p) {
  if (p < 45) return 'low';
  if (p < 70) return 'mid';
  if (p < 88) return 'high';
  return 'vhigh';
}

// Compact horizontal congestion bar
function CongestionBar({ level, width = 56, height = 6 }) {
  const t = CONG_TONE[level] || CONG_TONE.mid;
  return (
    <div style={{ width, height, borderRadius: 999, background: 'rgba(112,115,124,0.14)', overflow: 'hidden' }}>
      <div style={{ width: `${t.pct * 100}%`, height: '100%', background: t.color, borderRadius: 999 }} />
    </div>
  );
}

// 4-dot meter
function CongestionDots({ level }) {
  const order = ['low', 'mid', 'high', 'vhigh'];
  const idx = order.indexOf(level);
  const t = CONG_TONE[level];
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {order.map((l, i) => (
        <span key={l} style={{
          width: 6, height: 6, borderRadius: 999,
          background: i <= idx ? t.color : 'rgba(112,115,124,0.18)',
        }} />
      ))}
    </span>
  );
}

// Lucide icon
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.8, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = '';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', name);
      ref.current.appendChild(i);
      window.lucide.createIcons({
        attrs: { width: size, height: size, 'stroke-width': strokeWidth, color },
        nameAttr: 'data-lucide',
      });
    }
  }, [name, size, strokeWidth, color]);
  return <span ref={ref} style={{ display: 'inline-flex', width: size, height: size, color, lineHeight: 0, ...style }} />;
}

// Phone screen container — sets bg + fills frame
// Uses flex column so the TabBar (last child) sticks to the bottom of the frame
// even when content is shorter than the viewport.
function Screen({ children, bg = 'var(--bg-base)', dark, style }) {
  return (
    <div style={{
      minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      background: bg,
      paddingTop: 54, // status bar
      paddingBottom: 0, // tab bar handles its own bottom safe area
      color: dark ? '#fff' : 'var(--label-normal)',
      fontFamily: 'Pretendard, -apple-system, system-ui, sans-serif',
      ...style,
    }}>{children}</div>
  );
}

// Section header inside a screen
function SectionHeader({ title, action, subtitle, style }) {
  return (
    <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', ...style }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--label-strong)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--label-alt)', marginTop: 2, fontWeight: 500 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// Bottom tab bar — iOS style
// Pinned to the bottom of the parent <Screen> via marginTop: auto (flex column).
// Stays in place even when screen content is short or being scrolled.
function TabBar({ active = 'home' }) {
  const tabs = [
    { id: 'home', icon: 'house', label: '홈' },
    { id: 'fav', icon: 'star', label: '즐겨찾기' },
    { id: 'route', icon: 'route', label: '경로' },
    { id: 'feed', icon: 'megaphone', label: '제보' },
    { id: 'me', icon: 'user-round', label: '나' },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 6px 22px',
      background: 'var(--bg-base)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--line-subtle)',
      position: 'sticky', bottom: 0, zIndex: 10,
      marginTop: 'auto', // pin to bottom of flex-column Screen
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: t.id === active ? 'var(--blue-500)' : 'var(--label-alt)',
          flex: 1,
        }}>
          <Icon name={t.icon} size={22} strokeWidth={t.id === active ? 2.2 : 1.7} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// Card surface
function Card({ children, padding = 16, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-base)',
      border: '1px solid rgba(112,115,124,0.16)',
      borderRadius: 16, padding,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  LineBadge, Pill, CongestionBar, CongestionDots, Icon,
  Screen, SectionHeader, TabBar, Card,
  CONG_TONE, congFromPct,
});
