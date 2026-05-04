// Prospect dashboard
var { useState, useEffect } = React;

/* ---------- Shared prospect profile store ----------
   Single source of truth for the prospect's declared data.
   Any edits from "Mes données" ripple across:
   - header greeting ("Bonjour Marie")
   - campaign-types allowed (also shown in Préférences)
   - score panel name                                        */
const INITIAL_PROFILE = {
  identity: {
    prenom: 'Marie',
    nom: 'Leroy',
    email: 'marie.leroy@gmail.com',
    telephone: '06 12 •• •• 12',
    naissance: '14/06/1988',
  },
  localisation: {
    adresse: '24 rue Moncey',
    ville: 'Lyon 3e',
    codePostal: '69003',
    logement: 'Appartement T3',
    mobilite: 'Voiture + vélo',
  },
  vie: {
    foyer: 'Couple, 1 enfant (5 ans)',
    sports: 'Yoga, running',
    animaux: 'Chat',
    vehicule: 'Peugeot 208 (2021)',
  },
  pro: {
    poste: 'Designer produit sénior',
    statut: 'CDI',
    secteur: 'Tech / SaaS',
    revenus: '45–55 k€ / an',
  },
  patrimoine: {
    residence: 'Locataire',
    epargne: '20–50 k€',
    projets: 'Achat immobilier à 3 ans',
  },
  // Preference: true = all campaign types, else selected subset
  allCampaignTypes: true,
  campaignTypes: new Set(['Prise de contact', 'Prise de rendez-vous']),
  // Categories authorised (mirrored in Préférences)
  categories: new Set(['Bien-être', 'Artisanat', 'Coaching']),
};

/* Sollicitations entrantes envoyées par les pros via leurs campagnes.
   Exposées par le ProspectProvider pour piloter à la fois la section
   "Mises en relation" et le badge de notification dans la sidebar. */
const INITIAL_PENDING_RELATIONS = [
  {
    id: 'r1',
    pro: 'Cabinet Vitalité',
    sector: 'Kinésithérapie · Lyon 3e',
    motif: 'Prise de RDV pour un bilan postural gratuit à destination des télétravailleurs lyonnais.',
    reward: 4.20, tier: 2, timer: '14 h 22 min',
    startDate: '2026-05-02', endDate: '2026-05-09',
    brief: '1ère séance offerte aux 20 premiers inscrits.',
  },
  {
    id: 'r2',
    pro: 'Atelier Mercier',
    sector: 'Artisan menuisier · Grand Lyon',
    motif: 'Devis gratuit pour aménagement sur mesure (cuisine, dressing). Déplacement inclus.',
    reward: 3.10, tier: 2, timer: '42 h 08 min',
    startDate: '2026-04-28', endDate: '2026-05-12',
    brief: 'Remise de 10% pour tout devis signé avant le 12 mai.',
  },
  {
    id: 'r3',
    pro: 'Patrimoine & Co.',
    sector: 'Conseil en gestion · À distance',
    motif: "Audit patrimonial 30 min, sans engagement. Portefeuilles > 100 k€ principalement.",
    reward: 8.40, tier: 5, timer: '61 h 40 min',
    startDate: '2026-05-01', endDate: '2026-05-15',
    brief: 'Audit + plan d\'action remis sous 48 h.',
  },
];

const ProspectCtx = React.createContext(null);

function ProspectProvider({ children }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [deleted, setDeleted] = useState({}); // key -> true for temporarily suppressed categories
  const [removed, setRemoved] = useState({}); // key -> true for permanently deleted categories (RGPD art.17)
  const [pendingRelations, setPendingRelations] = useState(INITIAL_PENDING_RELATIONS);
  const [acceptedRelations, setAcceptedRelations] = useState({});
  const [refusedRelations, setRefusedRelations] = useState({});
  const pendingRelationsCount = pendingRelations.filter(
    r => !acceptedRelations[r.id] && !refusedRelations[r.id]
  ).length;
  const acceptRelation = (id) => {
    setRefusedRelations(r => { const n = {...r}; delete n[id]; return n; });
    setAcceptedRelations(a => ({ ...a, [id]: true }));
  };
  const refuseRelation = (id) => {
    setAcceptedRelations(a => { const n = {...a}; delete n[id]; return n; });
    setRefusedRelations(r => ({ ...r, [id]: true }));
  };
  const undoAcceptRelation = (id) => setAcceptedRelations(a => { const n = {...a}; delete n[id]; return n; });
  const undoRefuseRelation = (id) => setRefusedRelations(r => { const n = {...r}; delete n[id]; return n; });
  const updateField = (category, field, value) => {
    setProfile(p => ({ ...p, [category]: { ...p[category], [field]: value } }));
  };
  const suppressTemp = (category) => setDeleted(d => ({ ...d, [category]: true }));
  const restore = (category) => setDeleted(d => { const n = {...d}; delete n[category]; return n; });
  const deletePermanent = (category) => {
    // Identification is the keystone palier: without it the prospect cannot
    // be identified at all, so removing it cascades to every other category.
    const cascade = category === 'identity';
    const targets = cascade
      ? DATA_CATEGORIES.map(c => c.key)
      : [category];
    setProfile(p => {
      const next = { ...p };
      targets.forEach(key => {
        const cleared = Object.fromEntries(Object.keys(p[key] || {}).map(k => [k, '']));
        next[key] = cleared;
      });
      return next;
    });
    setDeleted(d => {
      const n = { ...d };
      targets.forEach(key => { delete n[key]; });
      return n;
    });
    // Remove the categories from the displayed list — RGPD art.17 (droit à l'effacement).
    setRemoved(r => {
      const n = { ...r };
      targets.forEach(key => { n[key] = true; });
      return n;
    });
  };
  const addField = (category, field, value) => updateField(category, field, value);
  const setAllCampaignTypes = (on) => setProfile(p => ({ ...p, allCampaignTypes: on }));
  const toggleCampaignType = (t) => setProfile(p => {
    const n = new Set(p.campaignTypes);
    n.has(t) ? n.delete(t) : n.add(t);
    return { ...p, campaignTypes: n, allCampaignTypes: false };
  });
  const toggleCategory = (c) => setProfile(p => {
    const n = new Set(p.categories);
    n.has(c) ? n.delete(c) : n.add(c);
    return { ...p, categories: n };
  });
  return (
    <ProspectCtx.Provider value={{
      profile, deleted, removed, updateField, suppressTemp, restore, deletePermanent, addField,
      setAllCampaignTypes, toggleCampaignType, toggleCategory,
      pendingRelations, acceptedRelations, refusedRelations,
      acceptRelation, refuseRelation, undoAcceptRelation, undoRefuseRelation,
      pendingRelationsCount,
    }}>
      {children}
    </ProspectCtx.Provider>
  );
}

const useProspect = () => React.useContext(ProspectCtx);

const PROSPECT_SECTIONS = [
  { id: 'portefeuille', icon: 'wallet', label: 'Portefeuille' },
  { id: 'donnees',      icon: 'database', label: 'Mes données' },
  { id: 'relations',    icon: 'handshake', label: 'Mises en relation' },
  { id: 'verif',        icon: 'tiers',  label: 'Paliers de vérification' },
  { id: 'score',        icon: 'gauge',  label: 'BUPP Score' },
  { id: 'prefs',        icon: 'sliders', label: 'Préférences' },
  { id: 'parrainage',   icon: 'gift',   label: 'Parrainage' },
  { id: 'fiscal',       icon: 'doc',    label: 'Informations fiscales' },
];

function ProspectDashboard({ go }) {
  return (
    <ProspectProvider>
      <ProspectDashboardInner go={go}/>
    </ProspectProvider>
  );
}

function ProspectDashboardInner({ go }) {
  const [sec, setSec] = useState('portefeuille');
  const { pendingRelationsCount } = useProspect();
  // Inject dynamic badges (e.g. number of pending relations) into the static
  // section descriptors. Keeping the merge here avoids leaking prospect-specific
  // logic into the generic DashShell.
  const sections = PROSPECT_SECTIONS.map(s =>
    s.id === 'relations' ? { ...s, badge: pendingRelationsCount } : s
  );
  return (
    <DashShell role="prospect" go={go} sections={sections} current={sec} onNav={setSec}
      header={<ProspectHeader />}>
      {sec === 'portefeuille' && <Portefeuille />}
      {sec === 'donnees' && <MesDonnees onGoPrefs={() => setSec('prefs')}/>}
      {sec === 'relations' && <Relations />}
      {sec === 'verif' && <VerifTiers />}
      {sec === 'score' && <ScorePanel />}
      {sec === 'prefs' && <Prefs />}
      {sec === 'parrainage' && <Parrainage />}
      {sec === 'fiscal' && <Fiscal />}
    </DashShell>
  );
}

function DashShell({ role, go, sections, current, onNav, children, header }) {
  // Mobile (≤900px) starts with the menu hidden so the dashboard takes full
  // width; on desktop the sidebar is shown expanded by default.
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 900;
  const [collapsed, setCollapsed] = useState(() => isMobile());
  const scrollTopEverywhere = () => {
    try { window.scrollTo(0, 0); } catch (e) {}
    try { document.documentElement.scrollTop = 0; } catch (e) {}
    try { document.body.scrollTop = 0; } catch (e) {}
    try {
      document.querySelectorAll('main, .page').forEach(el => { el.scrollTop = 0; });
    } catch (e) {}
  };
  const handleNav = (id) => {
    onNav(id);
    // On mobile, auto-close the floating menu after picking a section.
    if (isMobile()) setCollapsed(true);
    requestAnimationFrame(scrollTopEverywhere);
  };
  useEffect(() => {
    scrollTopEverywhere();
  }, [current]);
  // `data-menu-open` drives the mobile CSS: `true` slides the sidebar down.
  const menuOpen = !collapsed;
  return (
    <div
      className="page dash-shell"
      data-menu-open={menuOpen ? 'true' : 'false'}
      style={{ display: 'grid', gridTemplateColumns: `${collapsed ? 72 : 248}px 1fr`, minHeight: '100vh', background: 'var(--ivory)' }}
    >
      {/* Mobile-only floating hamburger that toggles the horizontal nav bar. */}
      <button
        className="dash-mobile-toggle"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        onClick={() => setCollapsed(c => !c)}
      >
        <Icon name={menuOpen ? 'close' : 'menu'} size={18}/>
      </button>
      <aside style={{
        borderRight: '1px solid var(--line)', background: 'var(--paper)',
        padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
        position: 'sticky', top: 0, height: '100vh'
      }}>
        <div className="row between center" style={{ padding: '4px 8px 20px' }}>
          {!collapsed && <Logo size={23} onClick={() => go('landing')}/>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ padding: 4, color: 'var(--ink-4)' }}>
            <Icon name="menu" size={16}/>
          </button>
        </div>
        <div className="mono caps muted" style={{ padding: '8px 12px 4px', fontSize: 10, opacity: collapsed ? 0 : 1 }}>
          {role === 'prospect' ? 'Espace prospect' : 'Espace professionnel'}
        </div>
        {sections.map(s => {
          const active = current === s.id;
          if (s.featured) {
            return (
              <button key={s.id} onClick={() => handleNav(s.id)}
                className="row center gap-2"
                style={{
                  margin: '2px 0 10px',
                  padding: collapsed ? 10 : '12px 14px',
                  borderRadius: 10,
                  background: active ? 'var(--accent)' : 'var(--accent)',
                  color: 'white',
                  fontSize: 14, fontWeight: 600,
                  boxShadow: active
                    ? '0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent), 0 6px 18px -6px color-mix(in oklab, var(--accent) 60%, transparent)'
                    : '0 6px 18px -6px color-mix(in oklab, var(--accent) 55%, transparent)',
                  cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'all .15s',
                }}>
                <Icon name={s.icon} size={16} stroke={2.25}/>
                {!collapsed && <span style={{ letterSpacing: '-0.01em' }}>{s.label}</span>}
              </button>
            );
          }
          const hasBadge = typeof s.badge === 'number' && s.badge > 0;
          return (
            <div key={s.id} className={'side-item' + (active ? ' active' : '')} onClick={() => handleNav(s.id)}>
              <span className="side-icon" style={{ position: 'relative' }}>
                <Icon name={s.icon} size={16}/>
                {hasBadge && collapsed && <span className="side-badge-dot" aria-hidden/>}
              </span>
              {!collapsed && <span style={{ flex: 1 }}>{s.label}</span>}
              {hasBadge && !collapsed && (
                <span className="side-badge" aria-label={`${s.badge} en attente`}>
                  {s.badge > 99 ? '99+' : s.badge}
                </span>
              )}
            </div>
          );
        })}
        <div style={{ flex: 1 }}/>
        <div className="dash-logout" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
          <div
            className="side-item"
            onClick={() => {
              // Demande au parent Next.js de révoquer la session Clerk puis
              // de rediriger vers la home. Le parent écoute ce message dans
              // PrototypeFrame.tsx.
              try {
                window.parent.postMessage({ bupp: 'signOut' }, '*');
              } catch (e) {}
            }}
          >
            <span className="side-icon"><Icon name="logout" size={16}/></span>
            {!collapsed && <span>Déconnexion</span>}
          </div>
        </div>
      </aside>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--ivory)', borderBottom: '1px solid var(--line)' }}>
          <TopBar role={role} go={go}/>
          {header}
        </div>
        <main style={{ padding: '32px 40px 80px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function TopBar({ role, go }) {
  return (
    <div style={{ padding: '14px 40px' }} className="row between center">
      <div className="row center gap-4">
        <div className="mono caps" style={{ fontSize: 11, letterSpacing: '.18em', color: 'var(--ink-3)', paddingRight: 14, borderRight: '1px solid var(--line)' }}>
          {role === 'prospect' ? 'Prospects' : 'Professionnels'}
        </div>
        <div style={{ position: 'relative', width: 280 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-5)' }}>
            <Icon name="search" size={14}/>
          </span>
          <input className="input" style={{ paddingLeft: 32, fontSize: 13, background: 'var(--paper)' }} placeholder={role === 'prospect' ? 'Rechercher une mise en relation…' : 'Rechercher une campagne ou un contact…'}/>
        </div>
      </div>
      <div className="row center gap-3">
        <button className="btn btn-sm btn-ghost" onClick={() => go(role === 'prospect' ? 'pro' : 'prospect')}>
          <Icon name="refresh" size={12}/> Basculer {role === 'prospect' ? 'pro' : 'prospect'}
        </button>
        <button style={{ padding: 8, borderRadius: 999, color: 'var(--ink-3)' }}>
          <Icon name="bell" size={16}/>
        </button>
        <Avatar name={role === 'prospect' ? 'Marie Leroy' : 'Atelier Mercier'} size={32}/>
      </div>
    </div>
  );
}

function ProspectHeader() {
  const { profile } = useProspect() || {};
  const prenom = profile?.identity?.prenom || 'Marie';
  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— Bonjour {prenom || '—'}</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            Vos gains du mois : <em>57,80 €</em>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            3 mises en relation en attente · prochaine échéance dans 14 h 22 min
          </div>
        </div>
        <div className="row center gap-6">
          <StatusPill label="Vérification" value="Vérifié 80%" chip="chip-accent"/>
          <StatusPill label="BUPP Score" value="742 / 1000" chip="chip-good"/>
          <StatusPill label="Parrainages" value="6 actifs" chip=""/>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, value, chip }) {
  return (
    <div>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      <div className={'chip ' + chip} style={{ fontSize: 13, padding: '5px 10px' }}>{value}</div>
    </div>
  );
}

/* ---------- Portefeuille ---------- */
function Portefeuille() {
  const [modal, setModal] = useState(null);
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Portefeuille" title="Votre capital" desc="Solde disponible, fonds en séquestre jusqu'à validation, gains cumulés depuis l'ouverture."/>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20 }}>
        <BalanceCard
          big
          label="Disponible"
          value="43,20"
          coins="432"
          sub="Retirable immédiatement"
          primary
          action={<button className="btn btn-accent" onClick={() => setModal('retrait')}>Retirer mes gains <Icon name="arrow" size={14}/></button>}
        />
        <BalanceCard label="En séquestre" value="14,60" coins="146" sub="Déblocage sous 72 h" lock/>
        <BalanceCard label="Cumulé depuis 2024" value="284,50" coins="2 845" sub="12 mois · 38 mises en relation"/>
      </div>

      <div className="card historique-card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 20 }}>
          <div className="serif" style={{ fontSize: 22 }}>Historique des mouvements</div>
          <button className="btn btn-sm btn-ghost btn-export-csv"><Icon name="download" size={12}/> Exporter CSV</button>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr>
              <th>Date</th><th>Origine</th><th>Palier</th><th>Statut</th><th style={{textAlign:'right'}}>Montant</th>
            </tr></thead>
            <tbody>
              {[
                ['18 avr.', 'Cabinet Kiné Lyon 3', 2, 'Crédité', '+4,20', 'good'],
                ['16 avr.', 'Coach pro Nantes', 3, 'En séquestre', '+6,80', 'warn'],
                ['12 avr.', 'Retrait IBAN •••4521', '—', 'Exécuté', '−30,00', ''],
                ['09 avr.', 'Agence immo Paris 11', 4, 'Crédité', '+9,40', 'good'],
                ['07 avr.', 'Bonus parrainage Léa B.', '—', 'Crédité', '+0,84', 'good'],
                ['03 avr.', 'Nutritionniste Lille', 3, 'Crédité', '+5,60', 'good'],
              ].map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--ink-4)' }}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2] === '—' ? <span className="muted">—</span> : <span className="chip">Palier {r[2]}</span>}</td>
                  <td><span className={'chip ' + (r[5] ? 'chip-' + r[5] : '')}>{r[3]}</span></td>
                  <td style={{ textAlign: 'right' }} className="mono tnum">
                    <span style={{ color: r[4].startsWith('+') ? 'var(--good)' : 'var(--ink-3)' }}>{r[4]} €</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'retrait' && <RetraitModal onClose={() => setModal(null)}/>}
    </div>
  );
}

function BalanceCard({ label, value, coins, sub, primary, lock, big, action }) {
  return (
    <div className="card" style={{
      padding: 28,
      background: primary ? 'var(--ink)' : 'var(--paper)',
      color: primary ? 'var(--paper)' : 'var(--ink)',
      borderColor: primary ? 'var(--ink)' : 'var(--line)',
      position: 'relative',
    }}>
      <div className="row between center" style={{ marginBottom: 16 }}>
        <div className="mono caps" style={{ fontSize: 10, color: primary ? 'rgba(255,255,255,.5)' : 'var(--ink-4)', letterSpacing: '.14em' }}>
          {label}
        </div>
        {lock && <Icon name="lock" size={14} stroke={1.5}/>}
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <span className="serif tnum" style={{ fontSize: big ? 64 : 44, lineHeight: 1, color: primary ? 'var(--paper)' : 'var(--ink)' }}>{value}</span>
        <span style={{ fontSize: 14, color: primary ? 'rgba(255,255,255,.6)' : 'var(--ink-4)' }}>€</span>
      </div>
      <div className="row center gap-2" style={{ marginTop: 10, fontSize: 13, color: primary ? 'rgba(255,255,255,.6)' : 'var(--ink-4)' }}>
        <span className="coin">B</span>
        <span className="mono tnum">{coins} BUPP Coins</span>
      </div>
      <div style={{ fontSize: 12, color: primary ? 'rgba(255,255,255,.5)' : 'var(--ink-5)', marginTop: 14 }}>{sub}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

function RetraitModal({ onClose }) {
  const [method, setMethod] = useState('iban');
  const [done, setDone] = useState(false);
  return (
    <Modal onClose={onClose} title="Retirer mes gains" subtitle="Solde disponible : 43,20 € · Arrivée sous 48 h ouvrées">
      {!done ? (
        <>
          <div className="col gap-2" style={{ marginBottom: 20 }}>
            {[
              ['iban', 'Virement IBAN', '•••4521 · BNP Paribas', 'Sans frais · 48 h'],
              ['card', 'Carte cadeau', 'Fnac, Décathlon, Amazon, Darty…', '+3% bonus'],
              ['don',  'Don associatif', 'La Croix-Rouge, Restos du Cœur, SPA', 'Reçu fiscal émis'],
            ].map(([k, n, d, tag]) => (
              <label key={k} className="row center gap-3" style={{
                padding: 14, border: '1px solid ' + (method === k ? 'var(--ink)' : 'var(--line-2)'),
                borderRadius: 10, cursor: 'pointer',
                background: method === k ? 'var(--ivory-2)' : 'var(--paper)'
              }}>
                <input type="radio" checked={method === k} onChange={() => setMethod(k)} style={{ marginRight: 4 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{n}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{d}</div>
                </div>
                <span className="chip chip-accent">{tag}</span>
              </label>
            ))}
          </div>
          <div className="row between center" style={{ marginTop: 20 }}>
            <div className="muted" style={{ fontSize: 12 }}>Seuil de retrait : 10 €</div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={() => setDone(true)}>Confirmer le retrait</button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 16 }}>
            <Icon name="check" size={22} stroke={2}/>
          </div>
          <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Demande enregistrée</div>
          <div className="muted" style={{ fontSize: 14 }}>Arrivée estimée : mercredi 23 avril</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Fermer</button>
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.48)',
        overflowY: 'auto',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 20px 110px',
      }}
      onClick={onClose}
    >
      <div className="card"
        style={{
          background: 'var(--paper)', padding: 32, maxWidth: 540, width: '100%',
          boxShadow: '0 20px 60px -10px rgba(0,0,0,.3)',
          margin: 'auto 0',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="row between" style={{ marginBottom: 20 }}>
          <div>
            <div className="serif" style={{ fontSize: 26 }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ padding: 6, color: 'var(--ink-4)' }}><Icon name="close" size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, desc, action }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
      <div>
        <div className="mono caps muted" style={{ marginBottom: 8 }}>— {eyebrow}</div>
        <h3 className="serif" style={{ fontSize: 32 }}>{title}</h3>
        {desc && <p className="muted" style={{ fontSize: 14, maxWidth: 640, marginTop: 6 }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Mes données ---------- */
const DATA_CATEGORIES = [
  {
    key: 'identity', tier: 1, label: 'Identification', icon: 'user',
    desc: "Email, nom, téléphone, date de naissance.",
    fields: [
      ['prenom', 'Prénom'],
      ['nom', 'Nom'],
      ['email', 'Email'],
      ['telephone', 'Téléphone'],
      ['naissance', 'Date de naissance'],
    ],
  },
  {
    key: 'localisation', tier: 2, label: 'Localisation', icon: 'france',
    desc: "Adresse, logement, mobilité.",
    fields: [
      ['adresse', 'Adresse postale'],
      ['ville', 'Ville'],
      ['codePostal', 'Code postal'],
      ['logement', 'Type de logement'],
      ['mobilite', 'Mobilité'],
    ],
  },
  {
    key: 'vie', tier: 3, label: 'Style de vie', icon: 'sparkle',
    desc: "Habitudes, famille, véhicule, sport, animaux.",
    fields: [
      ['foyer', 'Composition du foyer'],
      ['sports', 'Sports / loisirs'],
      ['animaux', 'Animaux'],
      ['vehicule', 'Véhicule'],
    ],
  },
  {
    key: 'pro', tier: 4, label: 'Données professionnelles', icon: 'briefcase',
    desc: "Poste, revenus, statut, secteur.",
    fields: [
      ['poste', 'Poste'],
      ['statut', 'Statut'],
      ['secteur', 'Secteur'],
      ['revenus', 'Revenus déclarés'],
    ],
  },
  {
    key: 'patrimoine', tier: 5, label: 'Patrimoine & projets', icon: 'gauge',
    desc: "Immobilier, épargne, projets.",
    fields: [
      ['residence', 'Résidence principale'],
      ['epargne', 'Épargne disponible'],
      ['projets', 'Projets à 3–5 ans'],
    ],
  },
];

function MesDonnees({ onGoPrefs }) {
  const ctx = useProspect();
  const profile = ctx?.profile;
  const deleted = ctx?.deleted || {};
  const removed = ctx?.removed || {};
  const [editing, setEditing] = useState(null); // { category, field, value }
  const [adding, setAdding] = useState(null); // category key
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmHide, setConfirmHide] = useState(null); // category key
  const [confirmFieldDelete, setConfirmFieldDelete] = useState(null); // { category, field, label }

  // Categories permanently removed by the user are excluded from the list,
  // from the completeness calculation, and from the per-tier progress bars.
  const visibleCategories = DATA_CATEGORIES.filter(c => !removed[c.key]);
  const totalFields = visibleCategories.reduce((acc, c) => acc + c.fields.length, 0);
  const filledFields = visibleCategories.reduce(
    (acc, c) => acc + (deleted[c.key] ? 0 : c.fields.filter(([f]) => profile?.[c.key]?.[f]).length),
    0
  );
  const completeness = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Mes données" title="Vos informations déclarées"
        desc="Ajoutez, modifiez, supprimez temporairement ou définitivement chaque donnée. Toute modification se répercute immédiatement sur l'ensemble de l'application."/>

      {/* RGPD rights banner — eye-catching */}
      <div className="alert-block" style={{
        padding: '22px 26px', borderRadius: 14,
        background: 'linear-gradient(120deg, #FEF3C7 0%, #FCD34D 100%)',
        border: '1.5px solid #F59E0B',
        color: '#78350F',
        display: 'flex', gap: 18, alignItems: 'flex-start'
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: '#FDE68A', color: '#78350F',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid #B45309' }}>
          <Icon name="shield" size={20} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 20, marginBottom: 4, color: '#78350F' }}>
            Vos droits sur vos données — articles 12 et suivants du RGPD
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#78350F' }}>
            Vous disposez des droits d'<strong>accès</strong>, de <strong>rectification</strong>,
            d'<strong>effacement</strong>, de <strong>limitation du traitement</strong>, de <strong>portabilité</strong>
            et d'<strong>opposition</strong> sur l'intégralité de vos données personnelles. Ces droits
            s'exercent directement depuis cette page — chaque action est horodatée et tracée.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: '#92400E', letterSpacing: '.06em' }}>
            RGPD · ARTICLES 12 À 22 · RÈGLEMENT (UE) 2016/679
          </div>
        </div>
      </div>

      {/* Completeness summary */}
      <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 28, alignItems: 'center' }}>
        <div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Complétude de votre profil</div>
          <div className="serif tnum" style={{ fontSize: 40 }}>{completeness}<span style={{ fontSize: 20, color: 'var(--ink-4)' }}>%</span></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Plus votre profil est complet, plus votre BUPP Score augmente.</div>
        </div>
        <div>
          <div className="col gap-2">
            {visibleCategories.map(c => {
              const filled = c.fields.filter(([f]) => profile?.[c.key]?.[f]).length;
              const pct = deleted[c.key] ? 0 : Math.round(filled / c.fields.length * 100);
              return (
                <div key={c.key}>
                  <div className="row between" style={{ fontSize: 12, marginBottom: 4 }}>
                    <span className="muted">P{c.tier} · {c.label}</span>
                    <span className="mono tnum">{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: deleted[c.key] ? 'var(--warn)' : 'var(--accent)', transition: 'width .25s' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="col gap-4">
        {visibleCategories.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--ink-4)' }}>
            <div className="serif" style={{ fontSize: 18, color: 'var(--ink-2)', marginBottom: 6 }}>
              Aucun palier de données
            </div>
            <div style={{ fontSize: 13 }}>
              Vous avez supprimé toutes vos catégories de données. Les professionnels ne peuvent
              plus vous solliciter via BUUPP.
            </div>
          </div>
        )}
        {visibleCategories.map(cat => {
          const isDeleted = deleted[cat.key];
          return (
            <div key={cat.key} className="card" style={{ padding: 24, opacity: isDeleted ? 0.65 : 1 }}>
              <div className="row between mes-donnees-card-head" style={{ marginBottom: 16, alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div className="row center gap-4">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ivory-2)', color: 'var(--ink-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={cat.icon} size={18}/>
                  </div>
                  <div>
                    <div className="row center gap-3">
                      <div className="serif" style={{ fontSize: 20 }}>{cat.label}</div>
                      <span className="chip">Palier {cat.tier}</span>
                      {isDeleted && <span className="chip chip-warn">Masquée temporairement</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{cat.desc}</div>
                  </div>
                </div>
                <div className="row gap-2">
                  {isDeleted ? (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => ctx?.restore(cat.key)}>
                        <Icon name="rotate" size={12}/> Restaurer
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(cat.key)} style={{ color: 'var(--danger)' }}>
                        <Icon name="trash" size={12}/> Supprimer définitivement
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAdding(cat.key)}>
                        <Icon name="plus" size={12}/> Ajouter
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmHide(cat.key)}>
                        <Icon name="eyeSlash" size={12}/> Masquer temporairement
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(cat.key)} style={{ color: 'var(--danger)' }}>
                        <Icon name="trash" size={12}/> Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>
              {!isDeleted && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  {cat.fields.map(([field, label], idx) => {
                    const val = profile?.[cat.key]?.[field] || '';
                    return (
                      <div key={field} style={{ background: 'var(--paper)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 14, color: val ? 'var(--ink)' : 'var(--ink-5)', fontStyle: val ? 'normal' : 'italic' }}>
                            {val || '— non renseigné —'}
                          </div>
                        </div>
                        <div className="row gap-1">
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                            onClick={() => setEditing({ category: cat.key, field, label, value: val })}>
                            <Icon name="edit" size={11}/>
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            onClick={() => setConfirmFieldDelete({ category: cat.key, categoryLabel: cat.label, field, label })}
                            disabled={!val}
                            title={val ? 'Supprimer cette donnée' : 'Aucune valeur à supprimer'}>
                            <Icon name="trash" size={11}/>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pointer to Préférences */}
      <div style={{
        padding: '20px 24px', borderRadius: 12,
        background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)',
        display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--accent)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="info" size={16} stroke={2}/>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, color: 'var(--ink)' }}>Pensez à affiner vos préférences</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Rendez-vous dans l'onglet <strong style={{ color: 'var(--ink)' }}>Préférences</strong> pour préciser,
            type par type de campagne, quelles données vous souhaitez communiquer.
          </div>
        </div>
        <button onClick={onGoPrefs} className="btn btn-primary btn-sm">
          Ouvrir Préférences <Icon name="arrow" size={12}/>
        </button>
      </div>

      {editing && (
        <EditFieldModal edit={editing}
          onSave={(v) => { ctx?.updateField(editing.category, editing.field, v); setEditing(null); }}
          onClose={() => setEditing(null)}/>
      )}
      {adding && (
        <AddFieldModal category={DATA_CATEGORIES.find(c => c.key === adding)}
          existing={profile?.[adding] || {}}
          onSave={(field, value) => { ctx?.updateField(adding, field, value); setAdding(null); }}
          onClose={() => setAdding(null)}/>
      )}
      {confirmDelete && (
        <ConfirmDeleteModal category={DATA_CATEGORIES.find(c => c.key === confirmDelete)}
          onConfirm={() => { ctx?.deletePermanent(confirmDelete); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)}/>
      )}
      {confirmHide && (
        <ConfirmHideModal category={DATA_CATEGORIES.find(c => c.key === confirmHide)}
          onConfirm={() => { ctx?.suppressTemp(confirmHide); setConfirmHide(null); }}
          onClose={() => setConfirmHide(null)}/>
      )}
      {confirmFieldDelete && (
        <ConfirmFieldDeleteModal field={confirmFieldDelete}
          onConfirm={() => {
            ctx?.updateField(confirmFieldDelete.category, confirmFieldDelete.field, '');
            setConfirmFieldDelete(null);
          }}
          onClose={() => setConfirmFieldDelete(null)}/>
      )}
    </div>
  );
}

function ModalShell({ title, children, onClose, width = 460 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,22,41,.5)',
        zIndex: 100,
        // Scroll vertical sur l'overlay quand la modale dépasse la hauteur
        // de la viewport (sinon le contenu est inaccessible).
        overflowY: 'auto',
        // `flex-start` au lieu de `center` : avec overflow scroll, center
        // clipperait le haut de la modale quand elle dépasse.
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        // padding-bottom large = clearance pour la RouteNav fixée en bas
        // de l'écran qui occulterait sinon les boutons d'action de la modale.
        padding: '24px 20px 110px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--paper)', borderRadius: 16, padding: 28,
          maxWidth: width, width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,.15)',
          // Centre verticalement quand la modale tient dans l'écran ;
          // s'ancre en haut (auto résout à 0) quand elle dépasse → scrollable.
          margin: 'auto 0',
        }}
      >
        <div className="row between" style={{ marginBottom: 22 }}>
          <div className="serif" style={{ fontSize: 22 }}>{title}</div>
          <button onClick={onClose} style={{ color: 'var(--ink-4)', padding: 4, fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditFieldModal({ edit, onSave, onClose }) {
  const [val, setVal] = useState(edit.value);
  return (
    <ModalShell title={"Modifier : " + edit.label} onClose={onClose}>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>{edit.label}</div>
      <input className="input" value={val} onChange={e => setVal(e.target.value)} autoFocus
        style={{ width: '100%', fontSize: 14, marginBottom: 20 }}/>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={() => onSave(val)} className="btn btn-primary btn-sm">Enregistrer</button>
      </div>
    </ModalShell>
  );
}

function AddFieldModal({ category, existing, onSave, onClose }) {
  const empty = category.fields.filter(([f]) => !existing[f]);
  const pool = empty.length ? empty : category.fields;
  const [field, setField] = useState(pool[0][0]);
  const [val, setVal] = useState(existing[pool[0][0]] || '');
  return (
    <ModalShell title={"Ajouter : " + category.label} onClose={onClose}>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Donnée</div>
      <select className="input" value={field} onChange={e => { setField(e.target.value); setVal(existing[e.target.value] || ''); }}
        style={{ width: '100%', fontSize: 14, marginBottom: 14, padding: '10px 12px' }}>
        {category.fields.map(([f, l]) => <option key={f} value={f}>{l}{existing[f] ? ' (déjà renseignée)' : ''}</option>)}
      </select>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Valeur</div>
      <input className="input" value={val} onChange={e => setVal(e.target.value)} autoFocus
        style={{ width: '100%', fontSize: 14, marginBottom: 20 }}/>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={() => onSave(field, val)} className="btn btn-primary btn-sm" disabled={!val}>Ajouter</button>
      </div>
    </ModalShell>
  );
}

function ConfirmDeleteModal({ category, onConfirm, onClose }) {
  const isIdentity = category.key === 'identity';
  const otherCategories = DATA_CATEGORIES.filter(c => c.key !== 'identity').map(c => c.label);
  return (
    <ModalShell title="Suppression définitive" onClose={onClose}>
      <div className="alert-block" style={{
        padding: 16, borderRadius: 10, marginBottom: 14,
        background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B',
        display: 'flex', gap: 14, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 36, height: 36, minWidth: 36, borderRadius: '50%',
          background: '#DC2626', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="alert" size={16} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#7F1D1D', marginBottom: 4 }}>
            Vous ne pourrez plus être sollicité
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            En supprimant la catégorie <strong>{category.label}</strong>, les professionnels
            <strong> ne pourront plus vous contacter</strong> pour les campagnes qui exigent ces
            données. Vous ne recevrez donc plus aucune sollicitation associée à ce palier — et
            ne pourrez plus en tirer de gains.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: '#991B1B', letterSpacing: '.06em' }}>
            Action irréversible — RGPD article 17 (droit à l'effacement)
          </div>
        </div>
      </div>
      {isIdentity && (
        <div className="alert-block" style={{
          padding: 16, borderRadius: 10, marginBottom: 14,
          background: '#FFF7ED', border: '1.5px solid #FDBA74', color: '#7C2D12',
          display: 'flex', gap: 14, alignItems: 'flex-start'
        }}>
          <div style={{
            width: 36, height: 36, minWidth: 36, borderRadius: '50%',
            background: '#EA580C', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="alert" size={16} stroke={2}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#7C2D12', marginBottom: 4 }}>
              Suppression en cascade de tous vos paliers
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              La catégorie <strong>Identification</strong> est la <strong>clé de voûte</strong> de
              votre profil — sans elle, plus aucune donnée ne peut être rattachée à votre personne.
              Sa suppression entraînera donc <strong>l'effacement définitif</strong> de toutes les
              autres catégories : <strong>{otherCategories.join(', ')}</strong>.
            </div>
          </div>
        </div>
      )}
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={onConfirm} className="btn btn-sm" style={{ background: '#DC2626', color: 'white' }}>
          <Icon name="trash" size={12}/> {isIdentity ? 'Confirmer la suppression complète' : 'Confirmer la suppression'}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmHideModal({ category, onConfirm, onClose }) {
  return (
    <ModalShell title="Masquer cette catégorie ?" onClose={onClose}>
      <div className="alert-block" style={{
        padding: 16, borderRadius: 10, marginBottom: 16,
        background: 'color-mix(in oklab, var(--warn) 8%, var(--paper))',
        border: '1.5px solid color-mix(in oklab, var(--warn) 40%, var(--line))',
        color: 'var(--ink-2)',
        display: 'flex', gap: 14, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 36, height: 36, minWidth: 36, borderRadius: '50%',
          background: 'var(--warn)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="eyeSlash" size={16} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            Conséquence du masquage
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Tant que la catégorie <strong>{category.label}</strong> est masquée, les professionnels
            <strong> ne pourront plus vous contacter</strong> pour les campagnes qui exigent
            ces données. Vous recevrez donc moins de demandes de mise en relation — et potentiellement
            aucun gain sur les campagnes correspondant à ce palier.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: 'var(--ink-4)', letterSpacing: '.06em' }}>
            Action réversible à tout moment — restauration en un clic
          </div>
        </div>
      </div>
      <div style={{
        padding: 12, borderRadius: 8, marginBottom: 18,
        background: 'var(--ivory-2)', fontSize: 12, color: 'var(--ink-3)',
        display: 'flex', gap: 10, alignItems: 'center'
      }}>
        <Icon name="info" size={12}/>
        <span>Vos données restent stockées mais <strong style={{ color: 'var(--ink-2)' }}>ne sont plus diffusables</strong> — aucun professionnel n'y aura accès.</span>
      </div>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={onConfirm} className="btn btn-primary btn-sm">
          <Icon name="eyeSlash" size={12}/> Masquer temporairement
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmFieldDeleteModal({ field, onConfirm, onClose }) {
  return (
    <ModalShell title={'Supprimer : ' + field.label} onClose={onClose}>
      <div className="alert-block" style={{
        padding: 16, borderRadius: 10, marginBottom: 14,
        background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B',
        display: 'flex', gap: 14, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 36, height: 36, minWidth: 36, borderRadius: '50%',
          background: '#DC2626', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="alert" size={16} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#7F1D1D', marginBottom: 4 }}>
            Conséquence sur vos sollicitations
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            En supprimant la donnée <strong>{field.label}</strong> (catégorie{' '}
            <strong>{field.categoryLabel}</strong>), vous <strong>ne pourrez plus être sollicité</strong>{' '}
            pour les campagnes dont le professionnel a besoin de cette information — et donc{' '}
            <strong>plus être rémunéré</strong> sur ces mises en relation.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: '#991B1B', letterSpacing: '.06em' }}>
            Vous pourrez la renseigner à nouveau à tout moment depuis cette page
          </div>
        </div>
      </div>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={onConfirm} className="btn btn-sm" style={{ background: '#DC2626', color: 'white' }}>
          <Icon name="trash" size={12}/> Confirmer la suppression
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Relations ---------- */
function Relations() {
  const {
    pendingRelations: pending,
    acceptedRelations: accepted,
    refusedRelations: refused,
    acceptRelation, refuseRelation,
    undoAcceptRelation, undoRefuseRelation,
  } = useProspect();
  const history = [
    ['12 avr.', 'Coach pro Nantes', 3, 'Acceptée', 'Crédité', '+6,80'],
    ['08 avr.', 'Agence immo Paris 11', 4, 'Acceptée', 'Crédité', '+9,40'],
    ['05 avr.', 'Assurance Leclerc', 2, 'Refusée', '—', '—'],
    ['01 avr.', 'Nutritionniste Lille', 3, 'Acceptée', 'Crédité', '+5,60'],
  ];
  // Filtre cyclique sur l'historique : toutes → acceptées → refusées → toutes
  const [historyFilter, setHistoryFilter] = useState('all');
  const HISTORY_FILTERS = [
    { key: 'all',      label: 'Toutes' },
    { key: 'accepted', label: 'Acceptées' },
    { key: 'refused',  label: 'Refusées' },
  ];
  const filteredHistory = history.filter(h =>
    historyFilter === 'all' ||
    (historyFilter === 'accepted' && h[3] === 'Acceptée') ||
    (historyFilter === 'refused'  && h[3] === 'Refusée')
  );
  // Modale "détails de l'offre" — affiche toutes les infos campagne (dates,
  // brief texte, motif complet, palier, récompense) au clic sur le bouton +.
  const [detail, setDetail] = useState(null); // l'objet pending sélectionné
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Mises en relation" title="Demandes en attente" desc="Vous avez 72 heures pour accepter ou refuser chaque demande. Sans réponse, elle expire."/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {pending.map(p => {
          const isAccepted = accepted[p.id], isRefused = refused[p.id];
          return (
            <div key={p.id} className="card" style={{ padding: 20, position: 'relative' }}>
              <div className="row between center" style={{ marginBottom: 14 }}>
                <span className="chip chip-accent">Palier {p.tier}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                  <Icon name="bolt" size={10}/> {p.timer}
                </span>
              </div>
              <div className="row center gap-3" style={{ marginBottom: 10, alignItems: 'center' }}>
                <Avatar name={p.pro} size={32}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{p.pro}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{p.sector}</div>
                </div>
                <button
                  onClick={() => setDetail(p)}
                  aria-label="Voir les détails de l'offre"
                  title="Voir les détails de l'offre"
                  className="relation-detail-btn"
                  style={{
                    padding: 0, width: 32, height: 32, borderRadius: 999,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--accent)', color: 'white',
                    border: '1px solid var(--accent)',
                    boxShadow: '0 4px 12px -4px color-mix(in oklab, var(--accent) 60%, transparent)',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'transform .12s ease, box-shadow .12s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  <Icon name="plus" size={15} stroke={2.5}/>
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 10, marginBottom: 16, lineHeight: 1.55 }}>{p.motif}</p>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <div className="row between center" style={{ marginBottom: 12 }}>
                  <span className="mono caps muted" style={{ fontSize: 10 }}>Récompense</span>
                  <span className="serif tnum" style={{ fontSize: 22, color: 'var(--accent)' }}>
                    {p.reward.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
                {isAccepted ? (
                  <div className="col gap-2">
                    <div style={{
                      padding: 14, borderRadius: 10,
                      background: 'color-mix(in oklab, var(--good) 10%, var(--paper))',
                      border: '1.5px solid var(--good)',
                      boxShadow: '0 0 0 3px color-mix(in oklab, var(--good) 18%, transparent), 0 10px 28px -14px color-mix(in oklab, var(--good) 50%, transparent)',
                    }}>
                      <div className="row center gap-2" style={{ marginBottom: 8 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'var(--good)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon name="check" size={14} stroke={2.5}/>
                        </span>
                        <span className="mono caps" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--good)' }}>
                          Accord donné · à usage unique
                        </span>
                      </div>
                      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Paiement en séquestre</span>
                        <span className="serif tnum" style={{ fontSize: 26, color: 'var(--ink)' }}>
                          {p.reward.toFixed(2).replace('.', ',')} €
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>
                        Crédité sur votre portefeuille après 72 h ou dès que {p.pro.split(' ')[0]} a confirmé le contact.
                      </div>
                    </div>
                    <div className="row center gap-2" style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: 'var(--ivory-2)',
                      fontSize: 11, color: 'var(--ink-4)',
                    }}>
                      <Icon name="shield" size={11}/>
                      <span>Accord strictement limité à <strong style={{ color: 'var(--ink-3)' }}>cette campagne uniquement</strong> — pas de réutilisation ni revente.</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
                      onClick={() => undoAcceptRelation(p.id)}>
                      <Icon name="rotate" size={12}/> Revenir sur mon acceptation
                    </button>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center', letterSpacing: '.04em' }}>
                      Réversible tant que la campagne n'est pas clôturée
                    </div>
                  </div>
                ) : isRefused ? (
                  <div className="col gap-2">
                    <div style={{
                      padding: 12, borderRadius: 10,
                      background: 'color-mix(in oklab, var(--danger) 6%, var(--paper))',
                      border: '1.5px solid color-mix(in oklab, var(--danger) 30%, var(--line))',
                    }}>
                      <div className="row center gap-2">
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'color-mix(in oklab, var(--danger) 14%, var(--paper))',
                          color: 'var(--danger)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon name="x" size={12} stroke={2.5}/>
                        </span>
                        <span className="mono caps" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--danger)' }}>
                          Demande refusée
                        </span>
                      </div>
                    </div>
                    <div className="row center gap-2" style={{ padding: '8px 10px', borderRadius: 8,
                      background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
                      border: '1px dashed color-mix(in oklab, var(--accent) 30%, transparent)' }}>
                      <Icon name="info" size={11}/>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1 }}>Campagne toujours ouverte — vous pouvez changer d'avis.</span>
                    </div>
                    <div className="row gap-2">
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => undoRefuseRelation(p.id)}>
                        <Icon name="rotate" size={12}/> Revenir en arrière
                      </button>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => acceptRelation(p.id)}>
                        <Icon name="check" size={12}/> Accepter
                      </button>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center', letterSpacing: '.04em' }}>
                      Réversible tant que la campagne n'est pas clôturée
                    </div>
                  </div>
                ) : (
                  <div className="row gap-2">
                    <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => acceptRelation(p.id)}>Accepter</button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => refuseRelation(p.id)}>Refuser</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 20, alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="serif" style={{ fontSize: 22 }}>Historique</div>
          <div className="row gap-2 historique-filters" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 11 }}>
              <Icon name="filter" size={11}/> Filtrer
            </span>
            {HISTORY_FILTERS.map(f => {
              const active = historyFilter === f.key;
              return (
                <button key={f.key}
                  onClick={() => setHistoryFilter(f.key)}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--ink)' : 'var(--ivory-2)',
                    color: active ? 'var(--paper)' : 'var(--ink-3)',
                    border: 0,
                    fontWeight: active ? 600 : 400,
                  }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Professionnel</th><th>Palier</th><th>Décision</th><th>Statut</th><th style={{textAlign:'right'}}>Gain</th></tr></thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Aucune demande {historyFilter === 'accepted' ? 'acceptée' : 'refusée'}.</span>
                </td></tr>
              )}
              {filteredHistory.map((h, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--ink-4)' }}>{h[0]}</td>
                  <td>{h[1]}</td>
                  <td><span className="chip">Palier {h[2]}</span></td>
                  <td><span className={'chip ' + (h[3] === 'Acceptée' ? 'chip-good' : '')}>{h[3]}</span></td>
                  <td className="muted">{h[4]}</td>
                  <td className="mono tnum" style={{ textAlign: 'right', color: h[5] === '—' ? 'var(--ink-5)' : 'var(--good)' }}>{h[5] === '—' ? '—' : h[5] + ' €'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <RelationDetailModal
          relation={detail}
          isAccepted={!!accepted[detail.id]}
          isRefused={!!refused[detail.id]}
          onAccept={() => { acceptRelation(detail.id); setDetail(null); }}
          onRefuse={() => { refuseRelation(detail.id); setDetail(null); }}
          onClose={() => setDetail(null)}/>
      )}
    </div>
  );
}

function formatRelationDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(d);
}

function RelationDetailModal({ relation, isAccepted, isRefused, onAccept, onRefuse, onClose }) {
  const r = relation;
  const status = isAccepted ? 'accepted' : isRefused ? 'refused' : 'pending';
  return (
    <ModalShell title="Détails de l'offre" onClose={onClose} width={520}>
      <div className="col gap-4">
        {/* En-tête : nom pro + secteur + chip palier */}
        <div className="row center gap-3" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={r.pro} size={44}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1.2 }}>{r.pro}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{r.sector}</div>
          </div>
          <span className="chip chip-accent" style={{ alignSelf: 'center' }}>Palier {r.tier}</span>
        </div>

        {/* Brief de campagne — texte court rédigé par le pro */}
        {r.brief && (
          <div style={{
            padding: 14, borderRadius: 10,
            background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--accent) 24%, var(--line))',
          }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, color: 'color-mix(in oklab, var(--accent) 70%, var(--ink-3))' }}>
              Le mot du professionnel
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>
              « {r.brief} »
            </div>
          </div>
        )}

        {/* Motif détaillé */}
        <div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>Objet de la demande</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>{r.motif}</div>
        </div>

        {/* Dates de campagne — bloc à 2 colonnes (1 colonne sur mobile via CSS) */}
        <div className="relation-detail-dates" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--ivory-2)', border: '1px solid var(--line)',
          }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>
              <Icon name="calendar" size={10}/> Lancement
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
              {formatRelationDate(r.startDate)}
            </div>
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--ivory-2)', border: '1px solid var(--line)',
          }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>
              <Icon name="flag" size={10}/> Fin
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
              {formatRelationDate(r.endDate)}
            </div>
          </div>
        </div>

        {/* Récompense + délai */}
        <div className="row between center" style={{
          padding: '14px 16px', borderRadius: 10,
          background: 'var(--paper)', border: '1px solid var(--line)',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>Récompense</div>
            <div className="serif tnum" style={{ fontSize: 24, color: 'var(--accent)' }}>
              {r.reward.toFixed(2).replace('.', ',')} €
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>
              <Icon name="bolt" size={10}/> Vous avez encore
            </div>
            <div className="mono" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{r.timer}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
          {status === 'pending' && (
            <>
              <button onClick={onRefuse} className="btn btn-ghost btn-sm">Refuser</button>
              <button onClick={onAccept} className="btn btn-primary btn-sm">
                <Icon name="check" size={12} stroke={2.25}/> Accepter
              </button>
            </>
          )}
          {status !== 'pending' && (
            <button onClick={onClose} className="btn btn-primary btn-sm">Fermer</button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Verif tiers ---------- */
function VerifTiers() {
  const tiers = [
    { k: 'Basique',   pct: 0,   active: true,  ok: true,  done: "Email + mot de passe", next: "Ajoutez votre téléphone pour passer au palier Vérifié." },
    { k: 'Vérifié',   pct: 40,  active: true,  ok: true,  done: "Téléphone + pièce d'identité", next: "Passez la vérification vidéo sélective pour atteindre Certifié." },
    { k: 'Certifié',  pct: 80,  active: true,  ok: false, done: "Vérification vidéo sélective", next: "Reliez un justificatif de domicile datant de moins de 3 mois." },
    { k: 'Confiance', pct: 100, active: false, ok: false, done: "Justificatif de domicile + IBAN vérifié", next: "Vos gains seront doublés ×2 sur tous les paliers." },
  ];
  const current = 2; // at 80
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Paliers de vérification" title="Vos paliers" desc="Chaque palier validé débloque des demandes plus exigeantes et mieux rémunérées. Aucune donnée n'est partagée — la vérification reste confidentielle et n'alimente que votre BUPP Score."/>
      <div className="card" style={{ padding: 32 }}>
        {/* progress dots line */}
        <div style={{ position: 'relative', padding: '0 0 24px' }}>
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, height: 2, background: 'var(--line)' }}/>
          <div style={{ position: 'absolute', top: 14, left: 14, width: `calc(${(current)/(tiers.length-1)*100}% - 28px)`, height: 2, background: 'var(--accent)' }}/>
          <div className="row between">
            {tiers.map((t, i) => (
              <div key={t.k} style={{ textAlign: 'center', zIndex: 1, width: 120 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: i <= current ? 'var(--accent)' : 'var(--paper)',
                  border: '2px solid ' + (i <= current ? 'var(--accent)' : 'var(--line-2)'),
                  color: i <= current ? 'white' : 'var(--ink-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', fontSize: 12, fontFamily: 'var(--mono)'
                }}>{i < current ? '✓' : i + 1}</div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: i === current ? 500 : 400 }}>{t.k}</div>
                <div className="mono tnum muted" style={{ fontSize: 11 }}>{t.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <div className="mono caps muted" style={{ marginBottom: 10 }}>— Palier actuel</div>
            <div className="serif" style={{ fontSize: 28, marginBottom: 4 }}>Certifié <span className="muted" style={{ fontSize: 16 }}>80%</span></div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>{tiers[current].done} validé.</div>
          </div>
          <div>
            <div className="mono caps muted" style={{ marginBottom: 10 }}>— Prochaine étape</div>
            <div className="serif" style={{ fontSize: 20, marginBottom: 8 }}>Palier Confiance</div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>{tiers[current + 1].next}</p>
            <button className="btn btn-primary btn-sm">Téléverser mon justificatif <Icon name="arrow" size={12}/></button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {tiers.map((t, i) => (
          <div key={t.k} className="card" style={{ padding: 20, background: i === current ? 'var(--paper)' : 'var(--ivory-2)', borderColor: i === current ? 'var(--ink)' : 'var(--line)' }}>
            <div className="row between center" style={{ marginBottom: 10 }}>
              <div className="mono caps muted" style={{ fontSize: 10 }}>Palier {i+1}</div>
              {i < current ? <span className="chip chip-good"><Icon name="check" size={10}/> Validé</span>
                : i === current ? <span className="chip chip-accent">En cours</span>
                : <span className="chip">À venir</span>}
            </div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>{t.k}</div>
            <div className="mono tnum muted" style={{ fontSize: 11, marginBottom: 12 }}>{t.pct}%</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.done}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Score panel ---------- */
function ScorePanel() {
  const { profile } = useProspect() || {};
  const prenom = profile?.identity?.prenom || 'Marie';
  const nomInitial = (profile?.identity?.nom || 'L.').charAt(0) + '.';
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="BUPP Score" title="Votre indice de désirabilité" desc="Un score sur 1000 qui évolue chaque semaine selon vos actions, votre complétude et vos évaluations."/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <ScoreGauge value={742} size={240}/>
          <div className="serif italic" style={{ fontSize: 22, marginTop: 16, color: 'var(--accent)' }}>Recherchée</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{prenom} {nomInitial} · +24 points sur 30 jours</div>
          <div className="row between" style={{ marginTop: 22, borderTop: '1px solid var(--line)', paddingTop: 16, fontSize: 12 }}>
            <div><div className="muted">Rang</div><div className="serif">Top 18%</div></div>
            <div><div className="muted">Prochain palier</div><div className="serif">Prestige</div></div>
            <div><div className="muted">À gagner</div><div className="serif">+158 pts</div></div>
          </div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="row between" style={{ marginBottom: 20 }}>
            <div className="serif" style={{ fontSize: 22 }}>Évolution sur 6 mois</div>
            <div className="row gap-2">
              {['1M', '3M', '6M', '1A'].map((t, i) => (
                <button key={t} className="chip" style={{ cursor: 'pointer', background: i === 2 ? 'var(--ink)' : 'var(--ivory-2)', color: i === 2 ? 'var(--paper)' : 'var(--ink-3)', border: 0 }}>{t}</button>
              ))}
            </div>
          </div>
          <ScoreChart/>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 18 }}>Conseils pour améliorer votre score</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['Passez au palier Confiance', '+80 pts estimés', 'Téléversez votre justificatif de domicile.', 'shield'],
            ['Complétez votre palier 4', '+45 pts estimés', "Renseignez votre statut professionnel et votre tranche de revenus.", 'chart'],
            ['Acceptez 2 mises en relation', '+35 pts estimés', "Votre taux d'acceptation actuel (66%) peut atteindre 80%.", 'inbox'],
          ].map((c, i) => (
            <div key={i} style={{ padding: 20, border: '1px dashed var(--line-2)', borderRadius: 12 }}>
              <div className="row between center" style={{ marginBottom: 12 }}>
                <span style={{ color: 'var(--accent)' }}><Icon name={c[3]} size={18}/></span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{c[1]}</span>
              </div>
              <div className="serif" style={{ fontSize: 17, marginBottom: 6 }}>{c[0]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{c[2]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreChart() {
  const data = [620, 638, 652, 658, 684, 702, 715, 728, 730, 742];
  const W = 600, H = 180, P = 24;
  const max = 800, min = 600;
  const x = i => P + (i / (data.length - 1)) * (W - 2*P);
  const y = v => P + (1 - (v - min) / (max - min)) * (H - 2*P);
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const area = line + ` L ${x(data.length-1)} ${H-P} L ${x(0)} ${H-P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[600, 700, 800].map(v => (
        <g key={v}>
          <line x1={P} x2={W-P} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+4} y={y(v)+3} fontSize="10" fill="var(--ink-5)" fontFamily="monospace">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#g1)"/>
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5"/>)}
    </svg>
  );
}

/* ---------- Prefs ---------- */
function Prefs() {
  const ctx = useProspect();
  const cats = ctx?.profile?.categories || new Set();
  const allTypes = ctx?.profile?.allCampaignTypes;
  const selectedTypes = ctx?.profile?.campaignTypes || new Set();
  const [radius, setRadius] = useState(25);
  const [tierShare, setTierShare] = useState({1: true, 2: true, 3: true, 4: false, 5: false});

  const allCats = ['Bien-être', 'Coaching', 'Artisanat', 'Immobilier', 'Finance', 'Assurance', 'Auto', 'Éducation', 'Beauté', 'Alimentation', 'Juridique'];
  const allCampaignTypes = ['Prise de contact', 'Prise de rendez-vous', 'Événement', 'Téléchargement', 'Enquête & avis', 'Promotion'];

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Préférences" title="Qui peut vous contacter" desc="Réglez finement les catégories, les types de campagne, la zone et les paliers de données que vous acceptez de partager."/>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Types de campagne acceptés</div>
            <div className="muted" style={{ fontSize: 13 }}>Choisissez pour quels types de campagne vous acceptez d'être sollicité.</div>
          </div>
          <button
            onClick={() => ctx?.setAllCampaignTypes(true)}
            className="row center gap-2"
            style={{
              padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
              background: allTypes ? 'var(--accent)' : 'var(--paper)',
              color: allTypes ? 'white' : 'var(--ink)',
              border: '1.5px solid ' + (allTypes ? 'var(--accent)' : 'var(--line-2)'),
              boxShadow: allTypes ? '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)' : 'none',
              cursor: 'pointer', transition: 'all .15s'
            }}>
            <Icon name="check" size={13} stroke={2}/> Tous types de campagne
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {allCampaignTypes.map(t => {
            const active = allTypes || selectedTypes.has(t);
            return (
              <button key={t} onClick={() => ctx?.toggleCampaignType(t)} style={{
                padding: '8px 14px', borderRadius: 999, fontSize: 13,
                background: active ? 'var(--ink)' : 'var(--paper)',
                color: active ? 'var(--paper)' : 'var(--ink-3)',
                border: '1px solid ' + (active ? 'var(--ink)' : 'var(--line-2)'),
                transition: 'all .15s', cursor: 'pointer'
              }}>
                {active && <span style={{ marginRight: 6 }}>✓</span>}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Catégories autorisées</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Seuls les professionnels de ces secteurs pourront vous adresser une demande.</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {allCats.map(c => (
            <button key={c} onClick={() => ctx?.toggleCategory(c)} style={{
              padding: '8px 14px', borderRadius: 999, fontSize: 13,
              background: cats.has(c) ? 'var(--ink)' : 'var(--paper)',
              color: cats.has(c) ? 'var(--paper)' : 'var(--ink-3)',
              border: '1px solid ' + (cats.has(c) ? 'var(--ink)' : 'var(--line-2)'),
              transition: 'all .15s', cursor: 'pointer'
            }}>
              {cats.has(c) && <span style={{ marginRight: 6 }}>✓</span>}
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 18 }}>Zone géographique</div>
          <div className="row between center" style={{ marginBottom: 14 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Centrée sur</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Lyon 3e, 69003</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>Rayon</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{radius} <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>km</span></div>
            </div>
          </div>
          <input type="range" min="5" max="100" step="5" value={radius} onChange={e => setRadius(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }}/>
          <MapThumb radius={radius}/>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Paliers partageables</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Cochez uniquement les paliers que vous acceptez de voir transmis après double consentement.</div>
          {[
            [1, 'Identification', '0,10 – 0,50 €'],
            [2, 'Localisation', '0,50 – 2,00 €'],
            [3, 'Style de vie', '2,00 – 5,00 €'],
            [4, 'Données pro', '5,00 – 8,00 €'],
            [5, 'Patrimoine', '8,00 – 10,00 €'],
          ].map(([n, name, range]) => (
            <label key={n} className="row center between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
              <div className="row center gap-3">
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1.5px solid ' + (tierShare[n] ? 'var(--accent)' : 'var(--line-2)'),
                  background: tierShare[n] ? 'var(--accent)' : 'var(--paper)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{tierShare[n] && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}</span>
                <span className="serif" style={{ fontSize: 17 }}>Palier {n}</span>
                <span className="muted" style={{ fontSize: 13 }}>{name}</span>
              </div>
              <span className="mono tnum" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{range}</span>
              <input type="checkbox" checked={tierShare[n]} onChange={() => setTierShare(t => ({...t, [n]: !t[n]}))} style={{ display: 'none' }}/>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapThumb({ radius }) {
  const size = Math.min(200, 40 + radius * 2);
  return (
    <div style={{ height: 220, position: 'relative', marginTop: 18, borderRadius: 10, overflow: 'hidden',
      background: 'linear-gradient(135deg, #EEE9DA, #E2DAC3)',
      border: '1px solid var(--line-2)'
    }}>
      {/* Grid overlay */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="gr" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(15,23,42,.08)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gr)"/>
        {/* roads */}
        <path d="M0 110 Q200 90 400 130" stroke="rgba(15,23,42,.15)" strokeWidth="2" fill="none"/>
        <path d="M180 0 L220 220" stroke="rgba(15,23,42,.12)" strokeWidth="1.5" fill="none"/>
        <path d="M0 60 L400 200" stroke="rgba(15,23,42,.10)" strokeWidth="1" fill="none"/>
      </svg>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: size, height: size,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'color-mix(in oklab, var(--accent) 14%, transparent)',
        border: '1.5px solid var(--accent)',
      }}/>
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 12, height: 12, borderRadius: 999, background: 'var(--accent)', border: '2px solid var(--paper)'
      }}/>
    </div>
  );
}

/* ---------- Parrainage ---------- */
/* Données live depuis Supabase via /api/prospect/parrainage :
   - refCode : code unique persisté (table waitlist) ;
   - filleuls : inscrits ayant utilisé ce code lors de leur propre
     inscription à la liste d'attente ;
   - cap = 10 (hard limit côté DB via trigger BEFORE INSERT). */
function Parrainage() {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/prospect/parrainage', { cache: 'no-store' });
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json?.error || ('HTTP ' + r.status));
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refCode = data?.refCode || '—';
  const cap = data?.cap ?? 10;
  const filleuls = data?.filleuls || [];
  const count = data?.count ?? filleuls.length;
  const link = 'buupp.fr/ref/' + refCode;

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch { return '—'; }
  };

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Parrainage" title="Recommandez, gagnez en cascade" desc={`10% sur vos filleuls directs, 3% sur le niveau 2, 1% sur le niveau 3. Limite : ${cap} filleuls par parrain sur la liste d'attente.`}/>

      <div className="card" style={{ padding: 28, background: 'var(--ink)', color: 'var(--paper)' }}>
        <div className="row between center" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="mono caps" style={{ color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>— Votre lien unique</div>
            <div className="serif" style={{ fontSize: 28 }}>
              buupp.fr/ref/<em style={{ color: '#A5B4FC' }}>{loading ? '…' : refCode}</em>
            </div>
          </div>
          <div className="row gap-2">
            <button
              className="btn"
              disabled={loading || !data}
              style={{ background: 'var(--paper)', color: 'var(--ink)', opacity: loading ? 0.6 : 1 }}
              onClick={() => {
                navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500);
              }}>
              <Icon name="copy" size={14}/> {copied ? 'Copié !' : 'Copier'}
            </button>
            <button className="btn btn-ghost" style={{ color: 'var(--paper)', borderColor: 'rgba(255,255,255,.3)' }}>
              <Icon name="ext" size={14}/> Partager
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, borderLeft: '3px solid #dc2626', background: '#fef2f2', color: '#991b1b', fontSize: 13 }}>
          Impossible de charger vos données de parrainage : {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Filleuls actifs', loading ? '…' : String(count), `/ ${cap} max`],
          ['Places restantes', loading ? '…' : String(Math.max(0, cap - count)), 'avant plafond'],
          ['Gains parrainage', '0,00 €', 'liste d\'attente'],
          ['Statut', count >= cap ? 'Plein' : (count > 0 ? 'Actif' : 'En attente'), count >= cap ? 'Plafond atteint' : 'Invitez vos proches'],
        ].map(([l, v, s], i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>{l}</div>
            <div className="serif tnum" style={{ fontSize: 30 }}>{v}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between center" style={{ marginBottom: 20 }}>
          <div className="serif" style={{ fontSize: 22 }}>Filleuls actifs</div>
          <div className="muted mono" style={{ fontSize: 12 }}>
            {loading ? 'Chargement…' : `${count} / ${cap}`}
          </div>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Nom</th><th>Ville</th><th>Inscrit le</th><th style={{textAlign:'right'}}>Statut</th></tr></thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="muted" style={{ padding: 20, textAlign: 'center' }}>Chargement de vos filleuls…</td></tr>
              )}
              {!loading && filleuls.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                  Vous n'avez pas encore de filleul. Partagez votre lien pour gagner les avantages VIP.
                </td></tr>
              )}
              {!loading && filleuls.map((f, i) => {
                const fullName = `${f.prenom || ''} ${f.nom || ''}`.trim() || '—';
                return (
                  <tr key={i}>
                    <td className="row center gap-3"><Avatar name={fullName} size={28}/><span>{fullName}</span></td>
                    <td className="muted">{f.ville || '—'}</td>
                    <td className="muted mono">{formatDate(f.createdAt)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--good)' }}>Inscrit ✓</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Fiscal ---------- */
function Fiscal() {
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Informations fiscales" title="Récapitulatif annuel" desc="BUPP transmet vos données récapitulatives à la DGFiP dès le dépassement du seuil déclaratif (3 000 € / 20 transactions en 2026)."/>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="mono caps muted" style={{ marginBottom: 10 }}>— Exercice 2026 (en cours)</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="serif tnum" style={{ fontSize: 64 }}>127</span>
            <span className="muted" style={{ fontSize: 16 }}>,40 € cumulés</span>
          </div>
          <div style={{ marginTop: 22 }}>
            <div className="row between" style={{ fontSize: 12, marginBottom: 6 }}>
              <span className="muted">Seuil déclaratif</span>
              <span className="mono tnum">127,40 / 3 000 €</span>
            </div>
            <Progress value={127.40/3000}/>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            Vous n'avez pas atteint le seuil. Aucune obligation de déclaration spécifique pour l'instant.
          </div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="mono caps muted" style={{ marginBottom: 10 }}>— Exercice 2025 (clos)</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="serif tnum" style={{ fontSize: 64 }}>286</span>
            <span className="muted" style={{ fontSize: 16 }}>,40 €</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            Récapitulatif fiscal 2025 transmis le 31 janvier 2026.
          </div>
          <div className="row gap-2" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Récap 2025 (PDF)</button>
            <button className="btn btn-ghost btn-sm"><Icon name="doc" size={12}/> Reçu DGFiP</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Seuils à retenir</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            ['305 €', 'Franchise annuelle', "En dessous, aucune déclaration URSSAF n'est requise."],
            ['3 000 €', 'Seuil DGFiP', "Les plateformes transmettent le récapitulatif des usagers au-dessus de ce montant."],
            ['77 700 €', 'Plafond micro-BIC', "Au-delà, bascule en régime réel. BUPP vous alertera 6 mois avant."],
          ].map((r, i) => (
            <div key={i} style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{r[0]}</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>{r[1]}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{r[2]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProspectDashboard, DashShell, TopBar, SectionTitle, Modal });
