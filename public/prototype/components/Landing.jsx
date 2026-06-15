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
  { n: 1, name: 'Identification', ex: 'email, nom, téléphone', range: 'minimum 1,00 €', low: 1.00, high: 1.00 },
  { n: 2, name: 'Localisation', ex: 'adresse, logement', range: '1,00 € – 2,00 €', low: 1.00, high: 2.00 },
  { n: 3, name: 'Style de vie', ex: 'habitudes, famille, véhicule', range: '2,00 € – 3,50 €', low: 2.00, high: 3.50 },
  { n: 4, name: 'Données professionnelles', ex: 'statut, secteur', range: '3,50 € – 5,00 €', low: 3.50, high: 5.00 },
  { n: 5, name: 'Patrimoine & projets', ex: 'immobilier, projets', range: '5,00 € – 10,00 €', low: 5.00, high: 10.00 },
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
      <MobileAppSection go={go} />
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
          <button className="btn btn-sm btn-primary" onClick={() => go('auth')}>
            Démarrer <Icon name="arrow" size={14}/>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ go }) {
  // Mois + année courants en français (« mai 2026 »). Prototype rendu
  // uniquement côté navigateur (iframe) → calcul inline sans risque
  // d'hydration mismatch.
  const heroPeriod = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
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
            Be Used · Paid &amp; Proud — France, {heroPeriod}
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

        {/* Live ticker — alimenté par /api/landing/recent-relations */}
        <LiveTicker/>
      </div>
    </section>
  );
}

/* Bandeau live de la home page — défile de droite à gauche les
   dernières mises en relation acceptées (status accepted ou settled),
   anonymisées côté API : secteur + ville pour le pro, prénom + initiale
   du nom pour le prospect.

   Comportement :
   - en attente de la réponse API → bandeau invisible (pas de flash)
   - succès, liste non vide → vraies données qui défilent
   - succès mais liste vide (base vierge en dev) → bandeau masqué
   - échec réseau → bandeau masqué (jamais de mock visible en prod) */
function LiveTicker() {
  const [rows, setRows] = useState(null); // null = loading | [] = vide/erreur

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      console.log('[LiveTicker] fetching /api/landing/recent-relations');
      fetch('/api/landing/recent-relations', { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(j => {
          if (cancelled) return;
          const list = Array.isArray(j?.relations) ? j.relations : [];
          console.log('[LiveTicker] received', list.length, 'relations');
          setRows(list);
        })
        .catch(err => {
          if (cancelled) return;
          console.warn('[LiveTicker] fetch failed', err);
          setRows([]);
        });
    };
    load();
    // Rafraîchit toutes les 5 minutes — assez fréquent pour rester
    // "live", assez rare pour ne pas spammer l'API.
    const t = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Tant qu'on n'a pas reçu de données (ou si la base est vide / l'API
  // KO), on n'affiche rien plutôt qu'une fausse liste — comme ça on
  // sait toujours, à l'œil, si le composant tourne.
  if (!rows || rows.length === 0) return null;

  const eurFmt = (eur) => Number(eur || 0).toFixed(2).replace('.', ',');

  return (
    <div style={{ marginTop: 72, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 24, overflow: 'hidden' }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'rgba(255,255,255,.35)', marginBottom: 14 }}>
        ● EN DIRECT — Mises en relation acceptées ces dernières heures
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div className="marquee">
          {[...Array(2)].flatMap((_, r) => rows.map((it, i) => {
            const where = [it.sector, it.city].filter(Boolean).join(' à ').trim();
            return (
              <div key={`${r}-${it.id || i}`} className="row center gap-3" style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                <span style={{ color: 'rgba(255,255,255,.4)' }}>◇</span>
                <span>{where || it.sector || it.city || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,.4)' }}>→</span>
                <span>{it.prenomMasked}</span>
                <span className="mono" style={{ color: '#A5B4FC' }}>+{eurFmt(it.rewardEur)} €</span>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
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
            price="59"
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

/* ─────────────────────────────────────────────────────────────────────────
   Section App mobile : annonce le lancement iOS/Android avec 3 téléphones en
   éventail dont la couleur change selon le thème choisi (buupp / sombre /
   forest / fushia — les 4 thèmes de l'app mobile). Chaque téléphone empile
   une couche d'image par thème ; seule l'active est visible (crossfade).
   Assets attendus : /prototype/app-screens/{1,2,3}-{buupp,sombre,forest,fushia}.png
   (captures brutes, ratio ~9:19.5). Tant qu'ils manquent, un placeholder
   teinté s'affiche pour ne pas casser le rendu.
   ───────────────────────────────────────────────────────────────────────── */
const APP_THEMES = [
  { key: 'buupp',  label: 'buupp',  accent: '#4F46E5', bg: '#EEF1FF', dark: false },
  { key: 'sombre', label: 'sombre', accent: '#7D74FF', bg: '#171C2E', dark: true  },
  { key: 'forest', label: 'forest', accent: '#2F8D5B', bg: '#E7F2E5', dark: false },
  { key: 'fushia', label: 'fushia', accent: '#D63B80', bg: '#FBE6F0', dark: false },
];

const APP_SLOGANS = [
  'Vous allez adorer l’application BUUPP',
  'Il y en a pour tous les goûts et toutes les couleurs',
  'Adoptez votre style',
];

/* Tons dérivés d'un thème pour les écrans maquettés (exemples en attendant
   les vraies captures). */
function appTones(theme) {
  const dark = theme.dark;
  return {
    dark,
    accent: theme.accent,
    page: theme.bg,
    surface: dark ? '#181D2D' : '#FFFFFF',
    text: dark ? '#ECEEF5' : '#0F1629',
    sub: dark ? '#A3ABBC' : '#6B7384',
    line: dark ? 'rgba(255,255,255,.09)' : 'rgba(15,22,41,.07)',
    soft: dark ? 'rgba(255,255,255,.05)' : `${theme.accent}12`,
  };
}

function AppMockBar({ c }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px 2px', fontSize: 9, fontWeight: 600, color: c.text }}>
      <span>9:41</span>
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
        <span style={{ width: 14, height: 7, borderRadius: 2, border: `1px solid ${c.text}`, opacity: .7 }}/>
      </span>
    </div>
  );
}

/* Couronne or scintillante du fondateur Proud (même esprit que le popup mobile). */
function FounderCrown({ size = 13 }) {
  return (
    <span className="crown-spark" style={{ display: 'inline-flex', position: 'relative', lineHeight: 0 }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="founderCrownGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE9A8" />
            <stop offset="48%" stopColor="#F5C84B" />
            <stop offset="100%" stopColor="#D99A2B" />
          </linearGradient>
        </defs>
        <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" fill="url(#founderCrownGold)" stroke="#B8791E" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="12" cy="6.2" r="1.2" fill="#FFF3CC" stroke="#B8791E" strokeWidth=".6" />
      </svg>
      <span className="spk"  style={{ position: 'absolute', top: -3, right: -4, color: '#FFEEA8', fontSize: size * 0.6 }}>✦</span>
      <span className="spk2" style={{ position: 'absolute', bottom: -3, left: -4, color: '#FFF6D0', fontSize: size * 0.45 }}>✦</span>
    </span>
  );
}

function AppMockRow({ c, label, sub, amount, pos, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${c.line}` }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: c.soft, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 8, color: c.sub }}>{sub}</div>
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: pos ? c.accent : c.text }}>{amount}</div>
    </div>
  );
}

function AppMockScreen({ n, theme }) {
  const c = appTones(theme);
  const wrap = { position: 'absolute', inset: 0, background: c.page, fontFamily: 'var(--sans)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
  const body = { flex: 1, padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 };
  const title = (t) => <div style={{ fontSize: 13, fontWeight: 700, color: c.text, textAlign: 'left' }}>{t}</div>;

  if (n === 1) {
    return (
      <div style={wrap}>
        <AppMockBar c={c} />
        <div style={body}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 8.5, color: c.sub }}>Bonjour 👋</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Marie</div>
            </div>
            <span style={{ width: 26, height: 26, borderRadius: 999, background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>ML</span>
          </div>
          {/* carte portefeuille */}
          <div style={{ borderRadius: 14, padding: 13, color: '#fff', background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accent}cc 100%)`, textAlign: 'left' }}>
            <div style={{ fontSize: 8.5, opacity: .85 }}>Mon portefeuille</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>127,50 €</div>
            <div style={{ fontSize: 8.5, opacity: .9, marginTop: 2 }}>+ 12,40 € ce mois-ci</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['Gains', '34'], ['Score', '82']].map(([k, v]) => (
              <div key={k} style={{ flex: 1, borderRadius: 11, padding: '9px 10px', background: c.surface, border: `1px solid ${c.line}`, textAlign: 'left' }}>
                <div style={{ fontSize: 8, color: c.sub }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{v}</div>
              </div>
            ))}
          </div>
          {title('Activité récente')}
          <div style={{ borderRadius: 11, padding: '2px 11px', background: c.surface, border: `1px solid ${c.line}` }}>
            <AppMockRow c={c} icon="📍" label="Données localisation" sub="Aujourd’hui" amount="+2,00 €" pos />
            <AppMockRow c={c} icon="🤝" label="Parrainage · Léa" sub="Hier" amount="+5,00 €" pos />
            <AppMockRow c={c} icon="🌿" label="Style de vie" sub="2 mai" amount="+3,50 €" pos />
          </div>
        </div>
      </div>
    );
  }

  if (n === 2) {
    return (
      <div style={wrap}>
        <AppMockBar c={c} />
        <div style={body}>
          {title('Flash deals')}
          {/* offre éclair en vedette */}
          <div style={{ borderRadius: 14, padding: 13, background: c.surface, border: `1.5px solid ${c.accent}`, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', background: c.accent, padding: '3px 8px', borderRadius: 999 }}>OFFRE ÉCLAIR</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: c.accent }}>⏱ 19:58</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginTop: 8 }}>Assurance auto · Pro vérifié</div>
            <div style={{ fontSize: 8.5, color: c.sub, marginTop: 2 }}>Révélez votre profil et gagnez</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: c.accent, marginTop: 4 }}>+ 8,00 €</div>
          </div>
          {title('Autres opportunités')}
          <div style={{ borderRadius: 11, padding: '2px 11px', background: c.surface, border: `1px solid ${c.line}` }}>
            <AppMockRow c={c} icon="🥖" label="Boulangerie d’Or · Pro vérifié" sub="Palier 4" amount="+5,00 €" pos />
            <AppMockRow c={c} icon="🍽️" label="Restaurant 1st · Pro vérifié" sub="Palier 5" amount="+9,00 €" pos />
            <AppMockRow c={c} icon="🎭" label="Théâtre Duo · Pro vérifié" sub="Palier 2" amount="+2,00 €" pos />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <AppMockBar c={c} />
      <div style={{ ...body, alignItems: 'center' }}>
        <span style={{ width: 48, height: 48, borderRadius: 999, background: c.accent, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17, fontWeight: 700 }}>ML</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Marie L</div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: c.accent, background: c.soft, padding: '3px 9px', borderRadius: 999 }}>FONDATEUR · PROUD</span>
          <FounderCrown size={13} />
        </span>
        {/* anneau de score */}
        <div style={{ position: 'relative', width: 92, height: 92, borderRadius: 999, marginTop: 4, background: `conic-gradient(${c.accent} 82%, ${c.line} 0)` }}>
          <div style={{ position: 'absolute', inset: 9, borderRadius: 999, background: c.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: c.text }}>82</div>
            <div style={{ fontSize: 7.5, color: c.sub }}>Score de profil</div>
          </div>
        </div>
        <div style={{ width: '100%', borderRadius: 11, padding: '2px 11px', background: c.surface, border: `1px solid ${c.line}`, marginTop: 4 }}>
          <AppMockRow c={c} label="Identification" sub="Palier 1" amount="✓" />
          <AppMockRow c={c} label="Localisation" sub="Palier 2" amount="✓" />
          <AppMockRow c={c} label="Patrimoine" sub="Palier 5" amount="→" pos />
        </div>
      </div>
    </div>
  );
}

function AppThemeLayer({ n, theme, active }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: active ? 1 : 0, transition: 'opacity .55s ease' }}>
      {/* écran maquetté (exemple) tant que la vraie capture n'est pas disponible */}
      <div style={{ position: 'absolute', inset: 0, display: loaded ? 'none' : 'block' }}>
        <AppMockScreen n={n} theme={theme} />
      </div>
      <img
        src={`/prototype/app-screens/${n}-${theme.key}.png`}
        alt={`Application BUUPP — écran ${n} — thème ${theme.label}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
      />
    </div>
  );
}

function AppPhone({ n, theme, width, rotate, lift, z, margin }) {
  return (
    <div style={{
      width, aspectRatio: '9 / 19.5', position: 'relative', flex: '0 0 auto', margin,
      transform: `rotate(${rotate}deg) translateY(${lift}px)`, zIndex: z,
      transition: 'transform .4s cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'clamp(26px,3.6vw,38px)',
        background: '#0E1016', padding: '2.4%',
        boxShadow: '0 34px 64px -22px rgba(15,22,41,.5), 0 10px 22px rgba(15,22,41,.18), inset 0 0 0 1.5px rgba(255,255,255,.07)',
      }}>
        <div style={{ position: 'absolute', inset: '2.4%', borderRadius: 'clamp(20px,3vw,30px)', overflow: 'hidden', background: '#000' }}>
          {APP_THEMES.map(t => <AppThemeLayer key={t.key} n={n} theme={t} active={t.key === theme} />)}
        </div>
        {/* encoche */}
        <div style={{ position: 'absolute', top: '3%', left: '50%', transform: 'translateX(-50%)', width: '32%', height: '1.4%', minHeight: 5, borderRadius: 999, background: '#0E1016', zIndex: 5 }}/>
      </div>
    </div>
  );
}

function AppStoreBadge({ kind }) {
  const apple = kind === 'apple';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 11, padding: '11px 18px', borderRadius: 13,
      background: 'var(--ink)', color: '#FFFFFF', cursor: 'default', userSelect: 'none',
      boxShadow: '0 10px 22px -10px rgba(15,22,41,.45)',
    }}>
      {apple ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <path d="M17.05 12.04c-.03-3.16 2.58-4.67 2.7-4.75-1.47-2.15-3.76-2.45-4.57-2.48-1.94-.2-3.79 1.14-4.78 1.14-.98 0-2.5-1.11-4.11-1.08-2.11.03-4.06 1.23-5.15 3.12-2.2 3.81-.56 9.45 1.58 12.54 1.05 1.51 2.3 3.21 3.93 3.15 1.58-.06 2.18-1.02 4.09-1.02 1.91 0 2.45 1.02 4.12.99 1.7-.03 2.78-1.54 3.82-3.06 1.2-1.75 1.7-3.45 1.72-3.54-.04-.02-3.3-1.27-3.33-5.03zM14.13 4.36c.87-1.05 1.46-2.51 1.3-3.96-1.25.05-2.77.84-3.67 1.89-.81.93-1.51 2.42-1.32 3.84 1.39.11 2.81-.71 3.69-1.77z"/>
        </svg>
      ) : (
        <svg width="20" height="22" viewBox="0 0 512 512" aria-hidden>
          <path d="M48 32 L300 256 L48 480 Z" fill="#4FE0B0"/>
          <path d="M300 256 L48 32 L360 188 Z" fill="#FF6B6B"/>
          <path d="M300 256 L360 324 L48 480 Z" fill="#FFD166"/>
          <path d="M360 188 L460 244 a14 14 0 0 1 0 24 L360 324 L300 256 Z" fill="#5B8DEF"/>
        </svg>
      )}
      <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
        <div style={{ fontSize: 10, opacity: .82, fontFamily: 'var(--sans)' }}>Bientôt sur</div>
        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--sans)' }}>{apple ? 'App Store' : 'Google Play'}</div>
      </div>
    </div>
  );
}

function MobileAppSection({ go }) {
  const [theme, setTheme] = useState('buupp');
  const [slogan, setSlogan] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const active = APP_THEMES.find(t => t.key === theme) || APP_THEMES[0];

  useEffect(() => {
    const id = setInterval(() => setSlogan(s => (s + 1) % APP_SLOGANS.length), 3500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 720);
    onR();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const phones = narrow
    ? [{ n: 2, width: 'min(72vw,260px)', rotate: 0, lift: 0, z: 3, margin: 0 }]
    : [
        { n: 1, width: 'clamp(150px,17vw,205px)', rotate: -9, lift: 30, z: 1, margin: '0 -14px 0 0' },
        { n: 2, width: 'clamp(180px,21vw,250px)', rotate: 0,  lift: 0,  z: 3, margin: 0 },
        { n: 3, width: 'clamp(150px,17vw,205px)', rotate: 9,  lift: 30, z: 1, margin: '0 0 0 -14px' },
      ];

  return (
    <section id="app-mobile" style={{ position: 'relative', padding: '120px 32px', background: 'var(--ivory)', borderTop: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* halo teinté selon le thème actif */}
      <div aria-hidden style={{
        position: 'absolute', top: '40%', left: '50%', width: 760, height: 760,
        transform: 'translate(-50%,-50%)', borderRadius: '50%',
        background: `radial-gradient(circle, ${active.accent}33 0%, transparent 62%)`,
        transition: 'background .55s ease', pointerEvents: 'none',
      }}/>
      <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div className="badge" style={{ marginBottom: 22 }}>
          <span className="dot" style={{ background: active.accent, transition: 'background .4s' }}/> Au lancement officiel · iOS &amp; Android
        </div>
        <h2 className="serif" style={{ fontSize: 'clamp(34px,4.6vw,58px)', lineHeight: 1.05 }}>
          L’app BUUPP arrive <em style={{ color: active.accent, transition: 'color .4s' }}>sur mobile.</em>
        </h2>

        {/* slogans en rotation */}
        <div style={{ height: 28, marginTop: 18, position: 'relative' }}>
          {APP_SLOGANS.map((s, i) => (
            <p key={i} className="muted" style={{
              position: 'absolute', inset: 0, fontSize: 18, margin: 0,
              opacity: i === slogan ? 1 : 0, transform: i === slogan ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity .5s ease, transform .5s ease',
            }}>{s}</p>
          ))}
        </div>

        {/* éventail de téléphones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '56px 0 8px', minHeight: 470 }}>
          {phones.map(p => <AppPhone key={p.n} {...p} theme={theme} />)}
        </div>

        {/* sélecteur de thème — 4 pastilles + nom */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 26, marginTop: 36 }}>
          {APP_THEMES.map(t => {
            const on = t.key === theme;
            return (
              <button key={t.key} onClick={() => setTheme(t.key)} aria-pressed={on} title={`Thème ${t.label}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: t.dark ? '#171C2E' : t.accent,
                  boxShadow: on ? `0 0 0 2px var(--ivory), 0 0 0 4px ${t.accent}` : 'inset 0 0 0 1px rgba(15,22,41,.14)',
                  transition: 'box-shadow .2s, transform .2s', transform: on ? 'scale(1.05)' : 'scale(1)',
                  position: 'relative',
                }}>
                  {t.dark && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7D74FF', fontSize: 14 }}>◗</span>}
                </span>
                <span className="mono" style={{ fontSize: 12, color: on ? 'var(--ink)' : 'var(--ink-4)', fontWeight: on ? 600 : 400, textTransform: 'capitalize' }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* badges store (décoratifs) */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 44 }}>
          <AppStoreBadge kind="apple" />
          <AppStoreBadge kind="android" />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>Disponible au lancement officiel de BUUPP.</div>
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
