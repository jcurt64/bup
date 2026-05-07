// Landing page
var { useState, useEffect } = React;

function RotatingHeadlineWord() {
  // Cycle: "inversée." (indigo, italic) -> "transparente." (orange, italic)
  // Each word displayed 2s, then flips. The italic "." stays part of the word.
  const words = [
    { t: 'inversée.', color: '#A5B4FC' },
    { t: 'transparente.', color: '#FB923C' }, // orange vif
  ];
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'
  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      // Show for ~2s, then animate out, swap, animate in
      setPhase('in');
      const showT = setTimeout(() => {
        if (!mounted) return;
        setPhase('out');
        const swapT = setTimeout(() => {
          if (!mounted) return;
          setI(n => (n + 1) % words.length);
          setPhase('in');
          // Schedule next cycle
          const nextT = setTimeout(tick, 2000);
          timers.push(nextT);
        }, 420); // out duration
        timers.push(swapT);
      }, 2000);
      timers.push(showT);
    };
    const timers = [];
    tick();
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  const current = words[i];
  return (
    <span style={{
      display: 'inline-block', position: 'relative',
      minWidth: '8ch',
      verticalAlign: 'baseline',
    }}>
      <span
        key={i + '-' + phase}
        style={{
          display: 'inline-block',
          fontStyle: 'italic',
          color: current.color,
          transition: 'transform .42s cubic-bezier(.22,.8,.24,1), opacity .42s cubic-bezier(.22,.8,.24,1), filter .42s',
          transform: phase === 'in' ? 'translateY(0) rotateX(0deg)' : 'translateY(-0.25em) rotateX(45deg)',
          opacity: phase === 'in' ? 1 : 0,
          filter: phase === 'in' ? 'blur(0)' : 'blur(3px)',
          transformOrigin: 'bottom center',
          willChange: 'transform, opacity',
        }}
      >
        {current.t}
      </span>
    </span>
  );
}


const TIERS = [
  { n: 1, name: 'Identification', ex: 'email, nom, téléphone', range: 'minimum 0,50 €', low: 0.50, high: 0.50 },
  { n: 2, name: 'Localisation', ex: 'adresse, logement', range: '0,50 € – 2,00 €', low: 0.50, high: 2.00 },
  { n: 3, name: 'Style de vie', ex: 'habitudes, famille, véhicule', range: '2,00 € – 5,00 €', low: 2.00, high: 5.00 },
  { n: 4, name: 'Données professionnelles', ex: 'poste, revenus, statut', range: '5,00 € – 8,00 €', low: 5.00, high: 8.00 },
  { n: 5, name: 'Patrimoine & projets', ex: 'immobilier, épargne', range: '8,00 € – 10,00 €', low: 8.00, high: 10.00 },
];

function Landing({ go }) {
  return (
    <div className="landing" style={{ background: 'var(--ivory)' }}>
      <Navbar go={go} />
      <Hero go={go} />
      <FlashDeal go={go} />
      <HowItWorks />
      <TiersTable />
      <ScoreSection />
      <ProsSection go={go} />
      <SecuritySection />
      <Stats />
      <Pricing go={go} />
      <FinalCTA go={go} />
      <Footer />
      <StickyPreinscription go={go} />
    </div>
  );
}

function StickyPreinscription({ go }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => go('waitlist')}
      aria-label="Pré-inscription à la liste d'attente"
      style={{
        position: 'fixed', right: 22, bottom: 78, zIndex: 95,
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '14px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #4596EC 0%, #6BA8F0 100%)',
        color: '#0F1629', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14,
        boxShadow: '0 18px 40px -10px rgba(69,150,236,.55), 0 6px 14px rgba(15,22,41,.18), inset 0 1px 0 rgba(255,255,255,.45)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(.92)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .35s cubic-bezier(.22,1,.36,1), transform .35s cubic-bezier(.22,1,.36,1)'
      }}>
      <Icon name="sparkle" size={15}/>
      Pré-inscription
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
        background: 'rgba(15,22,41,.22)', letterSpacing: '.02em'
      }}>+5€</span>
    </button>
  );
}

function Navbar({ go, onDark }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled ? 'rgba(247,244,236,.85)' : 'var(--ivory)',
      backdropFilter: scrolled ? 'blur(10px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      transition: 'all .2s'
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 32px' }} className="row between center">
        <div className="row center gap-8">
          <Logo size={26} onClick={() => go('landing')}/>
          <nav className="row gap-6" style={{ marginLeft: 16 }}>
            <a className="nav-link" href="#prospects">Prospects</a>
            <a className="nav-link" href="#pros">Professionnels</a>
            <a className="nav-link" href="#tarifs">Tarifs</a>
          </nav>
        </div>
        <div className="row center gap-3">
          <button className="btn btn-sm btn-ghost" onClick={() => go('auth')}>Se connecter</button>
          <button className="btn btn-sm btn-primary" onClick={() => go('auth')}>
            Démarrer <Icon name="arrow" size={14}/>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ go }) {
  return (
    <section style={{ background: '#0F1629', color: 'var(--paper)', padding: '96px 32px 120px', position: 'relative', overflow: 'hidden' }}>
      {/* Grid pattern */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)',
        backgroundSize: '88px 88px',
        maskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)',
        pointerEvents: 'none'
      }}/>
      {/* Warm light glow top-left */}
      <div aria-hidden style={{
        position: 'absolute', top: '-280px', left: '-220px', width: '900px', height: '900px',
        background: 'radial-gradient(closest-side, rgba(249,115,22,.22) 0%, rgba(249,115,22,.08) 35%, rgba(249,115,22,0) 70%)',
        filter: 'blur(20px)', pointerEvents: 'none'
      }}/>
      {/* Subtle vignette right */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
        background: 'radial-gradient(ellipse at 90% 30%, rgba(165,180,252,.08) 0%, transparent 60%)',
        pointerEvents: 'none'
      }}/>
      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 24 }}>
          <div className="row center gap-3">
            <span className="badge" style={{ background: 'transparent', color: 'var(--ivory)', borderColor: 'rgba(255,255,255,.18)' }}>
              <span className="dot pulse-dot" style={{ background: '#A7F3D0' }}/>
              Vos données ont de la valeur — récupérez-la
            </span>
          </div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }}>
            Be Used · Paid &amp; Proud — France, avril 2026
          </div>
        </div>

        <h1 className="serif" style={{ color: 'var(--paper)', maxWidth: 1100 }}>
          La publicité,<br/>
          <RotatingHeadlineWord/>
        </h1>

        <div className="row between" style={{ marginTop: 48, gap: 48, flexWrap: 'wrap' }}>
          <p style={{ maxWidth: 520, fontSize: 19, lineHeight: 1.5, color: 'rgba(255,255,255,.78)' }}>
            BUUPP est la première plateforme qui rémunère les particuliers pour accepter
            d'être contactés par les professionnels qui les ciblent vraiment.
            Double consentement, RGPD natif, 60% de la valeur reversée au prospect.
          </p>
          <div className="row gap-3" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-lg" style={{
              background: 'linear-gradient(135deg, #4596EC 0%, #6BA8F0 100%)',
              color: '#0F1629', fontWeight: 600,
              boxShadow: '0 12px 28px -8px rgba(69,150,236,.55), inset 0 1px 0 rgba(255,255,255,.4)'
            }}
                    onClick={() => go('waitlist')}>
              <Icon name="sparkle" size={16}/> Pré-inscription <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 999, background: 'rgba(15,22,41,.18)', marginLeft: 6 }}>+5€</span>
            </button>
            <button className="btn btn-lg" style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                    onClick={() => go('prospect')}>
              Je suis prospect <Icon name="arrow" size={16}/>
            </button>
            <button className="btn btn-lg btn-ghost" style={{ color: 'var(--paper)', borderColor: 'rgba(255,255,255,.28)' }}
                    onClick={() => go('pro')}>
              Je suis professionnel
            </button>
          </div>
        </div>

        {/* Live ticker */}
        <div style={{ marginTop: 72, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 24, overflow: 'hidden' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'rgba(255,255,255,.35)', marginBottom: 14 }}>
            ● EN DIRECT — Mises en relation acceptées ces dernières heures
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="marquee">
              {[...Array(2)].flatMap((_, r) => [
                ['Kiné à Lyon 3e', 'Marie L.', '4,20 €'],
                ['Coach pro, Nantes', 'Antoine R.', '6,80 €'],
                ['Agence immo Paris 11', 'Solène P.', '9,40 €'],
                ['Artisan menuisier', 'Karim B.', '3,10 €'],
                ['PME SaaS B2B', 'Julie T.', '7,50 €'],
                ['Nutritionniste Lille', 'Théo M.', '5,60 €'],
              ].map((row, i) => (
                <div key={`${r}-${i}`} className="row center gap-3" style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                  <span style={{ color: 'rgba(255,255,255,.4)' }}>◇</span>
                  <span>{row[0]}</span>
                  <span style={{ color: 'rgba(255,255,255,.4)' }}>→</span>
                  <span>{row[1]}</span>
                  <span className="mono" style={{ color: '#A5B4FC' }}>+{row[2]}</span>
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Libellés FR des paliers — utilisés dans le modal pour annoncer ce que
// le pro souhaite obtenir si certaines données ne sont pas renseignées.
const TIER_KEY_LABEL_FR = {
  identity:     "Identification",
  localisation: "Localisation",
  vie:          "Style de vie",
  pro:          "Données professionnelles",
  patrimoine:   "Patrimoine & projets",
};

function fmtMultiplier(m) {
  if (m === 1) return '×1';
  if (Number.isInteger(m)) return `×${m}`;
  return `×${String(m).replace('.', ',')}`;
}

function FlashDeal({ go }) {
  const [deal, setDeal] = useState(null); // null = loading | undefined = none
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  const load = React.useCallback(() => {
    return fetch('/api/landing/flash-deals', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { deals: [] })
      .then(j => {
        const d = (j.deals || [])[0];
        setDeal(d || undefined);
        return d || null;
      })
      .catch(() => { setDeal(undefined); return null; });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const safeLoad = () => { if (!cancelled) load(); };
    safeLoad();
    const t = setInterval(safeLoad, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; clearInterval(t); clearInterval(tick); };
  }, [load]);

  if (deal === null || deal === undefined) return null;

  const left = Math.max(0, Math.floor((new Date(deal.endsAt).getTime() - now) / 1000));
  if (left === 0) return null;
  const h = String(Math.floor(left / 3600)).padStart(2, '0');
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  const multStr = fmtMultiplier(deal.multiplier);
  return (
    <>
      <section
        role="button"
        tabIndex={0}
        aria-label="Voir le détail de l'offre flash deal"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        style={{
          background: 'var(--paper)', borderBottom: '1px solid var(--line)',
          cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 5,
          transition: 'background .12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in oklab, var(--accent) 4%, var(--paper))'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--paper)'; }}
      >
        <div
          className="row between center"
          style={{
            maxWidth: 1280, margin: '0 auto', padding: '14px 32px',
            gap: 16, flexWrap: 'wrap',
          }}
        >
          <div className="row center gap-3" style={{ flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
              <Icon name="bolt" size={12}/> Flash Deal
            </span>
            <span style={{ fontSize: 14 }}>
              Gains <em>{multStr}</em>
              {deal.proName ? <> — <strong>{deal.proName}</strong></> : null}
              {deal.proSector ? <span className="muted" style={{ marginLeft: 6 }}>· {deal.proSector}</span> : null}
            </span>
            <span className="muted" style={{ fontSize: 12, textDecoration: 'underline' }}>Voir le détail →</span>
          </div>
          <div className="row center gap-2 mono tnum" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            <span>{h}</span>:<span>{m}</span>:<span>{s}</span>
            <span className="muted" style={{ marginLeft: 6 }}>restantes</span>
          </div>
        </div>
      </section>
      {open && (
        <FlashDealModal
          deal={deal}
          remainingHms={`${h}:${m}:${s}`}
          go={go}
          onClose={() => setOpen(false)}
          onAfterDecision={async () => { await load(); setOpen(false); }}
        />
      )}
    </>
  );
}

function FlashDealModal({ deal, remainingHms, go, onClose, onAfterDecision }) {
  const [submitting, setSubmitting] = useState(null); // 'accept' | 'refuse' | null
  const [error, setError] = useState(null);
  const multStr = fmtMultiplier(deal.multiplier);
  const rewardEur = (Number(deal.costPerContactCents ?? 0) / 100)
    .toFixed(2).replace('.', ',');
  const requiredLabels = (deal.requiredTierKeys || []).map(k => TIER_KEY_LABEL_FR[k] || k);
  const missingLabels = (deal.missingTierKeys || []).map(k => TIER_KEY_LABEL_FR[k] || k);

  // Décide quelle action est possible :
  // 'auth'        → anonyme, on redirige vers /auth
  // 'fill_data'   → connecté mais des paliers requis sont vides
  // 'decide'      → connecté, relation pending, on peut accepter/refuser
  // 'no_match'    → connecté, pas de relation, données complètes (hors ciblage)
  // 'already_<status>' → relation existante mais pas pending
  let mode;
  if (!deal.isAuthenticated) mode = 'auth';
  else if (deal.relationStatus === 'pending') mode = 'decide';
  else if (deal.relationStatus) mode = 'already_' + deal.relationStatus;
  else if (Array.isArray(deal.missingTierKeys) && deal.missingTierKeys.length > 0) mode = 'fill_data';
  else mode = 'no_match';

  const decide = async (action) => {
    if (!deal.relationId) return;
    setSubmitting(action);
    setError(null);
    try {
      const r = await fetch(`/api/prospect/relations/${deal.relationId}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'Erreur');
      }
      if (onAfterDecision) await onAfterDecision();
    } catch (e) {
      setError(e.message || 'Impossible de traiter votre décision.');
    } finally {
      setSubmitting(null);
    }
  };

  const goToAuth = () => { onClose(); go ? go('auth') : (window.location.hash = 'auth'); };
  const goToDonnees = () => {
    onClose();
    if (go) go('prospect?tab=donnees');
    else window.location.hash = 'prospect?tab=donnees';
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,22,41,.55)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flash-deal-modal"
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--paper)', borderRadius: 16,
          padding: 'clamp(20px, 4vw, 30px)',
          boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
          margin: 'auto 0',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
              <Icon name="bolt" size={11}/> Flash Deal
            </span>
            <span className="mono" style={{
              fontSize: 11, fontWeight: 700,
              padding: '3px 9px', borderRadius: 999,
              background: 'color-mix(in oklab, #B91C1C 12%, var(--paper))',
              border: '1px solid color-mix(in oklab, #B91C1C 30%, var(--line))',
              color: '#B91C1C',
            }}>Gains {multStr}</span>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 4 }}>
            <Icon name="close" size={16}/>
          </button>
        </div>

        <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 4 }}>
          {deal.proName || 'BUUPP'}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
          {deal.proSector ? deal.proSector + ' · ' : ''}{deal.name}
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'var(--ink)', color: 'var(--paper)',
          marginBottom: 14,
        }}>
          <div className="mono caps" style={{ fontSize: 10, letterSpacing: '.12em', color: '#A8AFC0' }}>
            Récompense
          </div>
          <div className="serif tnum" style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>
            {rewardEur} €
          </div>
          <div style={{ fontSize: 12, color: '#A8AFC0', marginTop: 4 }}>
            Gains multipliés <strong style={{ color: '#FFFEF8' }}>{multStr}</strong> — fenêtre éclair
          </div>
        </div>

        <div className="row center gap-2" style={{ marginBottom: 16, fontSize: 13, color: 'var(--ink-2)' }}>
          <Icon name="clock" size={14}/>
          <span>Plus que <strong className="mono tnum">{remainingHms}</strong> pour décider.</span>
        </div>

        {deal.brief && (
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
            marginBottom: 14, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)',
          }}>
            <div className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.12em', marginBottom: 4 }}>
              Le mot du professionnel
            </div>
            <div>« {deal.brief} »</div>
          </div>
        )}

        {requiredLabels.length > 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Données demandées :{' '}
            {requiredLabels.map((l, i) => (
              <span key={i} className="chip" style={{ fontSize: 11, padding: '2px 8px', marginRight: 4, marginBottom: 4 }}>
                {l}
              </span>
            ))}
          </div>
        )}

        {/* États ─────────────────────────────────────────────────── */}

        {mode === 'auth' && (
          <>
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'color-mix(in oklab, var(--accent) 7%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--line))',
              fontSize: 13, color: 'var(--ink-2)', marginBottom: 14,
            }}>
              Pour accepter ou refuser cette offre, vous devez d'abord créer votre compte BUUPP.
            </div>
            <button onClick={goToAuth} className="btn btn-lg" style={{
              width: '100%', justifyContent: 'center', background: 'var(--ink)', color: 'var(--paper)',
            }}>
              Créer un compte / Se connecter <Icon name="arrow" size={14}/>
            </button>
          </>
        )}

        {mode === 'decide' && (
          <>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              <button
                onClick={() => decide('refuse')}
                disabled={!!submitting}
                className="btn"
                style={{
                  flex: '1 1 160px', justifyContent: 'center',
                  background: 'var(--paper)', color: 'var(--ink)', border: '1.5px solid var(--line-2)',
                  opacity: submitting && submitting !== 'refuse' ? 0.5 : 1,
                }}>
                {submitting === 'refuse' ? 'Refus en cours…' : 'Refuser'}
              </button>
              <button
                onClick={() => decide('accept')}
                disabled={!!submitting}
                className="btn"
                style={{
                  flex: '1 1 160px', justifyContent: 'center',
                  background: 'var(--ink)', color: 'var(--paper)',
                  opacity: submitting && submitting !== 'accept' ? 0.5 : 1,
                }}>
                {submitting === 'accept' ? 'Acceptation…' : <>Accepter <Icon name="check" size={13}/></>}
              </button>
            </div>
            {error && (
              <div role="alert" style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B', fontSize: 13,
              }}>{error}</div>
            )}
          </>
        )}

        {mode === 'fill_data' && (
          <>
            <div role="alert" style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'color-mix(in oklab, #B45309 7%, var(--paper))',
              border: '1px solid color-mix(in oklab, #B45309 30%, var(--line))',
              fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 14,
            }}>
              {deal.proName || 'Le professionnel'} souhaite obtenir vos données de
              {' '}<strong style={{ color: '#B45309' }}>
                {missingLabels.length === 1
                  ? missingLabels[0]
                  : missingLabels.slice(0, -1).join(', ') + ' et ' + missingLabels.slice(-1)}
              </strong>, mais vous ne les avez pas encore renseignées.
              Complétez votre profil pour pouvoir bénéficier de cette offre.
            </div>
            <button onClick={goToDonnees} className="btn btn-lg" style={{
              width: '100%', justifyContent: 'center', background: 'var(--ink)', color: 'var(--paper)',
            }}>
              Compléter mes données <Icon name="arrow" size={14}/>
            </button>
          </>
        )}

        {mode === 'no_match' && (
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55,
          }}>
            Cette campagne ne correspond pas à votre profil (zone géographique, tranche d'âge ou centres d'intérêt). Aucune action n'est nécessaire.
          </div>
        )}

        {mode && mode.startsWith('already_') && (
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
            fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55,
          }}>
            {mode === 'already_accepted' && '✓ Vous avez déjà accepté cette sollicitation.'}
            {mode === 'already_refused'  && 'Vous avez refusé cette sollicitation.'}
            {mode === 'already_expired'  && 'Cette sollicitation a expiré.'}
            {mode === 'already_settled'  && '✓ Sollicitation acceptée — gains crédités.'}
          </div>
        )}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Créez votre profil', body: "Renseignez uniquement ce que vous acceptez de partager, par paliers. Chaque palier validé augmente votre BUUPP Score et vos gains potentiels." },
    { n: '02', title: 'Choisissez vos contacts', body: "Vous recevez des demandes ciblées et vérifiées. 72 heures pour accepter ou refuser. Le double consentement est obligatoire." },
    { n: '03', title: 'Encaissez vos gains', body: "Chaque mise en relation acceptée crédite votre portefeuille en BUUPP Coins. Retrait par IBAN, carte cadeau ou don associatif." },
  ];
  return (
    <section id="prospects" style={{ padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ marginBottom: 56, flexWrap: 'wrap', gap: 32, alignItems: 'flex-end' }}>
          <div style={{ maxWidth: 720 }}>
            <div className="mono caps" style={{ fontSize: 11, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 18 }}>
              — Pour les prospects
            </div>
            <h2 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 72px)', lineHeight: 1.05 }}>
              Enfin <em>rémunéré</em><br/>pour votre attention.
            </h2>
            <p className="muted" style={{ fontSize: 18, lineHeight: 1.55, marginTop: 24, maxWidth: 560 }}>
              En trois gestes simples, vous choisissez qui peut vous contacter — et
              à quel prix. Le consentement est au centre. Aucune donnée n'est transmise
              avant que vous, puis le professionnel, ne confirmiez la mise en relation.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid var(--line)' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              padding: '40px 32px 40px 0',
              borderRight: i < 2 ? '1px solid var(--line)' : 'none',
              paddingLeft: i > 0 ? 32 : 0
            }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 20 }}>{s.n}</div>
              <h3 className="serif" style={{ marginBottom: 14 }}>{s.title}</h3>
              <p className="muted" style={{ fontSize: 15 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TiersTable() {
  const [verified, setVerified] = useState(false);
  return (
    <section id="tiers" style={{ padding: '80px 32px', background: 'var(--paper)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ marginBottom: 48, flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <div className="mono caps muted" style={{ marginBottom: 16 }}>— Grille de rémunération</div>
            <h2 className="serif">Cinq paliers.<br/><em>Un prix par donnée.</em></h2>
          </div>
          <label className="row center gap-3" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <span className="muted" style={{ fontSize: 14 }}>Afficher les gains Prospect vérifié 100%</span>
            <span style={{
              width: 42, height: 24, borderRadius: 999,
              background: verified ? 'var(--accent)' : 'var(--line-2)',
              position: 'relative', transition: 'background .2s'
            }} onClick={() => setVerified(!verified)}>
              <span style={{
                position: 'absolute', top: 3, left: verified ? 21 : 3,
                width: 18, height: 18, borderRadius: 999, background: 'white',
                transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.15)'
              }}/>
            </span>
          </label>
        </div>

        <div className="card" style={{ background: 'var(--ivory)', padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Palier</th>
                <th>Catégorie</th>
                <th>Exemples de données</th>
                <th style={{ textAlign: 'right', width: 200 }}>Rémunération</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map(t => (
                <tr key={t.n}>
                  <td>
                    <div className="serif tnum" style={{ fontSize: 28 }}>{t.n}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{t.name}</div>
                  </td>
                  <td className="muted">{t.ex}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="mono tnum" style={{ fontSize: 14 }}>
                      {verified ? (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: 'var(--ink-5)', marginRight: 8 }}>
                            {t.range}
                          </span>
                          <span style={{ color: 'var(--accent)' }}>
                            {t.low === t.high
                              ? `minimum ${(t.low * 2).toFixed(2).replace('.', ',')} €`
                              : `${(t.low * 2).toFixed(2).replace('.', ',')} € – ${(t.high * 2).toFixed(2).replace('.', ',')} €`}
                          </span>
                        </span>
                      ) : t.range}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--ivory-2)' }}
               className="row between center">
            <div className="muted" style={{ fontSize: 13 }}>
              <Icon name="sparkle" size={13}/> <span style={{ marginLeft: 6, verticalAlign: 'middle' }}>Prospect vérifié 100% → gains doublés ×2</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              60% reversé au prospect · 40% plateforme &amp; fiscalité
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreSection() {
  return (
    <section style={{ padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 16 }}>— BUUPP Score</div>
          <h2 className="serif" style={{ marginBottom: 24 }}>Un indice de <em>désirabilité</em> transparent.</h2>
          <p className="muted" style={{ fontSize: 17, marginBottom: 32, maxWidth: 520 }}>
            Votre score évolue selon la complétude de vos paliers KYC, la fraîcheur de vos données
            et votre taux d'acceptation. Un score élevé attire des demandes plus exigeantes et mieux
            rémunérées.
          </p>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            {[
              ['0–399', 'Découverte', '#B91C1C'],
              ['400–699', 'Solide', '#A16207'],
              ['700–899', 'Recherché', 'var(--accent)'],
              ['900–1000', 'Prestige', '#166534'],
            ].map(([r, n, c], i) => (
              <div key={i} className="col gap-1">
                <div className="mono tnum" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{r}</div>
                <div style={{ fontSize: 15, fontFamily: 'var(--serif)', color: c }}>{n}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="row center" style={{ justifyContent: 'center' }}>
            <ScoreGauge value={742} size={220} />
          </div>
          <div className="serif" style={{ fontSize: 20, marginTop: 24 }}>Marie L. — <em>Recherchée</em></div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Profil vérifié · 3 paliers validés · 12 mises en relation
          </div>
          <div style={{ marginTop: 28, borderTop: '1px solid var(--line)', paddingTop: 20, textAlign: 'left' }}>
            {[
              ['Complétude des paliers', 80],
              ['Fraîcheur des données', 92],
              ['Taux d\'acceptation', 66],
            ].map(([l, v], i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div className="row between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span className="muted">{l}</span>
                  <span className="mono tnum">{v}%</span>
                </div>
                <Progress value={v/100} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const pillars = [
    { t: 'RGPD natif', d: "Double consentement explicite, registre de traitement complet, droit à l'effacement en un clic." },
    { t: 'Consentement à usage unique', d: "Chaque accord donné est strictement limité à une seule campagne et à son émetteur. Les données ne peuvent être réutilisées, revendues, ni réactivées pour un autre usage." },
    { t: 'Anti-fraude multicouche', d: "Honeypots, détection de comptes dupliqués, empreinte appareil, scoring comportemental en temps réel." },
    { t: 'Watermarking des données', d: "Chaque fiche transmise est marquée individuellement — toute fuite est traçable jusqu'au professionnel émetteur." },
  ];
  return (
    <section style={{ padding: '120px 32px', background: 'var(--ink)', color: 'var(--paper)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ marginBottom: 64, flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div className="mono caps" style={{ color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>— Sécurité &amp; conformité</div>
            <h2 className="serif" style={{ color: 'var(--paper)', maxWidth: 720 }}>
              Une architecture pensée pour que <em style={{color: '#A5B4FC'}}>vos données</em> ne fuitent pas.
            </h2>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,.08)' }}>
          {pillars.map((p, i) => (
            <div key={i} style={{ background: 'var(--ink)', padding: '28px 24px' }}>
              <div className="mono" style={{ fontSize: 10, color: '#A5B4FC', marginBottom: 14 }}>0{i + 1}</div>
              <div className="serif" style={{ fontSize: 22, marginBottom: 10, color: 'var(--paper)' }}>{p.t}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    ['2', 'consentements requis', 'Prospect + professionnel. Sans accord explicite des deux, aucune donnée n\'est transmise.'],
    ['5', 'paliers de données', 'De l\'identification au patrimoine — chaque palier est cloisonné et monétisé séparément.'],
    ['60%', 'reversé au prospect', 'De la valeur brute de chaque mise en relation. Le reste couvre la fiscalité et la plateforme.'],
  ];
  return (
    <section style={{ padding: '100px 32px', background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid var(--line)' }}>
          {stats.map(([n, l, d], i) => (
            <div key={i} style={{
              padding: '40px 32px 0 0',
              borderRight: i < 2 ? '1px solid var(--line)' : 'none',
              paddingLeft: i > 0 ? 32 : 0,
            }}>
              <div className="serif tnum" style={{ fontSize: 120, lineHeight: 1, letterSpacing: '-0.04em' }}>
                {n}
              </div>
              <div className="serif italic muted" style={{ fontSize: 18, marginTop: 4 }}>{l}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 14, maxWidth: 300 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ go }) {
  return (
    <section id="tarifs" style={{ padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 56, maxWidth: 640 }}>
          <div className="mono caps muted" style={{ marginBottom: 16 }}>— Tarifs professionnels</div>
          <h2 className="serif">Deux plans. <em>Sans engagement.</em></h2>
          <p className="muted" style={{ fontSize: 17, marginTop: 16 }}>
            Les prospects paient zéro — ils gagnent. Les professionnels paient à la qualité,
            pas au clic douteux.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <PricingCard
            name="Starter"
            price="19"
            priceSuffix="€ / 2 campagnes"
            features={[
              "Jusqu'à 50 prospects par campagne",
              '2 campagnes par cycle',
              'Ciblage par paliers 1–3',
            ]}
            cta="Démarrer en Starter"
            go={() => go('auth')}
          />
          <PricingCard
            name="Pro"
            price="89"
            priceSuffix="€ / 10 campagnes"
            featured
            features={[
              "Jusqu'à 500 prospects par campagne",
              '10 campagnes par cycle',
              'Tous les paliers 1–5',
              'Accès anticipé aux nouvelles fonctionnalités',
            ]}
            cta="Passer en Pro"
            go={() => go('auth')}
          />
        </div>
      </div>
    </section>
  );
}

function PricingCard({ name, price, priceSuffix = '€ / campagne', features, cta, featured, go }) {
  return (
    <div className="card" style={{
      padding: 40,
      background: featured ? 'var(--ink)' : 'var(--paper)',
      color: featured ? 'var(--paper)' : 'var(--ink)',
      borderColor: featured ? 'var(--ink)' : 'var(--line)',
      position: 'relative'
    }}>
      {featured && (
        <div className="mono" style={{
          position: 'absolute', top: 24, right: 24,
          fontSize: 10, padding: '4px 10px', borderRadius: 999,
          background: '#A5B4FC', color: 'var(--ink)', letterSpacing: '.1em'
        }}>RECOMMANDÉ</div>
      )}
      <div className="serif" style={{ fontSize: 36, color: featured ? 'var(--paper)' : 'var(--ink)' }}>{name}</div>
      <div className="row" style={{ alignItems: 'baseline', marginTop: 24, gap: 8 }}>
        <span className="serif tnum" style={{ fontSize: 80, lineHeight: 1, color: featured ? 'var(--paper)' : 'var(--ink)' }}>{price}</span>
        <span style={{ fontSize: 16, color: featured ? 'rgba(255,255,255,.6)' : 'var(--ink-4)' }}>{priceSuffix}</span>
      </div>
      <div style={{ marginTop: 32, borderTop: `1px solid ${featured ? 'rgba(255,255,255,.1)' : 'var(--line)'}`, paddingTop: 24 }}>
        {features.map((f, i) => (
          <div key={i} className="row center gap-3" style={{ padding: '8px 0', fontSize: 14 }}>
            <Icon name="check" size={14} stroke={1.75}/>
            <span dangerouslySetInnerHTML={{__html: f}} style={{ color: featured ? 'rgba(255,255,255,.86)' : 'var(--ink-3)' }}/>
          </div>
        ))}
      </div>
      <button onClick={go} className="btn btn-lg" style={{
        width: '100%', marginTop: 32, justifyContent: 'center',
        background: featured ? 'var(--paper)' : 'var(--ink)',
        color: featured ? 'var(--ink)' : 'var(--paper)'
      }}>
        {cta} <Icon name="arrow" size={14}/>
      </button>
    </div>
  );
}

function ProsSection({ go }) {
  const benefits = [
    { ic: 'check', t: 'Des prospects qui acceptent vraiment', d: "Chaque contact dans votre base a dit oui, explicitement, à votre offre précise. Pas d'achat de fichier, pas de scraping, pas de cold call qui tombe dans le vide." },
    { ic: 'target', t: 'Ciblage par paliers de données', d: "Payez uniquement pour ce dont vous avez besoin : identification, localisation, style de vie, profession, patrimoine. Budget maîtrisé au centime." },
    { ic: 'wallet', hi: true, t: 'Vous ne payez que les acceptations', d: "Zéro frais caché, zéro clic douteux : vous n'êtes facturé que pour les prospects qui ont explicitement accepté la mise en relation. Les refus et expirations sont gratuits.", featured: true },
    { ic: 'trend', t: 'ROI ×3 à ×5 en moyenne', d: "Taux d'acceptation moyen de 62% contre 1 à 3% sur les canaux froids. Vos équipes commerciales passent leur temps sur des conversations qui convertissent." },
    { ic: 'gauge', t: 'BUUPP Score : qualité mesurée', d: "Chaque prospect est noté sur 900 points selon la qualité de son profil et son historique. Filtrez à partir du score minimum qui vous convient." },
    { ic: 'bolt', t: 'Mise en relation en 24 h', d: "Campagne créée le matin, premiers rendez-vous pris le soir. Plus d'intermédiaires, plus d'agences, plus de délais." },
  ];

  const useCases = [
    ['Artisan', 'Menuisier, plombier, cuisiniste', 'Rayon 30 km', '42 devis/mois', '4,20 €/contact'],
    ['Professions libérales', 'Kiné, dentiste, coach', 'Rayon 15 km', '28 RDV/mois', '5,80 €/contact'],
    ['Agences immobilières', 'Vente, location, gestion', 'Rayon 20 km', '65 leads/mois', '7,40 €/contact'],
    ['SaaS & B2B', 'Éditeurs, cabinets conseil', 'National', '180 DL/mois', '2,90 €/contact'],
  ];

  return (
    <section id="pros" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '120px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 64, gap: 32, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 640 }}>
            <div className="mono caps" style={{ fontSize: 11, letterSpacing: '.18em', color: '#A5B4FC', marginBottom: 18 }}>
              — Pour les professionnels
            </div>
            <h2 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 72px)', color: 'var(--paper)', lineHeight: 1.05 }}>
              Arrêtez de prospecter.<br/>
              <em style={{ color: '#A5B4FC' }}>Laissez vos prospects venir.</em>
            </h2>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,.72)', marginTop: 24 }}>
              L'inbound, vraiment. Des contacts qui ont eux-mêmes accepté d'être approchés,
              pour des campagnes qui correspondent à leur profil et à leur moment de vie.
            </p>
          </div>
          <div className="row gap-3">
            <button className="btn btn-lg" style={{ background: 'var(--paper)', color: 'var(--ink)' }} onClick={() => go('pro')}>
              Ouvrir un compte pro <Icon name="arrow" size={14}/>
            </button>
            <button className="btn btn-lg btn-ghost" style={{ color: 'var(--paper)', borderColor: 'rgba(255,255,255,.28)' }}>
              Voir une démo
            </button>
          </div>
        </div>

        {/* 6 benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 80 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{
              padding: 32,
              background: b.hi ? 'linear-gradient(160deg, rgba(165,180,252,.18) 0%, rgba(165,180,252,.06) 40%, #0F1629 100%)' : '#0F1629',
              position: 'relative',
              boxShadow: b.hi ? 'inset 0 0 0 1px rgba(165,180,252,.35)' : 'none',
            }}>
              {b.hi && (
                <div className="mono" style={{
                  position: 'absolute', top: 18, right: 18,
                  fontSize: 9, padding: '3px 8px', borderRadius: 999,
                  background: '#A5B4FC', color: '#0F1629', letterSpacing: '.14em', fontWeight: 600
                }}>
                  LE + BUUPP
                </div>
              )}
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: b.hi ? 'rgba(165,180,252,.22)' : 'rgba(165,180,252,.12)',
                color: '#A5B4FC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
              }}>
                <Icon name={b.ic} size={18}/>
              </div>
              <div className="serif" style={{ fontSize: 22, color: 'var(--paper)', marginBottom: 10, letterSpacing: '-0.01em' }}>{b.t}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: b.hi ? 'rgba(255,255,255,.78)' : 'rgba(255,255,255,.6)' }}>{b.d}</div>
            </div>
          ))}
        </div>

        {/* Comparaison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 80 }}>
          <div style={{ padding: 36, borderRadius: 14, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.02)' }}>
            <div className="mono caps" style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.15em', marginBottom: 16 }}>— Prospection classique</div>
            <div className="serif" style={{ fontSize: 26, color: 'rgba(255,255,255,.7)', marginBottom: 24 }}>Le cold call, l'achat de fichier, la pub display</div>
            {[
              ['1–3%', "taux d'acceptation"],
              ['< 10%', 'conformité RGPD mesurée'],
              ['120 €', 'coût moyen d\'un lead qualifié'],
              ['⊘', 'aucune traçabilité du consentement'],
            ].map((r, i) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none', fontSize: 14 }}>
                <span style={{ color: 'rgba(255,255,255,.6)' }}>{r[1]}</span>
                <span className="serif tnum" style={{ fontSize: 20, color: 'rgba(255,255,255,.85)' }}>{r[0]}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 36, borderRadius: 14, border: '1px solid #A5B4FC', background: 'linear-gradient(180deg, rgba(165,180,252,.06), transparent)', position: 'relative' }}>
            <div className="mono caps" style={{ fontSize: 11, color: '#A5B4FC', letterSpacing: '.15em', marginBottom: 16 }}>— Avec BUUPP</div>
            <div className="serif" style={{ fontSize: 26, color: 'var(--paper)', marginBottom: 24 }}>Le prospect <em style={{ color: '#A5B4FC' }}>accepte</em> avant même que vous parliez</div>
            {[
              ['62%', "taux d'acceptation moyen"],
              ['100%', 'double consentement horodaté'],
              ['5,40 €', 'coût moyen d\'un contact qualifié'],
              ['✓', 'watermarking + piste d\'audit complète'],
            ].map((r, i) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderTop: i ? '1px solid rgba(165,180,252,.15)' : 'none', fontSize: 14 }}>
                <span style={{ color: 'rgba(255,255,255,.7)' }}>{r[1]}</span>
                <span className="serif tnum" style={{ fontSize: 20, color: '#A5B4FC' }}>{r[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cas d'usage */}
        <div>
          <div className="mono caps" style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.18em', marginBottom: 24 }}>
            — Ils prospectent mieux avec BUUPP
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {useCases.map((u, i) => (
              <div key={i} style={{ padding: 24, border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, background: 'rgba(255,255,255,.02)' }}>
                <div className="serif" style={{ fontSize: 22, color: 'var(--paper)' }}>{u[0]}</div>
                <div className="muted" style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4, marginBottom: 20 }}>{u[1]}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>{u[2]}</div>
                <div className="serif tnum" style={{ fontSize: 18, color: 'var(--paper)' }}>{u[3]}</div>
                <div className="mono" style={{ fontSize: 11, color: '#A5B4FC', marginTop: 4 }}>{u[4]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Journal() {
  const articles = [
    {
      tag: 'Manifeste',
      date: '02 avril 2026',
      read: '6 min',
      title: "La fin du consentement truqué",
      excerpt: "Pourquoi les bandeaux cookies sont devenus l'arme par excellence de la publicité non consentie — et comment inverser le rapport de force en partant de la valeur."
    },
    {
      tag: 'Enquête',
      date: '28 mars 2026',
      read: '11 min',
      title: "Combien valent vos données, vraiment ?",
      excerpt: "Nous avons analysé 140 000 transactions sur le marché secondaire de la donnée. Verdict : un particulier rapporte en moyenne 284 € par an aux annonceurs. Il n'en touche rien."
    },
    {
      tag: 'Product',
      date: '19 mars 2026',
      read: '4 min',
      title: "Ce qui change avec le BUUPP Score v2",
      excerpt: "Nouvelle pondération, prise en compte du taux de réponse historique, certification par tiers : ce qui évolue pour les prospects et pour les professionnels."
    },
  ];

  return (
    <section id="journal" style={{ padding: '120px 32px', background: 'var(--paper)', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 56, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="mono caps muted" style={{ fontSize: 11, letterSpacing: '.18em', marginBottom: 14 }}>— Journal</div>
            <h2 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1.05 }}>
              Penser la publicité, <em>autrement.</em>
            </h2>
            <p className="muted" style={{ fontSize: 16, maxWidth: 560, marginTop: 18, lineHeight: 1.55 }}>
              Tribunes, enquêtes et notes produit : ce que nous apprenons en construisant la première plateforme de publicité inversée en Europe.
            </p>
          </div>
          <a className="btn btn-ghost">Tous les articles <Icon name="arrow" size={14}/></a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 24 }}>
          {/* Featured */}
          <article style={{ gridRow: 'span 1', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              aspectRatio: '16 / 11', borderRadius: 14, overflow: 'hidden',
              background: 'linear-gradient(135deg, #0F1629 0%, #1E1B4B 100%)',
              position: 'relative', marginBottom: 24
            }}>
              {/* grid pattern inside */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}/>
              <div style={{
                position: 'absolute', top: '-120px', right: '-100px', width: '360px', height: '360px',
                background: 'radial-gradient(closest-side, rgba(249,115,22,.35), transparent 70%)'
              }}/>
              <div style={{ position: 'absolute', inset: 0, padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div className="mono caps" style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', letterSpacing: '.18em' }}>Manifeste</div>
                <div className="serif" style={{ fontSize: 42, color: 'var(--paper)', lineHeight: 1.05, marginTop: 12, letterSpacing: '-0.02em' }}>
                  La fin du consentement <em style={{ color: '#FCA5A5' }}>truqué</em>
                </div>
              </div>
            </div>
            <div className="row gap-3 muted" style={{ fontSize: 12 }}>
              <span className="chip">À la une</span>
              <span>02 avril 2026</span>
              <span>·</span>
              <span>6 min de lecture</span>
            </div>
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-3)' }}>
              Pourquoi les bandeaux cookies sont devenus l'arme par excellence de la publicité non consentie — et comment inverser le rapport de force en partant de la valeur.
            </p>
            <a className="row center gap-2" style={{ fontSize: 14, color: 'var(--accent)', marginTop: 16, fontWeight: 500 }}>Lire l'article <Icon name="arrow" size={12}/></a>
          </article>

          {/* Other articles */}
          <div className="col gap-5" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {articles.slice(1).map((a, i) => (
              <article key={i} className="col" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 24 }}>
                <div className="row gap-3" style={{ marginBottom: 14, fontSize: 12 }}>
                  <span className="chip">{a.tag}</span>
                  <span className="muted">{a.date}</span>
                </div>
                <div className="serif" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.01em' }}>{a.title}</div>
                <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, marginTop: 12, flex: 1 }}>{a.excerpt}</p>
                <div className="row between center" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{a.read} de lecture</span>
                  <a style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Lire →</a>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Newsletter */}
        <div className="card" style={{ marginTop: 56, padding: 36, background: 'var(--ivory-2)', border: '1px dashed var(--line-2)' }}>
          <div className="row between center" style={{ gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className="serif" style={{ fontSize: 28, letterSpacing: '-0.01em' }}>La <em>Lettre BUUPP</em> — un mercredi sur deux.</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>Une idée, une donnée, une histoire. Lue par 18 400 personnes qui pensent comme vous.</div>
            </div>
            <div className="row gap-2" style={{ minWidth: 360 }}>
              <input className="input" placeholder="votre@email.fr" style={{ flex: 1 }}/>
              <button className="btn btn-primary">S'abonner</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ go }) {
  return (
    <section style={{ padding: '120px 32px', background: 'var(--ivory-2)', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="serif" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          Be <em>Used.</em> Paid. <em>Proud.</em>
        </h2>
        <p className="muted" style={{ fontSize: 18, marginTop: 24, maxWidth: 600, margin: '24px auto 0' }}>
          La publicité qui vous rémunère, enfin. Sans spam, sans fuite,
          sans le sentiment d'être le produit.
        </p>
        <div className="row center gap-3" style={{ justifyContent: 'center', marginTop: 40 }}>
          <button className="btn btn-lg btn-primary" onClick={() => go('prospect')}>
            Créer mon profil prospect
          </button>
          <button className="btn btn-lg btn-ghost" onClick={() => go('pro')}>
            Ouvrir un compte pro
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '64px 32px 32px', background: 'var(--ink)', color: 'rgba(255,255,255,.6)', fontSize: 13 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 40, marginBottom: 48, alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 320 }}>
            <Logo size={26} color="var(--paper)" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            <div style={{ marginTop: 20, fontSize: 13, lineHeight: 1.6 }}>
              BUUPP SAS · 12 rue du Sentier, 75002 Paris · RCS Paris 908 214 009 · Agréé
              intermédiaire en opérations de banque.
            </div>
          </div>
          {[
            ['Plateforme', ['Prospects', 'Professionnels', 'Tarifs', 'API']],
            ['Ressources', ['Barème des paliers', 'Documentation', 'API', 'Status']],
            ['Légal', ['CGU', 'CGV', 'RGPD', 'Contact DPO']],
          ].map(([h, items], i) => (
            <div key={i}>
              <div className="mono caps" style={{ color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>{h}</div>
              {items.map(it => <div key={it} style={{ padding: '4px 0' }}>{it}</div>)}
            </div>
          ))}
        </div>
        <div className="row between" style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 20, fontSize: 12 }}>
          <div>© 2026 BUUPP SAS. Tous droits réservés.</div>
          <div className="row gap-4"><span>Français</span><span>EUR €</span></div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Landing });
