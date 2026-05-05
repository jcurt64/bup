// Prospect dashboard
var { useState, useEffect } = React;

/* ---------- Shared prospect profile store ----------
   Source de vérité côté client pour les données déclarées par le
   prospect. Au montage, hydraté depuis /api/prospect/donnees ; chaque
   mutation est répliquée sur l'API (PATCH/POST) tout en restant
   optimiste côté UI pour ne pas geler le formulaire.

   Toute édition de "Mes données" se propage à :
   - la salutation du header ("Bonjour Marie")
   - l'avatar du topbar (initiales)
   - les onglets Préférences / Score                              */
const EMPTY_TIER = {
  identity:    { prenom: '', nom: '', email: '', telephone: '', naissance: '' },
  localisation:{ adresse: '', ville: '', codePostal: '', logement: '', mobilite: '' },
  vie:         { foyer: '', sports: '', animaux: '', vehicule: '' },
  pro:         { poste: '', statut: '', secteur: '', revenus: '' },
  patrimoine:  { residence: '', epargne: '', projets: '' },
};

const INITIAL_PROFILE = {
  ...EMPTY_TIER,
  // Preference: true = all campaign types, else selected subset
  allCampaignTypes: true,
  campaignTypes: new Set(['Prise de contact', 'Prise de rendez-vous']),
  // Categories authorised (mirrored in Préférences)
  categories: new Set(['Bien-être', 'Artisanat', 'Coaching']),
};

/* Helpers HTTP — fire-and-forget (les erreurs sont loggées mais la
   mutation optimiste UI n'est pas annulée pour ne pas perturber le
   formulaire en cours d'édition). À chaque succès on diffuse un
   `prospect:profile-changed` pour que les composants qui calculent
   un agrégat (BUUPP Score, header pills) puissent se rafraîchir. */
function notifyProfileChanged() {
  try { window.dispatchEvent(new Event('prospect:profile-changed')); } catch (_) {}
}
async function persistFieldUpdate(category, field, value) {
  try {
    const r = await fetch('/api/prospect/donnees', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: category, fields: { [field]: value } }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.warn('[prospect/donnees] PATCH failed', r.status, j);
      return;
    }
    notifyProfileChanged();
  } catch (e) { console.warn('[prospect/donnees] PATCH error', e); }
}
async function persistTierAction(tier, action) {
  try {
    const r = await fetch('/api/prospect/tier', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier, action }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.warn('[prospect/tier] POST failed', r.status, j);
      return;
    }
    notifyProfileChanged();
  } catch (e) { console.warn('[prospect/tier] POST error', e); }
}

const ProspectCtx = React.createContext(null);

function ProspectProvider({ children }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [deleted, setDeleted] = useState({});
  const [removed, setRemoved] = useState({});
  const [hydrated, setHydrated] = useState(false);

  // Hydratation `Mes données` (inchangée).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/prospect/donnees', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setProfile(p => ({
          ...p,
          identity:    { ...p.identity,    ...data.identity },
          localisation:{ ...p.localisation,...data.localisation },
          vie:         { ...p.vie,         ...data.vie },
          pro:         { ...p.pro,         ...data.pro },
          patrimoine:  { ...p.patrimoine,  ...data.patrimoine },
        }));
        const nextDeleted = {};
        (data.hiddenTiers || []).forEach(t => { nextDeleted[t] = true; });
        setDeleted(nextDeleted);
        const nextRemoved = {};
        (data.removedTiers || []).forEach(t => { nextRemoved[t] = true; });
        setRemoved(nextRemoved);
      } catch (e) { console.warn('[prospect/donnees] GET error', e); }
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Relations (pending + history) — fetch initial + revalidation ──
  const [pendingRelations, setPendingRelations] = useState([]);
  const [historyRelations, setHistoryRelations] = useState([]);
  const [relationsHydrated, setRelationsHydrated] = useState(false);

  const refetchRelations = React.useCallback(async () => {
    try {
      const r = await fetch('/api/prospect/relations', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setPendingRelations(j.pending || []);
      setHistoryRelations(j.history || []);
    } catch (e) { console.warn('[prospect/relations] GET error', e); }
    finally { setRelationsHydrated(true); }
  }, []);
  useEffect(() => { refetchRelations(); }, [refetchRelations]);

  const postDecision = async (id, action) => {
    try {
      const r = await fetch(`/api/prospect/relations/${id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.warn('[prospect/relations] decision failed', r.status, j);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[prospect/relations] decision error', e);
      return false;
    }
  };

  // États optimistes locaux pour répondre instantanément.
  const [optimistic, setOptimistic] = useState({}); // id → 'accepted' | 'refused' | 'pending'

  const acceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'accepted' }));
    const ok = await postDecision(id, 'accept');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
  };
  const refuseRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'refused' }));
    const ok = await postDecision(id, 'refuse');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
  };
  const undoAcceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'pending' }));
    const ok = await postDecision(id, 'undo');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
  };
  const undoRefuseRelation = undoAcceptRelation;

  const accepted = {};
  const refused = {};
  pendingRelations.forEach(r => {
    const ov = optimistic[r.id];
    if (ov === 'accepted') accepted[r.id] = true;
    else if (ov === 'refused') refused[r.id] = true;
  });

  const pendingRelationsCount = pendingRelations.filter(
    r => !accepted[r.id] && !refused[r.id]
  ).length;
  const updateField = (category, field, value) => {
    setProfile(p => ({ ...p, [category]: { ...p[category], [field]: value } }));
    // Persiste vers /api/prospect/donnees (PATCH). Optimiste : on n'attend
    // pas la réponse pour mettre à jour l'UI ; les erreurs sont loggées.
    persistFieldUpdate(category, field, value);
  };
  const suppressTemp = (category) => {
    setDeleted(d => ({ ...d, [category]: true }));
    persistTierAction(category, 'hide');
  };
  const restore = (category) => {
    setDeleted(d => { const n = {...d}; delete n[category]; return n; });
    persistTierAction(category, 'restore');
  };
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
    // Côté serveur, le DELETE sur 'identity' déclenche la cascade vers
    // tous les paliers — on n'envoie qu'un seul appel API.
    persistTierAction(category, 'delete');
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
      pendingRelations, historyRelations,
      acceptedRelations: accepted, refusedRelations: refused,
      acceptRelation, refuseRelation, undoAcceptRelation, undoRefuseRelation,
      pendingRelationsCount, relationsHydrated,
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
  { id: 'score',        icon: 'gauge',  label: 'BUUPP Score' },
  { id: 'prefs',        icon: 'sliders', label: 'Préférences' },
  { id: 'parrainage',   icon: 'gift',   label: 'Parrainage' },
  { id: 'fiscal',       icon: 'doc',    label: 'Informations fiscales' },
];

function ProspectDashboard({ go, initialTab }) {
  return (
    <ProspectProvider>
      <ProspectDashboardInner go={go} initialTab={initialTab}/>
    </ProspectProvider>
  );
}

function ProspectDashboardInner({ go, initialTab }) {
  const [sec, setSec] = useState(initialTab || 'portefeuille');
  const { pendingRelationsCount, profile } = useProspect();
  // Inject dynamic badges (e.g. number of pending relations) into the static
  // section descriptors. Keeping the merge here avoids leaking prospect-specific
  // logic into the generic DashShell.
  const sections = PROSPECT_SECTIONS.map(s =>
    s.id === 'relations' ? { ...s, badge: pendingRelationsCount } : s
  );
  // Override live du nom dans le header : reflète instantanément les
  // modifications de l'onglet "Mes données" (palier identification).
  const overrideName = `${profile?.identity?.prenom || ''} ${profile?.identity?.nom || ''}`.trim();
  return (
    <DashShell role="prospect" go={go} sections={sections} current={sec} onNav={setSec}
      header={<ProspectHeader />} overrideName={overrideName}>
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

function DashShell({ role, go, sections, current, onNav, children, header, overrideName }) {
  // Mobile (≤900px) starts with the menu hidden so the dashboard takes full
  // width; on desktop the sidebar is shown expanded by default.
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 900;
  const [collapsed, setCollapsed] = useState(() => isMobile());
  const [deleteOpen, setDeleteOpen] = useState(false);
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
          {/* Action destructive — couleur rouge pour signaler le danger.
              Ouvre la modale de confirmation (DeleteAccountModal). */}
          <div
            className="side-item"
            onClick={() => setDeleteOpen(true)}
            style={{ color: '#dc2626' }}
            title="Supprimer définitivement mon compte"
          >
            <span className="side-icon" style={{ color: '#dc2626' }}>
              <Icon name="trash" size={16}/>
            </span>
            {!collapsed && <span>Supprimer mon compte</span>}
          </div>
        </div>
      </aside>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--ivory)', borderBottom: '1px solid var(--line)' }}>
          <TopBar role={role} go={go} overrideName={overrideName}/>
          {header}
        </div>
        <main style={{ padding: '32px 40px 80px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {children}
        </main>
      </div>
      {deleteOpen && (
        <DeleteAccountModal role={role} onClose={() => setDeleteOpen(false)}/>
      )}
    </div>
  );
}

/* ─── Modale "Supprimer mon compte" ─────────────────────────────────────
   Action destructive irréversible : supprime les données Supabase + le
   compte Clerk. Le message d'avertissement (rouge) varie selon le rôle :
     - prospect : perte du solde des buupp coins (gains en attente de retrait).
     - pro      : perte du solde du crédit non utilisé (non remboursable).
   Le `tip` au-dessus du bouton invite à récupérer les gains (prospect) ou
   à utiliser le crédit restant (pro) avant la suppression. */
function DeleteAccountModal({ role, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tip =
    role === 'prospect'
      ? "Pensez d'abord à récupérer vos gains avant de supprimer votre compte — une fois supprimé, votre solde ne pourra pas être versé."
      : "Pensez d'abord à utiliser tout votre crédit avant de supprimer votre compte — le solde restant ne pourra pas être remboursé.";

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/me', { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || j?.error || ('HTTP ' + r.status));
      }
      // Succès → demande au parent (Next.js) de révoquer la session Clerk
      // et de rediriger vers la landing. Le parent écoute ce message dans
      // PrototypeFrame.tsx (bupp: 'signOut').
      try { window.parent.postMessage({ bupp: 'signOut' }, '*'); } catch (e) {}
    } catch (e) {
      setError(e.message || 'Suppression échouée');
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 24px 110px',
    }}>
      <div style={{
        position: 'relative', maxWidth: 540, width: '100%',
        background: 'var(--paper)', borderRadius: 18, padding: '34px 32px 28px',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0',
        borderTop: '4px solid #dc2626',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 14px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
            fontSize: 26, fontWeight: 700,
          }}>!</div>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.15, marginBottom: 6, color: '#991b1b' }}>
            Suppression définitive du compte
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Cette action est <strong>irréversible</strong>.
          </div>
        </div>

        <div style={{
          padding: '14px 16px', borderRadius: 10,
          background: '#fef2f2', borderLeft: '3px solid #dc2626', border: '1px solid #fca5a5',
          color: '#991b1b', fontSize: 13.5, lineHeight: 1.55, marginBottom: 14,
        }}>
          {role === 'pro' ? (
            <>
              En supprimant définitivement votre compte, vous effacerez
              <strong> toutes vos données personnelles</strong> et perdrez
              <strong> définitivement le solde de votre crédit</strong>.
              Le solde restant ne pourra pas être remboursé, même en recréant
              un nouveau compte avec les mêmes identifiants.
            </>
          ) : (
            <>
              En supprimant définitivement votre compte, vous effacerez
              <strong> toutes vos données personnelles</strong> et perdrez
              <strong> définitivement le solde de vos buupp coins</strong>.
              Vous ne pourrez pas les récupérer, même en recréant un nouveau
              compte avec les mêmes identifiants.
            </>
          )}
        </div>

        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'color-mix(in oklab, #f59e0b 8%, var(--paper))',
          border: '1px solid color-mix(in oklab, #f59e0b 35%, var(--line))',
          color: '#92400e', fontSize: 13, lineHeight: 1.5, marginBottom: 18,
        }}>
          <strong>⚠ Avant de continuer :</strong> {tip}
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#991b1b', fontSize: 12.5, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <div className="row gap-2 modal-actions" style={{ marginTop: 4 }}>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ flex: 1 }}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            className="btn"
            style={{
              flex: 1,
              background: '#dc2626', color: 'white', borderColor: '#dc2626',
              opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Cache module-level pour /api/me — mutualise le fetch entre TopBar et le
   reste du dashboard, et évite de re-frapper l'API à chaque switch d'onglet. */
let _meCache = null;
let _mePromise = null;
function fetchMe() {
  if (_meCache) return Promise.resolve(_meCache);
  if (_mePromise) return _mePromise;
  _mePromise = fetch('/api/me', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { _meCache = j; _mePromise = null; return j; })
    .catch(() => { _mePromise = null; return null; });
  return _mePromise;
}

/* Calcule des initiales à partir d'un nom libre. Stratégie :
     - 2+ mots → première lettre de chacun des 2 premiers (« Marie Leroy » → ML)
     - 1 mot   → 2 premières lettres alpha (« AtelierMercier » → AT)
   Fallback "?" si rien d'exploitable. */
function deriveInitials(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const alpha = parts[0].replace(/[^A-Za-zÀ-ÿ]/g, '');
  return ((alpha.slice(0, 2) || parts[0].slice(0, 2)) || '?').toUpperCase();
}

function TopBar({ role, go, overrideName }) {
  const [me, setMe] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchMe().then(j => { if (!cancelled && j) setMe(j); });
    return () => { cancelled = true; };
  }, []);

  // Fallback initiales si /api/me n'a pas encore répondu — on garde
  // l'ancienne valeur visuelle pour ne pas avoir un avatar vide à l'écran.
  const fallbackInitials = role === 'prospect' ? 'ML' : 'AM';

  // L'override (raison sociale pour pro, prénom+nom pour prospect) prend
  // toujours le pas sur la donnée serveur : il reflète l'état UI le plus
  // récent → le header se met à jour instantanément lorsque l'utilisateur
  // édite ses informations dans "Mes informations" / "Mes données".
  const overrideTrim = (overrideName || '').trim();
  const initials = overrideTrim
    ? (deriveInitials(overrideTrim) || fallbackInitials)
    : (me?.initials || fallbackInitials);
  const displayName = overrideTrim
    || me?.displayName
    || (role === 'prospect' ? 'Marie Leroy' : 'Atelier Mercier');

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
        <div title={displayName}>
          <Avatar name={initials.split('').join(' ')} size={32}/>
        </div>
      </div>
    </div>
  );
}

/* Cache module-level pour /api/prospect/parrainage, /api/prospect/score
   et /api/prospect/wallet afin que ProspectHeader, l'onglet Parrainage,
   l'onglet BUUPP Score et le bandeau de gains se partagent la même
   réponse au sein d'une session de dashboard. Le cache est invalidé à
   chaque mutation profil pour refléter immédiatement les modifications
   faites dans "Mes données". */
const _prospectApiCache = { parrainage: null, score: null, wallet: null, verification: null };
async function fetchCachedJson(key, url) {
  if (_prospectApiCache[key]) return _prospectApiCache[key];
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const json = await r.json();
    _prospectApiCache[key] = json;
    return json;
  } catch (e) {
    return null;
  }
}
function invalidateProspectApiCache() {
  _prospectApiCache.parrainage = null;
  _prospectApiCache.score = null;
  _prospectApiCache.wallet = null;
  _prospectApiCache.verification = null;
}

/* Format euros français : "57,80 €" / "0,00 €". */
const _eurFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
});

function ProspectHeader() {
  const { profile } = useProspect() || {};
  const prenom = profile?.identity?.prenom || 'Marie';
  const [parrainage, setParrainage] = useState(null);
  const [score, setScore] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetchCachedJson('parrainage', '/api/prospect/parrainage').then(j => !cancelled && setParrainage(j));
      fetchCachedJson('score', '/api/prospect/score').then(j => !cancelled && setScore(j));
      fetchCachedJson('wallet', '/api/prospect/wallet').then(j => !cancelled && setWallet(j));
      fetchCachedJson('verification', '/api/prospect/verification').then(j => !cancelled && setVerification(j));
    };
    refresh();
    // Une mutation faite ailleurs (ex. édition dans "Mes données") doit
    // recalculer score / parrainage / wallet → on invalide puis re-fetch.
    const onChange = () => { invalidateProspectApiCache(); refresh(); };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('prospect:profile-changed', onChange);
    };
  }, []);

  const filleulCount = parrainage?.count ?? null;
  const filleulCap = parrainage?.cap ?? 10;
  const parrainageText =
    filleulCount == null ? '…' : `${filleulCount} / ${filleulCap}`;
  const scoreVal = score?.score;
  const scoreText = scoreVal == null ? '…' : `${scoreVal} / 1000`;
  // Tant que /api/prospect/wallet n'a pas répondu, on garde "…" plutôt
  // que 0 € (évite un flash trompeur). Une fois la réponse reçue, on
  // affiche le vrai cumul du mois (par défaut 0 € si aucun gain).
  const gainsText = wallet == null
    ? '…'
    : _eurFmt.format(Number(wallet.monthGainsEur ?? 0));

  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— Bonjour {prenom || '—'}</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            Vos gains du mois : <em>{gainsText}</em>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            3 mises en relation en attente · prochaine échéance dans 14 h 22 min
          </div>
        </div>
        <div className="row center gap-6">
          <StatusPill
            label="Vérification"
            value={verification
              ? `${VERIF_LABELS[verification.tier] || 'Basique'} ${verification.progress ?? 33}%`
              : '…'}
            chip={
              verification?.tier === 'certifie_confiance' ? 'chip-good' :
              verification?.tier === 'verifie' ? 'chip-accent' :
              ''
            }
          />
          <StatusPill label="BUUPP Score" value={scoreText} chip="chip-good"/>
          <StatusPill label="Parrainages" value={parrainageText} chip=""/>
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
  const [wallet, setWallet] = useState(null);
  const [movements, setMovements] = useState(null);

  // Hydrate les 3 cartes (Disponible / En séquestre / Cumulé depuis ouverture)
  // depuis /api/prospect/wallet. Re-fetch sur prospect:profile-changed pour
  // refléter immédiatement un nouveau crédit ou retrait.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetchCachedJson('wallet', '/api/prospect/wallet').then(j => !cancelled && setWallet(j));
      // Historique : toujours en no-cache module-level pour suivre les
      // mutations (acceptation d'une relation, retrait, parrainage…).
      fetch('/api/prospect/movements', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(j => !cancelled && setMovements(j))
        .catch(() => { if (!cancelled) setMovements({ movements: [] }); });
    };
    refresh();
    const onChange = () => { invalidateProspectApiCache(); refresh(); };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('prospect:profile-changed', onChange); };
  }, []);

  // Helpers de formatage : "0,00" / "284,50" (séparateur fr-FR, 2 décimales).
  const fmt = (eur) => Number(eur || 0).toFixed(2).replace('.', ',');
  const availableEur = wallet?.availableEur ?? 0;
  const availableCoins = Math.round((wallet?.availableCents ?? 0));
  const lifetimeEur = wallet?.lifetimeGainsEur ?? 0;
  const lifetimeCoins = Math.round((wallet?.lifetimeGainsCents ?? 0));
  const escrowEur = wallet?.escrowEur ?? 0;
  const escrowCoins = Math.round((wallet?.escrowCents ?? 0));
  const threshold = wallet?.withdrawThresholdEur ?? 5;
  const canWithdraw = wallet?.canWithdraw ?? false;
  const relationsCount = wallet?.relationsCount ?? 0;

  // Sous-titre "Cumulé depuis ouverture" : nombre de mois écoulés depuis
  // la création du compte + nombre réel de mises en relation reçues.
  const lifetimeSub = (() => {
    const created = wallet?.accountCreatedAt ? new Date(wallet.accountCreatedAt) : null;
    const rel = `${relationsCount} mise${relationsCount > 1 ? 's' : ''} en relation`;
    if (!created || Number.isNaN(created.getTime())) return rel;
    const now = new Date();
    const months = Math.max(
      0,
      (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()),
    );
    return `${months} mois · ${rel}`;
  })();

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Portefeuille" title="Votre capital" desc="Solde disponible, fonds en séquestre jusqu'à validation, gains cumulés depuis l'ouverture."/>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20 }}>
        <BalanceCard
          big
          label="Disponible"
          value={fmt(availableEur)}
          coins={availableCoins.toLocaleString('fr-FR')}
          sub={canWithdraw
            ? 'Retirable immédiatement'
            : `Retirable à partir de ${threshold} € de gains`}
          primary
          action={
            <button
              className="btn btn-accent"
              onClick={() => canWithdraw && setModal('retrait')}
              disabled={!canWithdraw}
              style={{
                opacity: canWithdraw ? 1 : 0.5,
                cursor: canWithdraw ? 'pointer' : 'not-allowed',
              }}
              title={canWithdraw ? '' : `Disponible à partir de ${threshold} €`}
            >
              Retirer mes gains <Icon name="arrow" size={14}/>
            </button>
          }
        />
        <BalanceCard
          label="En séquestre"
          value={fmt(escrowEur)}
          coins={escrowCoins.toLocaleString('fr-FR')}
          sub="Déblocage sous 72 h"
          lock
        />
        <BalanceCard
          label="Cumulé depuis ouverture"
          value={fmt(lifetimeEur)}
          coins={lifetimeCoins.toLocaleString('fr-FR')}
          sub={lifetimeSub}
        />
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
              {!movements ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 13 }}>
                  Chargement de l'historique…
                </td></tr>
              ) : (movements.movements || []).length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 13 }}>
                  Aucun mouvement pour le moment.
                </td></tr>
              ) : (movements.movements || []).map((m) => {
                const dateLabel = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })
                  .format(new Date(m.date));
                const amountStr = `${m.sign}${fmt(Math.abs(m.amountEur))}`;
                return (
                  <tr key={m.id}>
                    <td className="mono" style={{ color: 'var(--ink-4)' }}>{dateLabel}</td>
                    <td>{m.origin}</td>
                    <td>{m.tier == null
                      ? <span className="muted">—</span>
                      : <span className="chip">Palier {m.tier}</span>}</td>
                    <td><span className={'chip ' + (m.statusChip ? 'chip-' + m.statusChip : '')}>{m.statusLabel}</span></td>
                    <td style={{ textAlign: 'right' }} className="mono tnum">
                      <span style={{ color: m.amountCents >= 0 ? 'var(--good)' : 'var(--ink-3)' }}>{amountStr} €</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'retrait' && (
        <RetraitModal
          onClose={() => setModal(null)}
          availableEur={availableEur}
          threshold={threshold}
        />
      )}
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
        <span className="mono tnum">{coins} BUUPP Coins</span>
      </div>
      <div style={{ fontSize: 12, color: primary ? 'rgba(255,255,255,.5)' : 'var(--ink-5)', marginTop: 14 }}>{sub}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

/* Modale de retrait — branchée sur Stripe Connect Express.
   Selon l'état d'onboarding du prospect (fetched via /api/prospect/payout/status) :
     - pas de compte Connect ou onboarding incomplet → CTA d'onboarding
       qui redirige vers le tunnel hébergé Stripe.
     - payouts_enabled → formulaire de retrait, POST sur /api/prospect/payout/withdraw.
   La transaction est créée en `pending` côté serveur, puis passée à
   `completed` par le webhook `transfer.created`. */
function RetraitModal({ onClose, availableEur = 0, threshold = 5 }) {
  const [status, setStatus] = useState(null); // {hasAccount, payoutsEnabled, detailsSubmitted}
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState(Math.max(threshold, availableEur));
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/prospect/payout/status', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) { setStatus(j); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const startOnboarding = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/prospect/payout/onboarding', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j?.url) throw new Error(j?.message || j?.error || 'Erreur onboarding');
      // Redirige le top-level (sortir de l'iframe) vers le tunnel Stripe.
      try { window.top.location.href = j.url; } catch { window.location.href = j.url; }
    } catch (err) {
      setError(err.message || 'Erreur onboarding');
      setSubmitting(false);
    }
  };

  const submitWithdraw = async () => {
    const eurValue = Math.max(0, Number(amount) || 0);
    if (eurValue < threshold) { setError(`Minimum ${threshold} €.`); return; }
    if (eurValue > availableEur) { setError('Solde insuffisant.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/prospect/payout/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountCents: Math.round(eurValue * 100) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || 'Erreur retrait');
      setDone(true);
      try { window.dispatchEvent(new Event('prospect:profile-changed')); } catch {}
    } catch (err) {
      setError(err.message || 'Erreur retrait');
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle = `Solde disponible : ${availableEur.toFixed(2).replace('.', ',')} € · Virement vers votre IBAN sous 1–3 jours ouvrés`;

  return (
    <Modal onClose={onClose} title="Retirer mes gains" subtitle={subtitle}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
          Chargement de votre compte Stripe…
        </div>
      ) : done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 16 }}>
            <Icon name="check" size={22} stroke={2}/>
          </div>
          <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Retrait enregistré</div>
          <div className="muted" style={{ fontSize: 14 }}>Le virement sera versé sur l'IBAN renseigné chez Stripe sous 1 à 3 jours ouvrés.</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Fermer</button>
        </div>
      ) : !status?.payoutsEnabled ? (
        <div>
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--ivory-2)', marginBottom: 18 }}>
            <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>
              {status?.hasAccount ? 'Finalisez votre onboarding Stripe' : 'Activez vos retraits'}
            </div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Pour recevoir vos gains sur votre IBAN, vous devez d'abord créer un compte Stripe Connect (procédure hébergée par Stripe, ~3 minutes : justificatif d'identité + IBAN). Vos données ne transitent jamais par BUUPP.
            </div>
          </div>
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12.5, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div className="row between center" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Plus tard</button>
            <button className="btn btn-primary btn-sm" onClick={startOnboarding} disabled={submitting}>
              {submitting ? 'Redirection…' : (status?.hasAccount ? 'Reprendre l\'onboarding' : 'Activer mes retraits')} <Icon name="arrow" size={12}/>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="label" style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
            Montant à retirer (en €)
          </div>
          <input
            type="number"
            min={threshold}
            max={availableEur}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="input mono"
            style={{ width: '100%', padding: '10px 12px', fontSize: 18 }}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Min {threshold} € · Max {availableEur.toFixed(2).replace('.', ',')} € · Virement vers Stripe puis IBAN
          </div>
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12.5, marginTop: 14 }}>
              {error}
            </div>
          )}
          <div className="row between center" style={{ marginTop: 20 }}>
            <div className="muted" style={{ fontSize: 12 }}>Seuil de retrait : {threshold} €</div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={submitWithdraw} disabled={submitting}>
                {submitting ? 'Retrait…' : 'Confirmer le retrait'}
              </button>
            </div>
          </div>
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
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Plus votre profil est complet, plus votre BUUPP Score augmente.</div>
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
function formatHistoryDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short',
  }).format(d);
}

function Relations() {
  const {
    pendingRelations: pending,
    historyRelations,
    acceptedRelations: accepted,
    refusedRelations: refused,
    acceptRelation, refuseRelation,
    undoAcceptRelation, undoRefuseRelation,
    relationsHydrated,
  } = useProspect();
  // Historique : chaque ligne reste un objet complet pour pouvoir
  // ouvrir RelationDetailModal au clic (et exposer le bouton "Accepter
  // la campagne" tant qu'elle est ouverte).
  const history = historyRelations || [];
  // Filtre cyclique sur l'historique : toutes → acceptées → refusées → toutes
  const [historyFilter, setHistoryFilter] = useState('all');
  const HISTORY_FILTERS = [
    { key: 'all',      label: 'Toutes' },
    { key: 'accepted', label: 'Acceptées' },
    { key: 'refused',  label: 'Refusées' },
  ];
  const filteredHistory = history.filter(h =>
    historyFilter === 'all' ||
    (historyFilter === 'accepted' && h.decision === 'Acceptée') ||
    (historyFilter === 'refused'  && h.decision === 'Refusée')
  );
  // Modale "détails de l'offre" — affiche toutes les infos campagne (dates,
  // brief texte, motif complet, palier, récompense) au clic sur le bouton +.
  const [detail, setDetail] = useState(null); // l'objet pending sélectionné
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Mises en relation" title="Demandes en attente" desc="Vous avez 72 heures pour accepter ou refuser chaque demande. Sans réponse, elle expire."/>
      {!relationsHydrated ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>Chargement de vos sollicitations…</div>
        </div>
      ) : pending.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>Aucune demande en attente pour le moment.</div>
        </div>
      ) : (
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
      )}

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
              {filteredHistory.map((h) => {
                const gainStr = h.gain != null ? '+' + h.gain.toFixed(2).replace('.', ',') : '—';
                // Lignes cliquables — ouvrent RelationDetailModal pour voir le
                // détail de la campagne + accepter rétroactivement si elle est
                // encore ouverte (cf. h.campaignOpen côté API).
                return (
                  <tr key={h.id}
                    onClick={() => setDetail(h)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(h); } }}
                    style={{ cursor: 'pointer' }}
                    title="Voir le détail de la campagne"
                  >
                    <td className="mono" style={{ color: 'var(--ink-4)' }}>{formatHistoryDate(h.date)}</td>
                    <td>{h.proName}</td>
                    <td><span className="chip">Palier {h.tier}</span></td>
                    <td><span className={'chip ' + (h.decision === 'Acceptée' ? 'chip-good' : '')}>{h.decision}</span></td>
                    <td className="muted">{h.status}</td>
                    <td className="mono tnum" style={{ textAlign: 'right', color: gainStr === '—' ? 'var(--ink-5)' : 'var(--good)' }}>{gainStr === '—' ? '—' : gainStr + ' €'}</td>
                  </tr>
                );
              })}
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
  // Mode "historique" — la relation a un decision/relationStatus venant
  // de /api/prospect/relations#history. Sinon c'est une carte pending.
  const isHistory = typeof r.relationStatus === 'string' || typeof r.decision === 'string';
  const alreadyAccepted = isAccepted || r.relationStatus === 'accepted' || r.relationStatus === 'settled';
  const alreadyRefused = isRefused || r.relationStatus === 'refused';
  // Fenêtre d'acceptation : pour pending, on s'appuie sur l'état optimiste
  // (ni accepté ni refusé). Pour l'historique, on autorise l'acceptation
  // tant que la campagne est ouverte (campaignOpen renvoyé par l'API).
  const canAccept = isHistory
    ? !!r.campaignOpen
    : !alreadyAccepted && !alreadyRefused;
  // Refus possible :
  //   - pending (carte) tant que la décision n'est pas prise
  //   - historique déjà acceptée (accepted/settled) si la campagne est
  //     encore active — refund_relation_tx remboursera le pro et annulera
  //     la transaction prospect (escrow pending OU credit completed).
  const canRefuse =
    (!isHistory && !alreadyAccepted && !alreadyRefused) ||
    (isHistory && alreadyAccepted && !!r.campaignActive);
  return (
    <ModalShell title="Détails de l'offre" onClose={onClose} width={520}>
      <div className="col gap-4">
        {/* Bannière contextuelle pour l'historique : explique pourquoi
            l'acceptation reste possible (ou pas) au moment du clic. */}
        {isHistory && (
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: alreadyAccepted
              ? 'color-mix(in oklab, var(--good) 10%, var(--paper))'
              : canAccept
                ? 'color-mix(in oklab, var(--accent) 8%, var(--paper))'
                : 'var(--ivory-2)',
            border: '1px solid ' + (alreadyAccepted
              ? 'color-mix(in oklab, var(--good) 35%, var(--line))'
              : canAccept
                ? 'color-mix(in oklab, var(--accent) 28%, var(--line))'
                : 'var(--line)'),
            color: 'var(--ink)',
            fontSize: 13, lineHeight: 1.5,
          }}>
            {alreadyAccepted ? (
              <>
                <strong>Déjà accepté</strong> — votre récompense est dans votre portefeuille
                {r.relationStatus === 'settled' ? ' (créditée)' : ' (en séquestre)'}.
              </>
            ) : canAccept ? (
              <>
                Cette campagne est <strong>encore ouverte</strong> — vous pouvez l'accepter
                rétroactivement.
              </>
            ) : (
              <>Cette campagne est <strong>clôturée</strong>, l'acceptation n'est plus possible.</>
            )}
          </div>
        )}
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
              <Icon name="bolt" size={10}/>{' '}
              {isHistory
                ? (canAccept ? 'Campagne ouverte jusqu\'au' : 'Campagne')
                : 'Vous avez encore'}
            </div>
            <div className="mono" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
              {isHistory
                ? (canAccept ? formatRelationDate(r.endDate) : 'Clôturée')
                : r.timer}
            </div>
          </div>
        </div>

        {/* Actions
            Layout desktop (flex-end) :
              - pending           : [Refuser]  [Accepter]
              - history+canAccept : [Fermer]   [Accepter la campagne]
              - history+accepted  : [Refuser ……………………………… Fermer]
                                    (Refuser ancré à gauche via marginRight:auto)
              - history+closed    : [Fermer]
            L'ordre JSX place toujours le CTA principal en dernier — sur
            mobile (≤600px, .modal-actions = column-reverse + width 100%
            via styles.css), c'est lui qui remonte en haut, accessible
            au pouce.
        */}
        <div className="row gap-2 modal-actions" style={{
          justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center', rowGap: 8,
        }}>
          {/* === Pending (carte demande en attente) ============================== */}
          {!isHistory && canRefuse && (
            <button onClick={onRefuse} className="btn btn-ghost btn-sm">Refuser</button>
          )}
          {!isHistory && canAccept && (
            <button onClick={onAccept} className="btn btn-primary btn-sm">
              <Icon name="check" size={12} stroke={2.25}/> Accepter
            </button>
          )}
          {!isHistory && !canAccept && !canRefuse && (
            <button onClick={onClose} className="btn btn-primary btn-sm">Fermer</button>
          )}

          {/* === Historique : déjà acceptée + campagne encore active ============== */}
          {isHistory && alreadyAccepted && canRefuse && (
            <button
              onClick={onRefuse}
              className="btn btn-ghost btn-sm modal-action-left"
              style={{ marginRight: 'auto', color: 'var(--danger)' }}
              title="Annuler votre acceptation et rembourser le professionnel"
            >
              Refuser
            </button>
          )}
          {isHistory && alreadyAccepted && (
            <button onClick={onClose} className="btn btn-primary btn-sm">Fermer</button>
          )}

          {/* === Historique : pas encore acceptée, campagne ouverte ============== */}
          {isHistory && !alreadyAccepted && canAccept && (
            <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
          )}
          {isHistory && !alreadyAccepted && canAccept && (
            <button onClick={onAccept} className="btn btn-primary btn-sm">
              <Icon name="check" size={12} stroke={2.25}/> Accepter la campagne
            </button>
          )}

          {/* === Historique : campagne clôturée, pas d'action possible =========== */}
          {isHistory && !alreadyAccepted && !canAccept && (
            <button onClick={onClose} className="btn btn-primary btn-sm">Fermer</button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Verif tiers ---------- */
/* ─── Verification (3 paliers) ──────────────────────────────────────
   Modèle métier (enums Supabase) :
     basique           — créé par défaut à l'ouverture du compte.
     verifie           — RIB renseigné + auto-validé.
     certifie_confiance — au moins une mise en relation acceptée
                          issue d'une campagne 'prise_de_rendez_vous'.
   Données récupérées via /api/prospect/verification (recalcul + persist
   à chaque GET). Le re-fetch est aussi déclenché par le bus
   `prospect:profile-changed` (ex. après upsert RIB). */
const VERIF_TIERS = [
  {
    key: 'basique',
    label: 'Basique',
    done: 'Compte créé',
    requirement: "Création du compte",
    nextLabel: 'Première étape',
  },
  {
    key: 'verifie',
    label: 'Vérifié',
    done: "RIB renseigné et validé",
    requirement: "Renseignez vos coordonnées bancaires (RIB) pour passer au palier Vérifié.",
    nextLabel: 'Prochaine étape',
  },
  {
    key: 'certifie_confiance',
    label: 'Certifié confiance',
    done: "Rendez-vous physique accepté",
    requirement: "Acceptez un rendez-vous physique proposé par un professionnel.",
    nextLabel: 'Dernière étape',
  },
];
const VERIF_LABELS = {
  basique: 'Basique',
  verifie: 'Vérifié',
  certifie_confiance: 'Certifié confiance',
};

function VerifTiers() {
  const [data, setData] = useState(null);
  const [ribOpen, setRibOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchCachedJson('verification', '/api/prospect/verification').then(j => !cancelled && setData(j));
    refresh();
    const onChange = () => { invalidateProspectApiCache(); refresh(); };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('prospect:profile-changed', onChange); };
  }, []);

  const tier = data?.tier || 'basique';
  const currentIdx = Math.max(0, VERIF_TIERS.findIndex(t => t.key === tier));
  const pct = data?.progress ?? 33;
  const ribValidated = data?.rib?.validated;
  const ibanMasked = data?.rib?.ibanMasked;


  return (
    <div className="col gap-6">
      <SectionTitle
        eyebrow="Paliers de vérification"
        title="Vos paliers"
        desc="Trois paliers : Basique (à la création), Vérifié (RIB renseigné), Certifié confiance (rendez-vous physique accepté). Chaque palier débloque des demandes plus exigeantes et mieux rémunérées."
      />
      <div className="card" style={{ padding: 32 }}>
        {/* Progress dots line */}
        <div style={{ position: 'relative', padding: '0 0 24px' }}>
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, height: 2, background: 'var(--line)' }}/>
          <div style={{
            position: 'absolute', top: 14, left: 14,
            width: `calc(${(currentIdx)/(VERIF_TIERS.length-1)*100}% - 28px)`,
            height: 2, background: 'var(--accent)',
            transition: 'width .3s'
          }}/>
          <div className="row between">
            {VERIF_TIERS.map((t, i) => (
              <div key={t.key} style={{ textAlign: 'center', zIndex: 1, width: 160 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: i <= currentIdx ? 'var(--accent)' : 'var(--paper)',
                  border: '2px solid ' + (i <= currentIdx ? 'var(--accent)' : 'var(--line-2)'),
                  color: i <= currentIdx ? 'white' : 'var(--ink-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', fontSize: 12, fontFamily: 'var(--mono)'
                }}>{i < currentIdx ? '✓' : i + 1}</div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: i === currentIdx ? 500 : 400 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 colonnes équidistantes, alignées avec les 3 pastilles de
            progression au-dessus. Chaque colonne décrit l'état d'un
            palier (Validé / Palier actuel / Prochaine étape / Dernière
            étape). Le mapping des libellés est dynamique : il dépend du
            palier courant — pour un prospect "Basique", on aura
            Basique → Palier actuel · Vérifié → Prochaine étape ·
            Certifié confiance → Dernière étape. */}
        <div style={{
          borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 24,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
        }}>
          {VERIF_TIERS.map((t, i) => {
            const reached = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const label = isCurrent
              ? 'Palier actuel'
              : i < currentIdx
                ? 'Palier validé'
                : t.nextLabel;
            // CTA disponible uniquement pour le palier "Vérifié" non
            // encore atteint (ouverture de la modale RIB).
            const showRibCta = !reached && t.key === 'verifie';
            return (
              <div key={t.key} style={{ textAlign: 'center', minWidth: 0 }}>
                <div className="mono caps muted" style={{ marginBottom: 10, fontSize: 10, letterSpacing: '.14em' }}>
                  — {label}
                </div>
                <div className="serif" style={{ fontSize: isCurrent ? 24 : 18, marginBottom: 6 }}>
                  {t.label}
                  {isCurrent && (
                    <span className="muted" style={{ fontSize: 14 }}> {pct}%</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>
                  {reached ? `${t.done}.` : t.requirement}
                </p>
                {isCurrent && ribValidated && ibanMasked && (
                  <div className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>RIB : {ibanMasked}</div>
                )}
                {showRibCta && (
                  <button
                    onClick={() => setRibOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 12 }}
                  >
                    {ribValidated ? 'Modifier mon RIB' : 'Renseigner mon RIB'}{' '}
                    <Icon name="arrow" size={12}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {VERIF_TIERS.map((t, i) => {
          const reached = i <= currentIdx;
          return (
            <div key={t.key} className="card" style={{
              padding: 20,
              background: i === currentIdx ? 'var(--paper)' : 'var(--ivory-2)',
              borderColor: i === currentIdx ? 'var(--ink)' : 'var(--line)',
            }}>
              <div className="row between center" style={{ marginBottom: 10 }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>Palier {i + 1}</div>
                {reached
                  ? <span className="chip chip-good"><Icon name="check" size={10}/> Validé</span>
                  : <span className="chip">À venir</span>}
              </div>
              <div className="serif" style={{ fontSize: 22, marginBottom: 10 }}>{t.label}</div>
              {/* Pour chaque carte, on affiche le même format en deux lignes :
                  (1) un sous-titre "eyebrow" qui qualifie l'étape (Première /
                      Étape suivante / Dernière étape),
                  (2) la description : ce qui a été validé pour les paliers
                      atteints, ou le prérequis pour les paliers à venir.
                  Cela harmonise visuellement les 3 cartes (notamment "Certifié
                  confiance" qui rappelle le rendez-vous physique requis). */}
              <div className="mono caps muted" style={{ fontSize: 9, letterSpacing: '.14em', marginBottom: 4 }}>
                — {reached ? 'Validé' : t.nextLabel}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                {reached ? t.done : t.requirement}
              </div>
            </div>
          );
        })}
      </div>

      {ribOpen && <RibModal initial={data?.rib} onClose={() => setRibOpen(false)}/>}
    </div>
  );
}

/* Modale "Renseigner mon RIB" — IBAN + BIC + nom du titulaire.
   Validation côté serveur (longueur + alphanumérique). À la confirmation,
   notifie `prospect:profile-changed` pour propager la mise à jour du
   palier de vérification dans tout le dashboard. */
function RibModal({ initial, onClose }) {
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [holderName, setHolderName] = useState(initial?.holderName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/prospect/rib', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iban, bic, holderName }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || j?.error || 'Erreur');
      try { window.dispatchEvent(new Event('prospect:profile-changed')); } catch {}
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15,22,41,0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 24px 110px',
    }}>
      <form onSubmit={submit} style={{
        position: 'relative', maxWidth: 520, width: '100%',
        background: 'var(--paper)', borderRadius: 18, padding: '32px 32px 26px',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0',
      }}>
        <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Coordonnées bancaires</div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          La saisie de votre RIB validera automatiquement le palier <strong>Vérifié</strong>.
          {initial?.ibanMasked ? <> RIB actuel : <span className="mono">{initial.ibanMasked}</span>.</> : null}
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
          IBAN
        </label>
        <input
          className="input"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="FR76 1234 5678 9012 3456 7890 123"
          autoComplete="off"
          spellCheck={false}
          style={{ width: '100%', marginBottom: 14, fontFamily: 'var(--mono)' }}
          required
        />

        <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
          BIC <span className="muted">(optionnel)</span>
        </label>
        <input
          className="input"
          value={bic}
          onChange={(e) => setBic(e.target.value)}
          placeholder="BNPAFRPPXXX"
          autoComplete="off"
          spellCheck={false}
          style={{ width: '100%', marginBottom: 14, fontFamily: 'var(--mono)' }}
        />

        <label style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
          Titulaire du compte
        </label>
        <input
          className="input"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Marie Leroy"
          style={{ width: '100%', marginBottom: 14 }}
          required
        />

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#991b1b', fontSize: 12.5, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <div className="row gap-2" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Score panel ---------- */
function ScorePanel() {
  const { profile } = useProspect() || {};
  const prenom = profile?.identity?.prenom || 'Marie';
  const nomInitial = (profile?.identity?.nom || 'L.').charAt(0) + '.';

  // Récupère le score live depuis /api/prospect/score (cache mutualisé
  // avec le header). Re-fetch si une mutation profil est diffusée.
  const [score, setScore] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchCachedJson('score', '/api/prospect/score').then(j => !cancelled && setScore(j));
    const onChange = () => {
      invalidateProspectApiCache();
      fetchCachedJson('score', '/api/prospect/score').then(j => !cancelled && setScore(j));
    };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('prospect:profile-changed', onChange);
    };
  }, []);

  const value = score?.score ?? 0;
  // Bandeau qualitatif aligné sur la grille de la landing.
  const tier =
    value >= 900 ? { label: 'Prestige', color: '#166534' }
    : value >= 700 ? { label: 'Recherchée', color: 'var(--accent)' }
    : value >= 400 ? { label: 'Solide', color: '#A16207' }
    : { label: 'Découverte', color: '#B91C1C' };

  const completeness = score?.breakdown?.completeness;
  const freshness = score?.breakdown?.freshness;
  const acceptance = score?.breakdown?.acceptance;

  // Conseils dynamiques : on affiche en priorité les axes les plus bas.
  const tips = [];
  if (completeness && completeness.filled < completeness.total) {
    const missing = completeness.total - completeness.filled;
    tips.push([
      `Complétez ${missing > 1 ? 'vos paliers manquants' : 'votre dernier palier'}`,
      `+${missing * 67} pts estimés`,
      `Chaque palier renseigné pèse ${Math.round(completeness.perTier)} % de la complétude (${completeness.filled}/${completeness.total} validés).`,
      'chart',
    ]);
  }
  if (freshness && freshness.pct < 100) {
    tips.push([
      'Rafraîchissez vos données',
      `+${Math.round((100 - freshness.pct) * 0.33)} pts estimés`,
      freshness.lastUpdate
        ? "Vos infos n'ont pas été mises à jour depuis plus d'un an — ré-éditez un champ pour réenclencher la fraîcheur."
        : "Renseignez au moins un champ de chaque palier pour amorcer le score de fraîcheur.",
      'sparkle',
    ]);
  }
  if (acceptance && acceptance.total > 0 && acceptance.pct < 80) {
    tips.push([
      'Acceptez plus de mises en relation',
      `+${Math.round((80 - acceptance.pct) * 0.33)} pts estimés`,
      `Votre taux actuel est de ${acceptance.pct}% (${acceptance.accepted}/${acceptance.total}). Cible : 80 %.`,
      'inbox',
    ]);
  } else if (acceptance && acceptance.total === 0) {
    tips.push([
      'Vos premières sollicitations arrivent',
      '+0 pts pour l\'instant',
      "Le taux d'acceptation entrera en vigueur dès la première mise en relation reçue.",
      'inbox',
    ]);
  }
  // Garantit toujours 3 cartes pour conserver la grille 3 colonnes.
  while (tips.length < 3) {
    tips.push(['Passez au palier Confiance', '+80 pts estimés', 'Téléversez votre justificatif de domicile.', 'shield']);
  }

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="BUUPP Score" title="Votre indice de désirabilité" desc="Un score sur 1000 calculé à partir de la complétude de vos paliers, de la fraîcheur de vos données et de votre taux d'acceptation."/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <ScoreGauge value={value} size={240}/>
          <div className="serif italic" style={{ fontSize: 22, marginTop: 16, color: tier.color }}>{tier.label}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{prenom} {nomInitial}</div>
          <div className="col gap-2" style={{ marginTop: 22, borderTop: '1px solid var(--line)', paddingTop: 16, fontSize: 12, textAlign: 'left' }}>
            {[
              ['Complétude des paliers', completeness?.pct ?? 0, completeness ? `${completeness.filled}/${completeness.total} paliers` : null],
              ['Fraîcheur des données', freshness?.pct ?? 0, freshness?.ageDays != null ? `${freshness.ageDays} j` : null],
              ["Taux d'acceptation", acceptance?.pct ?? 0, acceptance ? `${acceptance.accepted}/${acceptance.total}` : null],
            ].map(([l, v, sub], i) => (
              <div key={i}>
                <div className="row between" style={{ marginBottom: 4, letterSpacing: '.04em' }}>
                  <span className="muted">{l}</span>
                  <span className="mono tnum">{v}%{sub ? ` · ${sub}` : ''}</span>
                </div>
                <Progress value={v / 100} />
              </div>
            ))}
          </div>
        </div>
        <ScoreEvolution/>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 18 }}>Conseils pour améliorer votre score</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {tips.slice(0, 3).map((c, i) => (
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

/* Section "Évolution du BUUPP Score" : sélecteur de fenêtre + courbe.
   Les chips 1M/3M/6M/12M deviennent des boutons fonctionnels qui
   re-fetchent /api/prospect/score/history avec le param `range`. La
   table source est `prospect_score_history` (1 snapshot par jour),
   alimentée par /api/prospect/score à chaque consultation du panel. */
const SCORE_RANGES = ['1M', '3M', '6M', '12M'];
const SCORE_RANGE_LABELS = {
  '1M': 'Évolution sur 1 mois',
  '3M': 'Évolution sur 3 mois',
  '6M': 'Évolution sur 6 mois',
  '12M': 'Évolution sur 12 mois',
};

function ScoreEvolution() {
  const [range, setRange] = useState('6M');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/prospect/score/history?range=${range}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) { setHistory(j); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    // Tout changement de profil → ré-évalue le score (et son snapshot
    // du jour) → on re-fetch la courbe pour intégrer immédiatement le
    // nouveau point.
    const onChange = () => {
      fetch(`/api/prospect/score/history?range=${range}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(j => !cancelled && setHistory(j));
    };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('prospect:profile-changed', onChange);
    };
  }, [range]);

  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 22 }}>{SCORE_RANGE_LABELS[range]}</div>
        <div className="row gap-2">
          {SCORE_RANGES.map(r => {
            const active = range === r;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="chip"
                aria-pressed={active}
                style={{
                  cursor: 'pointer',
                  background: active ? 'var(--ink)' : 'var(--ivory-2)',
                  color: active ? 'var(--paper)' : 'var(--ink-3)',
                  border: 0,
                  fontWeight: active ? 600 : 400,
                  transition: 'background .15s, color .15s',
                }}>
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <ScoreChart points={history?.points || []} loading={loading} range={range}/>
    </div>
  );
}

/* Trace SVG des snapshots de score. L'axe Y s'auto-ajuste sur la
   plage [min, max] des points présents (avec une marge), pour rester
   lisible même quand le score reste plat. Si aucune donnée → message
   "pas encore d'historique". */
function ScoreChart({ points, loading, range }) {
  const W = 600, H = 180, P = 28;

  if (!points || points.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
        {loading
          ? 'Chargement de l\'historique…'
          : `Pas encore d'historique sur ${range}. Votre score sera enregistré à chaque consultation de cet onglet.`}
      </div>
    );
  }

  // Si un seul point, on duplique pour pouvoir tracer une ligne.
  const data = points.length === 1
    ? [points[0], { ...points[0] }]
    : points;

  const scores = data.map(p => Number(p.score) || 0);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  // Plage Y : on garantit au moins 100 pts d'amplitude pour éviter une
  // courbe écrasée quand le score est stable.
  const span = Math.max(100, rawMax - rawMin);
  const center = (rawMin + rawMax) / 2;
  const min = Math.max(0, Math.floor((center - span) / 50) * 50);
  const max = Math.min(1000, Math.ceil((center + span) / 50) * 50);

  const x = i => P + (i / (data.length - 1)) * (W - 2 * P);
  const y = v => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P);

  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.score)}`).join(' ');
  const area = `${line} L ${x(data.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`;

  // 3 graduations Y équidistantes entre min et max (arrondies).
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {ticks.map(v => (
        <g key={v}>
          <line x1={P} x2={W-P} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+4} y={y(v)+3} fontSize="10" fill="var(--ink-5)" fontFamily="monospace">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#g1)"/>
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.score)} r="3" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5">
          <title>{p.date} · {p.score}</title>
        </circle>
      ))}
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
  // Hydrate les deux cartes "Récapitulatif annuel" (exercice en cours + N-1)
  // depuis /api/prospect/fiscal. Refetch sur prospect:profile-changed pour
  // refléter immédiatement un nouveau crédit qui ferait évoluer le cumul.
  const [fiscal, setFiscal] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch('/api/prospect/fiscal', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(j => !cancelled && setFiscal(j))
        .catch(() => { if (!cancelled) setFiscal(null); });
    refresh();
    const onChange = () => refresh();
    window.addEventListener('prospect:profile-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('prospect:profile-changed', onChange); };
  }, []);

  // Format €1 234,56 → ['1 234', '56'] pour rendre la partie entière en gros
  // chiffre serif et les centimes en petit, comme dans le design existant.
  const splitEur = (eur) => {
    const value = Number(eur || 0);
    const [intPart, decPart] = value.toFixed(2).split('.');
    const intFormatted = Number(intPart).toLocaleString('fr-FR');
    return [intFormatted, decPart];
  };

  const thresholdEur = fiscal?.thresholdEur ?? 3000;
  const thresholdTx = fiscal?.thresholdTransactions ?? 20;
  const cur = fiscal?.currentYear ?? null;
  const prev = fiscal?.previousYear ?? null;

  const [curIntStr, curDecStr] = splitEur(cur?.totalEur);
  const [prevIntStr, prevDecStr] = splitEur(prev?.totalEur);
  const curEur = Number(cur?.totalEur || 0);
  const curRatio = Math.min(1, curEur / thresholdEur);
  const curThresholdReached = !!cur?.thresholdReached;

  return (
    <div className="col gap-6">
      <SectionTitle
        eyebrow="Informations fiscales"
        title="Récapitulatif annuel"
        desc={`BUUPP transmet vos données récapitulatives à la DGFiP dès le dépassement du seuil déclaratif (${thresholdEur.toLocaleString('fr-FR')} € / ${thresholdTx} transactions en ${cur?.year ?? new Date().getFullYear()}).`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="mono caps muted" style={{ marginBottom: 10 }}>
            — Exercice {cur?.year ?? '…'} (en cours)
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="serif tnum" style={{ fontSize: 64 }}>{curIntStr}</span>
            <span className="muted" style={{ fontSize: 16 }}>,{curDecStr} € cumulés</span>
          </div>
          <div style={{ marginTop: 22 }}>
            <div className="row between" style={{ fontSize: 12, marginBottom: 6 }}>
              <span className="muted">Seuil déclaratif</span>
              <span className="mono tnum">
                {curEur.toFixed(2).replace('.', ',')} / {thresholdEur.toLocaleString('fr-FR')} €
              </span>
            </div>
            <Progress value={curRatio}/>
          </div>
          <div className="row between" style={{ fontSize: 12, marginTop: 10, color: 'var(--ink-4)' }}>
            <span>Transactions de l'année</span>
            <span className="mono tnum">{cur?.transactionCount ?? 0} / {thresholdTx}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            {!fiscal
              ? 'Chargement de votre récapitulatif…'
              : curThresholdReached
                ? "Vous avez dépassé le seuil. BUUPP transmettra votre récapitulatif à la DGFiP en janvier prochain."
                : "Vous n'avez pas atteint le seuil. Aucune obligation de déclaration spécifique pour l'instant."}
          </div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="mono caps muted" style={{ marginBottom: 10 }}>
            — Exercice {prev?.year ?? '…'} (clos)
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="serif tnum" style={{ fontSize: 64 }}>{prevIntStr}</span>
            <span className="muted" style={{ fontSize: 16 }}>,{prevDecStr} €</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            {!fiscal
              ? 'Chargement…'
              : prev?.reportedToDgfip
                ? `Récapitulatif fiscal ${prev.year} transmis le 31 janvier ${prev.year + 1}.`
                : `Aucune transmission DGFiP pour ${prev?.year ?? ''} : seuil non atteint (${prev?.transactionCount ?? 0} transactions, ${(prev?.totalEur || 0).toFixed(2).replace('.', ',')} €).`}
          </div>
          <div className="row gap-2" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost btn-sm" disabled={!prev?.reportedToDgfip}>
              <Icon name="download" size={12}/> Récap {prev?.year ?? ''} (PDF)
            </button>
            <button className="btn btn-ghost btn-sm" disabled={!prev?.reportedToDgfip}>
              <Icon name="doc" size={12}/> Reçu DGFiP
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 16 }}>Seuils à retenir</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            ['305 €', 'Franchise annuelle', "En dessous, aucune déclaration URSSAF n'est requise."],
            [`${thresholdEur.toLocaleString('fr-FR')} €`, 'Seuil DGFiP', "Les plateformes transmettent le récapitulatif des usagers au-dessus de ce montant."],
            ['77 700 €', 'Plafond micro-BIC', "Au-delà, bascule en régime réel. BUUPP vous alertera 6 mois avant."],
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
