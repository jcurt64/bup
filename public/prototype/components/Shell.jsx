/* Shared small components */

const Logo = ({ size = 18, color, onClick }) => {
  // BUUPP brand image (replaces former SVG mark). `size` controls rendered height.
  const renderHeight = Math.max(size * 2.2, 36);
  const content = (
    <div className="row center" style={{ color: color || 'inherit' }}>
      <img
        src="/logo.png"
        alt="BUUPP"
        style={{ height: renderHeight, width: 'auto', display: 'block' }}
      />
    </div>
  );
  if (onClick) {
    return (
      <button onClick={onClick} aria-label="Retour à l'accueil"
        style={{ padding: 0, background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit' }}>
        {content}
      </button>
    );
  }
  return content;
};

const Icon = ({ name, size = 16, stroke = 1.5 }) => {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
    arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    check: <path d="M20 6L9 17l-5-5" />,
    close: <path d="M18 6L6 18M6 6l12 12" />,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    unlock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-1"/></>,
    wallet: <><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 13h2M3 10h18"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 11a3 3 0 0 0 0-6M22 21c0-3-2-5-5-5.5"/></>,
    inbox: <><path d="M3 13h5l2 3h4l2-3h5M3 13v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7"/><path d="M3 13l3-8h12l3 8"/></>,
    shield: <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/>,
    gauge: <><path d="M12 15a4 4 0 1 0-4-4"/><path d="M3 12a9 9 0 0 1 18 0"/></>,
    chart: <path d="M3 20h18M6 16l4-6 4 4 6-9"/>,
    sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h14M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M8 8a2 2 0 1 1 4-2 2 2 0 1 1 4 2"/></>,
    doc: <><path d="M7 3h8l4 4v14H7V3z"/><path d="M14 3v5h5M9 13h8M9 17h6"/></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></>,
    bell: <path d="M6 18v-6a6 6 0 1 1 12 0v6h1v2H5v-2h1zM10 22h4"/>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    money: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></>,
    trend: <path d="M3 17l6-6 4 4 8-9M14 6h7v7"/>,
    phone: <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z"/>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    mapPin: <><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    flag: <path d="M5 21V4h12l-2 4 2 4H5"/>,
    ext: <path d="M14 3h7v7M10 14L21 3M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <path d="M3 3l18 18M10.5 10.6a2 2 0 0 0 2.9 2.9M6.3 6.4A11 11 0 0 0 2 12s4 7 10 7a11 11 0 0 0 4.8-1.1M14 5.2A11 11 0 0 1 22 12a11 11 0 0 1-2 3"/>,
    pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>,
    play: <path d="M6 4l14 8-14 8V4z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    refresh: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>,
    download: <><path d="M12 3v14M6 13l6 6 6-6"/><path d="M4 21h16"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H4"/><path d="M15 21h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4"/></>,
    filter: <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/>,
    dot: <circle cx="12" cy="12" r="4" fill="currentColor"/>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    france: <><path d="M12 2C7 8 4 11 4 14a8 8 0 0 0 16 0c0-3-3-6-8-12z"/><circle cx="12" cy="13" r="2.5"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></>,
    // --- added for v2 edits ---
    edit: <><path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3z"/><path d="M14 6l4 4"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/><path d="M10 11v6M14 11v6"/></>,
    eyeSlash: <path d="M3 3l18 18M10.5 10.6a2 2 0 0 0 2.9 2.9M6.3 6.4A11 11 0 0 0 2 12s4 7 10 7a11 11 0 0 0 4.8-1.1M14 5.2A11 11 0 0 1 22 12a11 11 0 0 1-2 3"/>,
    // Mise en relation — two overlapping profiles shaking hands (handshake arc)
    handshake: <><path d="M7 11L3 7M17 11l4-4"/><path d="M7 11v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5"/><path d="M12 18v-3M9 11l3-3 3 3"/></>,
    // Palier — stacked bars ascending (explicit tiers)
    tiers: <><rect x="3" y="16" width="4" height="5"/><rect x="10" y="11" width="4" height="10"/><rect x="17" y="6" width="4" height="15"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v5"/></>,
    alert: <><path d="M12 3L22 20H2L12 3z"/><path d="M12 10v4M12 17v.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    rotate: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>,
    sms: <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></>,
    whatsapp: <><path d="M20.5 12a8.5 8.5 0 1 1-15.6-4.7L3 21l4-1a8.5 8.5 0 0 0 13.5-8z"/><path d="M9 9.5a1 1 0 0 1 1-1h.5l1 2-1 1a6 6 0 0 0 3 3l1-1 2 1v.5a1 1 0 0 1-1 1A8 8 0 0 1 9 9.5z" fill="currentColor" stroke="none"/></>,
    facebook: <path d="M14 8h2.5V5H14a3 3 0 0 0-3 3v2H8.5v3H11v8h3v-8h2.5l.5-3H14V8z"/>,
    linkedin: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v8M8 7v.01M12 18v-5a2.5 2.5 0 0 1 5 0v5M12 13v5"/></>,
    // Instagram — square cadre + objectif + flash (le strokeLinecap "round" garde le rendu cohérent avec les autres icônes BUUPP).
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></>,
    // TikTok — note de musique stylisée (D + crochet). Tracé volontairement simplifié pour rester lisible à 14-16 px.
    tiktok: <><path d="M14 4v10a4 4 0 1 1-4-4"/><path d="M14 4c0 2.5 2 4.5 4.5 4.5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
};

// Generic avatar: initials in a soft block
const Avatar = ({ name = "?", size = 32, color }) => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = ['#E6E1D3', '#DDD6C3', '#E3DAC5', '#D9D2BF'];
  const bg = color || hues[hash % hues.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: bg, color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontFamily: 'var(--serif)', fontWeight: 500,
      letterSpacing: '-0.01em', flexShrink: 0
    }}>{initials}</div>
  );
};

// Small circular BUUPP Score gauge
const ScoreGauge = ({ value = 742, max = 1000, size = 120, label = true }) => {
  const pct = value / max;
  const R = size / 2 - 6;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  const tone = value >= 800 ? '#166534' : value >= 600 ? 'var(--accent)' : value >= 400 ? '#A16207' : '#B91C1C';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={R} stroke="var(--line)" strokeWidth="4" fill="none" />
        <circle cx={size/2} cy={size/2} r={R} stroke={tone} strokeWidth="4" fill="none"
                strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center'
      }}>
        <div className="serif tnum" style={{ fontSize: size * 0.28, lineHeight: 1, color: 'var(--ink)' }}>{value}</div>
        {label && <div className="mono muted" style={{ fontSize: 10, marginTop: 2, letterSpacing: '0.1em' }}>/ {max}</div>}
      </div>
    </div>
  );
};

// Progress bar
const Progress = ({ value = 0.5, color }) => (
  <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
    <div style={{ width: `${value * 100}%`, height: '100%', background: color || 'var(--accent)', transition: 'width .5s ease' }} />
  </div>
);

Object.assign(window, { Logo, Icon, Avatar, ScoreGauge, Progress });
