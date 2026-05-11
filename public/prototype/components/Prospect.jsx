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
  // Métadonnées identité non éditables directement (gérées par le flow
  // dédié `/api/prospect/phone/verify`). `null` = jamais vérifié.
  identityMeta: { phoneVerifiedAt: null },
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
  return persistFieldsUpdate(category, { [field]: value });
}
async function persistFieldsUpdate(category, fields) {
  try {
    const r = await fetch('/api/prospect/donnees', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: category, fields }),
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
  const [isFounder, setIsFounder] = useState(false);

  // Hydratation `Mes données`. Refetch déclenché aussi par le bus
  // `prospect:profile-changed` pour répercuter les mutations qui
  // contournent ce store (ex. /api/prospect/phone/verify qui écrit
  // telephone + phone_verified_at directement).
  const refetchDonnees = React.useCallback(async () => {
    try {
      const r = await fetch('/api/prospect/donnees', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setIsFounder(data.isFounder === true);
      setProfile(p => ({
        ...p,
        identity:    { ...p.identity,    ...data.identity },
        localisation:{ ...p.localisation,...data.localisation },
        vie:         { ...p.vie,         ...data.vie },
        pro:         { ...p.pro,         ...data.pro },
        patrimoine:  { ...p.patrimoine,  ...data.patrimoine },
        identityMeta: { ...(p.identityMeta || {}), ...(data.identityMeta || {}) },
      }));
      const nextDeleted = {};
      (data.hiddenTiers || []).forEach(t => { nextDeleted[t] = true; });
      setDeleted(nextDeleted);
      const nextRemoved = {};
      (data.removedTiers || []).forEach(t => { nextRemoved[t] = true; });
      setRemoved(nextRemoved);
    } catch (e) { console.warn('[prospect/donnees] GET error', e); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refetchDonnees();
      if (!cancelled) setHydrated(true);
    })();
    const onChange = () => { refetchDonnees(); };
    window.addEventListener('prospect:profile-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('prospect:profile-changed', onChange);
    };
  }, [refetchDonnees]);

  // ─── Relations (pending + history) — fetch initial + revalidation ──
  const [pendingRelations, setPendingRelations] = useState([]);
  const [historyRelations, setHistoryRelations] = useState([]);
  const [relationsHydrated, setRelationsHydrated] = useState(false);
  // Décisions prises sur les flash deals fictifs côté home (localStorage,
  // clé alignée sur app/page.tsx). Fusionnées dans l'historique pour
  // garder une UX cohérente : si l'utilisateur accepte/refuse un mock
  // depuis la home, il le retrouve ici.
  const [mockHistory, setMockHistory] = useState([]);

  const readMockHistory = React.useCallback(() => {
    try {
      const raw = window.localStorage.getItem('bupp:mock-deal-decisions:v1');
      if (!raw) return [];
      const store = JSON.parse(raw) || {};
      return Object.values(store).map((rec) => {
        const reward = Number(rec.rewardCents || 0) / 100;
        const tier = Math.min(5, Math.max(1, Math.max(...(rec.requiredTiers || [1])) || 1));
        const isAccepted = rec.decision === 'accepted';
        return {
          id: rec.dealId,
          campaignId: rec.dealId,
          date: rec.decidedAt,
          proName: rec.proName || '—',
          pro: rec.proName || '—',
          sector: rec.proSector || '',
          motif: rec.name || '',
          brief: rec.brief || null,
          reward,
          tier,
          timer: 'Démo',
          startDate: rec.decidedAt,
          endDate: rec.endsAt,
          decision: isAccepted ? 'Acceptée' : 'Refusée',
          status: isAccepted ? 'En séquestre' : '—',
          relationStatus: rec.decision,
          gain: isAccepted ? reward : null,
          campaignStatus: 'active',
          campaignOpen: false,
          campaignActive: false,
          isFlashDeal: true,
          isMockDemo: true,
        };
      });
    } catch (e) {
      return [];
    }
  }, []);

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

  // Hydratation initiale + écoute des changements (multi-tab via
  // `storage`, même tab via `bupp:mock-deal-decisions-changed`).
  useEffect(() => {
    const sync = () => setMockHistory(readMockHistory());
    sync();
    window.addEventListener('bupp:mock-deal-decisions-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('bupp:mock-deal-decisions-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [readMockHistory]);

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

  // Toute mutation de décision (accept/refuse/undo) modifie le ratio
  // accepté/total → impacte BUUPP Score, taux d'acceptation, wallet
  // (séquestre, lifetime). Pour synchroniser les autres consommateurs
  // du dashboard (header, BUUPP Score, Portefeuille), on réémet le bus
  // `prospect:profile-changed` qui invalide les caches /api/prospect/*.
  const dispatchProfileChanged = () => {
    try { window.dispatchEvent(new Event('prospect:profile-changed')); } catch {}
  };

  const acceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'accepted' }));
    const ok = await postDecision(id, 'accept');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    if (ok) dispatchProfileChanged();
  };
  const refuseRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'refused' }));
    const ok = await postDecision(id, 'refuse');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    if (ok) dispatchProfileChanged();
  };
  const undoAcceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'pending' }));
    const ok = await postDecision(id, 'undo');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    // Scoped delete : on retire UNIQUEMENT l'id traité, pour ne pas
    // écraser un optimistic en cours sur une autre card (clic rapide).
    setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    if (ok) dispatchProfileChanged();
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
  // Met à jour PLUSIEURS champs d'un même palier en un seul PATCH atomique.
  // Utilisé par l'autocomplétion ville+code postal : on garantit que les
  // deux valeurs sont écrites ensemble, jamais l'une sans l'autre.
  const updateFields = (category, fields) => {
    setProfile(p => ({ ...p, [category]: { ...p[category], ...fields } }));
    persistFieldsUpdate(category, fields);
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
  // Fusion API + mocks, triés par date de décision desc — l'ordre
  // d'affichage de l'historique reste cohérent.
  const mergedHistory = React.useMemo(() => {
    const all = [...(historyRelations || []), ...mockHistory];
    return all.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });
  }, [historyRelations, mockHistory]);

  return (
    <ProspectCtx.Provider value={{
      profile, deleted, removed, updateField, updateFields, suppressTemp, restore, deletePermanent, addField,
      setAllCampaignTypes, toggleCampaignType, toggleCategory,
      pendingRelations, historyRelations: mergedHistory,
      acceptedRelations: accepted, refusedRelations: refused,
      acceptRelation, refuseRelation, undoAcceptRelation, undoRefuseRelation,
      pendingRelationsCount, relationsHydrated,
      isFounder,
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
  { id: 'messages',     icon: 'inbox',  label: 'Mes messages' },
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
  // Relation à ouvrir dans RelationDetailModal après navigation depuis
  // le champ de recherche du header. Stockée ici (parent) pour survivre
  // à la bascule de section : Portefeuille la consomme à son montage si
  // l'utilisateur n'était pas déjà sur l'onglet.
  const [pendingDetail, setPendingDetail] = useState(null);

  useEffect(() => {
    const onPick = (e) => {
      if (e?.detail?.kind === 'relation' && e.detail.payload) {
        setPendingDetail({ token: Date.now(), relation: e.detail.payload });
        setSec('portefeuille');
      }
    };
    window.addEventListener('bupp:search-select', onPick);
    return () => window.removeEventListener('bupp:search-select', onPick);
  }, []);

  // Bridge cloche → onglet Messages. La NotificationsBell dispatch cet
  // évènement quand on clique sur une notif (ou sur la cloche elle-même)
  // → on bascule sur l'onglet « Mes messages », qui s'auto-fetche et
  // surlignera le message ouvert via le payload { id }.
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  useEffect(() => {
    const onOpenMsg = (e) => {
      const id = e?.detail?.id ?? null;
      setHighlightMessageId(id);
      setSec('messages');
    };
    window.addEventListener('bupp:open-message', onOpenMsg);
    return () => window.removeEventListener('bupp:open-message', onOpenMsg);
  }, []);
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
      {sec === 'portefeuille' && <Portefeuille pendingDetail={pendingDetail} onPendingConsumed={() => setPendingDetail(null)}/>}
      {sec === 'donnees' && <MesDonnees onGoPrefs={() => setSec('prefs')}/>}
      {sec === 'relations' && <Relations />}
      {sec === 'verif' && <VerifTiers />}
      {sec === 'score' && <ScorePanel />}
      {sec === 'prefs' && <Prefs />}
      {sec === 'parrainage' && <Parrainage />}
      {sec === 'fiscal' && <Fiscal />}
      {sec === 'messages' && <MessagesPanel role="prospect" highlightId={highlightMessageId} onHighlightConsumed={() => setHighlightMessageId(null)}/>}
      {sec === 'suggestions' && <SuggestionsPanel role="prospect"/>}
    </DashShell>
  );
}

function DashShell({ role, go, sections, current, onNav, children, header, overrideName }) {
  // Mobile (≤900px) starts with the menu hidden so the dashboard takes full
  // width; on desktop the sidebar is shown expanded by default.
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 900;
  const [collapsed, setCollapsed] = useState(() => isMobile());
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Confirmation explicite avant déconnexion : évite le clic accidentel
  // dans la sidebar. La modale se contente de poster `bupp: 'signOut'`
  // au parent (PrototypeFrame) si l'utilisateur confirme.
  const [signOutOpen, setSignOutOpen] = useState(false);
  // Email du souscripteur affiché en bas de la sidebar. Source = /api/me
  // qui lit `prospect_identity.email` (DB) côté prospect, et l'email Clerk
  // côté pro (aucune colonne email persistée sur pro_accounts).
  const [userEmail, setUserEmail] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchMe().then(j => { if (!cancelled && j?.email) setUserEmail(j.email); });
    return () => { cancelled = true; };
  }, []);
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
      <aside
        className={collapsed ? 'is-collapsed' : undefined}
        style={{
          borderRight: '1px solid var(--line)', background: 'var(--paper)',
          padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          position: 'sticky', top: 0, height: '100vh'
        }}
      >
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
                data-label={s.label}
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
            <div key={s.id} className={'side-item' + (active ? ' active' : '')} data-label={s.label} onClick={() => handleNav(s.id)}>
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
        {/* Groupe secondaire — placé entre les onglets principaux et le
            bloc déconnexion. Contient :
              1. "Suivez-nous" : 3 boutons icônes (Facebook, Instagram,
                 TikTok) pointant vers les pages sociales BUUPP.
              2. "Vos suggestions" : item de navigation qui bascule sur
                 l'onglet correspondant pour afficher le formulaire.
            URLs sociales centralisées ici → simple à mettre à jour quand
            les comptes officiels seront créés. */}
        <div className="dash-secondary">
          {!collapsed && (
            <div className="mono caps muted dash-secondary-label">Suivez-nous</div>
          )}
          <div className="dash-social-row">
            <a
              className="dash-social-btn"
              href="https://www.facebook.com/buupp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook BUUPP"
              data-label="Facebook"
            >
              <Icon name="facebook" size={16}/>
            </a>
            <a
              className="dash-social-btn"
              href="https://www.instagram.com/buupp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram BUUPP"
              data-label="Instagram"
            >
              <Icon name="instagram" size={16}/>
            </a>
            <a
              className="dash-social-btn"
              href="https://www.tiktok.com/@buupp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok BUUPP"
              data-label="TikTok"
            >
              <Icon name="tiktok" size={16}/>
            </a>
          </div>
          <div
            className={'side-item' + (current === 'suggestions' ? ' active' : '')}
            data-label="Vos suggestions"
            onClick={() => handleNav('suggestions')}
          >
            <span className="side-icon"><Icon name="sparkle" size={16}/></span>
            {!collapsed && <span>Vos suggestions</span>}
          </div>
        </div>
        <div className="dash-logout" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
          {/* Adresse mail du souscripteur — alignée sur le pattern AdminShell
              (petit texte mono tronqué, hover = email complet via title).
              Masquée en mode sidebar repliée (icônes seules) : il n'y a pas
              de place pour un texte. Sur mobile, la classe `dash-user-email`
              + les règles CSS responsive transforment cet item en chip
              compact dans la barre horizontale. */}
          {userEmail && !collapsed && (
            <div
              className="dash-user-email"
              title={userEmail}
            >
              {userEmail}
            </div>
          )}
          <div
            className="side-item"
            data-label="Déconnexion"
            onClick={() => setSignOutOpen(true)}
          >
            <span className="side-icon"><Icon name="logout" size={16}/></span>
            {!collapsed && <span>Déconnexion</span>}
          </div>
          {/* Action destructive — couleur rouge pour signaler le danger.
              Ouvre la modale de confirmation (DeleteAccountModal). */}
          <div
            className="side-item side-item-danger"
            data-label="Supprimer mon compte"
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
          <TopBar role={role} overrideName={overrideName}/>
          {header}
        </div>
        <main style={{ padding: '32px 40px 80px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {children}
        </main>
      </div>
      {deleteOpen && (
        <DeleteAccountModal role={role} onClose={() => setDeleteOpen(false)}/>
      )}
      {signOutOpen && (
        <SignOutConfirmModal
          onClose={() => setSignOutOpen(false)}
          onConfirm={() => {
            // Délègue la révocation Clerk + redirection au parent
            // (PrototypeFrame.tsx écoute ce message).
            try { window.parent.postMessage({ bupp: 'signOut' }, '*'); } catch (e) {}
          }}
        />
      )}
    </div>
  );
}

// Confirmation neutre (non destructive) avant déconnexion. Pattern
// aligné sur DeleteAccountModal mais sans accent rouge — la
// déconnexion est réversible (l'utilisateur peut se reconnecter).
function SignOutConfirmModal({ onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = () => {
    setLoading(true);
    onConfirm();
  };
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', maxWidth: 460, width: '100%',
        background: 'var(--paper)', borderRadius: 16, padding: '28px 28px 22px',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 14px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
            color: 'var(--ink-3)',
          }}>
            <Icon name="logout" size={22}/>
          </div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.25, marginBottom: 6 }}>
            Se déconnecter ?
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            Vous serez ramené sur la page d'accueil. Vous pourrez vous
            reconnecter à tout moment avec votre identifiant.
          </div>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 6 }}>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={onClose}
            style={{
              flex: '1 1 160px', justifyContent: 'center',
              background: 'var(--paper)', color: 'var(--ink)',
              border: '1.5px solid var(--line-2)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={handleConfirm}
            style={{
              flex: '1 1 160px', justifyContent: 'center',
              background: 'var(--ink)', color: 'var(--paper)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </div>
      </div>
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

function TopBar({ role, overrideName }) {
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
        <HeaderSearch role={role}/>
      </div>
      <div className="row center gap-3">
        <NotificationsBell role={role}/>
        <div title={displayName}>
          <Avatar name={initials.split('').join(' ')} size={32}/>
        </div>
      </div>
    </div>
  );
}

/* Cloche des notifications broadcast (messages admin → utilisateurs).
   - Bouton avec badge rouge = nombre de non lus
   - Clic → dropdown ancré à droite (desktop) ou bottom-sheet (mobile)
   - Clic sur un item → bascule sur l'onglet « Mes messages » via
     l'évènement `bupp:open-message` (le dashboard parent l'écoute) et
     ferme le dropdown. Le marquage lu est délégué à l'onglet, qui le
     fait au montage si l'item est highlight.
   - Polling : initial au mount, toutes les 60 s, au retour au foreground.
   On garde le dropdown comme aperçu rapide, mais la lecture détaillée
   se fait dans l'onglet — meilleur pour les messages longs et permet
   à l'utilisateur d'y revenir. */
function NotificationsBell({ role }) {
  // `role` accepté pour compat — le routage tab/event est universel.
  void role;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = React.useRef(null);

  const fetchList = React.useCallback(async () => {
    try {
      const r = await fetch('/api/me/notifications', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setItems(Array.isArray(j?.notifications) ? j.notifications : []);
    } catch (e) {
      // Erreur réseau silencieuse : on garde l'état courant, on retentera
      // au prochain tick ou au prochain foreground.
    }
  }, []);

  useEffect(() => {
    fetchList();
    const id = setInterval(fetchList, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') fetchList(); };
    document.addEventListener('visibilitychange', onVis);
    // L'onglet Mes messages peut marquer des items lus → on rafraîchit
    // le badge quand il signale un changement (event custom local).
    const onRefresh = () => fetchList();
    window.addEventListener('bupp:notifications-changed', onRefresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('bupp:notifications-changed', onRefresh);
    };
  }, [fetchList]);

  // Click extérieur ferme le dropdown. Ne s'attache que si dropdown ouvert.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const unread = items.filter(i => i.unread).length;

  // Aperçu rapide → bascule sur l'onglet Mes messages (et highlight le
  // message ciblé pour qu'il soit visible/auto-marqué-lu à l'arrivée).
  const onItemClick = (item) => {
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('bupp:open-message', { detail: { id: item.id } }));
    } catch (e) {}
  };

  // Si on clique sur "Voir tous les messages" sans cible précise, on
  // bascule juste sur l'onglet sans highlight.
  const goToTab = () => {
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('bupp:open-message', { detail: { id: null } }));
    } catch (e) {}
  };

  return (
    <div ref={wrapRef} className="notif-wrap">
      <button
        className="notif-bell"
        aria-label={unread > 0 ? `${unread} notifications non lues` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="bell" size={16}/>
        {unread > 0 && (
          <span className="notif-badge" aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Backdrop mobile uniquement (CSS) — clic ferme le sheet. */}
          <div className="notif-backdrop" onClick={() => setOpen(false)} aria-hidden/>
          <div className="notif-dropdown" role="dialog" aria-label="Notifications">
            <div className="notif-dropdown-header">
              <div className="notif-dropdown-title">Notifications</div>
              <button className="notif-mark-all" onClick={goToTab}>
                Voir tous les messages
              </button>
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">Aucune notification pour l'instant.</div>
              ) : items.slice(0, 8).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick(item)}
                  className={'notif-item' + (item.unread ? ' is-unread' : '')}
                >
                  <span className="notif-dot" aria-hidden/>
                  <span className="notif-item-body">
                    <span className="notif-item-title">{item.title}</span>
                    <span className="notif-item-preview">
                      {String(item.body || '').slice(0, 90)}{(item.body || '').length > 90 ? '…' : ''}
                    </span>
                    <span className="notif-item-meta">{formatRelativeFr(item.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatRelativeFr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatAbsoluteFr(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ─────────────────────────────────────────────────────────────────
   Onglet « Mes messages » — liste des broadcasts admin reçus par
   l'utilisateur. Remplace l'ancien popup : la lecture détaillée se
   fait inline (chaque carte affiche le corps complet). Les items
   non lus sont marqués (pastille rouge + border-left accentuée) et
   passent en « lu » au premier clic. Le highlightId vient de la
   cloche : on scrolle dessus et on auto-marque-lu si non lu.
   ───────────────────────────────────────────────────────────────── */
function MessagesPanel({ highlightId, onHighlightConsumed }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemRefs = React.useRef({});

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/me/notifications', { cache: 'no-store' });
      if (!r.ok) throw new Error('fetch_failed');
      const j = await r.json();
      setItems(Array.isArray(j?.notifications) ? j.notifications : []);
      setError(null);
    } catch (e) {
      setError('Impossible de charger vos messages pour l’instant.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Si la cloche nous a passé un id à highlighter : scroll + auto-mark-read.
  useEffect(() => {
    if (!highlightId || items.length === 0) return;
    const target = items.find(i => i.id === highlightId);
    if (!target) return;
    // Scroll doux jusqu'à la carte, avec un léger délai pour laisser
    // le navigateur layouter après le switch d'onglet.
    requestAnimationFrame(() => {
      const node = itemRefs.current[highlightId];
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    if (target.unread) markRead(highlightId);
    if (onHighlightConsumed) onHighlightConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, items.length]);

  async function markRead(id) {
    // Optimistic — on flag lu immédiatement côté UI, le POST est
    // idempotent et le badge cloche se synchronise via l'event ci-dessous.
    setItems(cur => cur.map(i => i.id === id ? { ...i, unread: false } : i));
    try {
      await fetch(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      window.dispatchEvent(new CustomEvent('bupp:notifications-changed'));
    } catch (e) {}
  }

  const unreadCount = items.filter(i => i.unread).length;

  async function markAll() {
    const unreadIds = items.filter(i => i.unread).map(i => i.id);
    if (unreadIds.length === 0) return;
    setItems(cur => cur.map(i => ({ ...i, unread: false })));
    await Promise.all(unreadIds.map(id =>
      fetch(`/api/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch(() => null)
    ));
    window.dispatchEvent(new CustomEvent('bupp:notifications-changed'));
  }

  return (
    <div className="messages-panel">
      <div className="messages-header">
        <div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
            Mes messages
          </div>
          <div className="mono caps muted" style={{ fontSize: 11, letterSpacing: '0.1em', marginTop: 4 }}>
            {items.length === 0
              ? 'Aucun message'
              : `${items.length} message${items.length > 1 ? 's' : ''} · ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}`}
          </div>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      {loading && (
        <div className="messages-empty">Chargement…</div>
      )}
      {!loading && error && (
        <div className="messages-empty messages-error">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="messages-empty">
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          Aucun message pour le moment. Les annonces de l'équipe BUUPP s'afficheront ici.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="messages-list">
          {items.map(item => (
            <article
              key={item.id}
              ref={el => { itemRefs.current[item.id] = el; }}
              className={'message-card' + (item.unread ? ' is-unread' : '')}
              onClick={() => item.unread && markRead(item.id)}
            >
              <header className="message-card-head">
                <span className="message-card-dot" aria-hidden/>
                <div className="message-card-meta">
                  <span className="message-card-date">{formatAbsoluteFr(item.createdAt)}</span>
                  {item.unread && <span className="message-card-badge">Non lu</span>}
                </div>
              </header>
              <h3 className="message-card-title">{item.title}</h3>
              <div className="message-card-body">{item.body}</div>
              {item.hasAttachment && (
                <a
                  href={`/api/me/notifications/${encodeURIComponent(item.id)}/attachment`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="message-card-attachment"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon name="download" size={14}/>
                  <span>{item.attachmentFilename ? `Télécharger ${item.attachmentFilename}` : 'Télécharger la pièce jointe'}</span>
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Onglet « Vos suggestions » — formulaire pour envoyer une remarque
   ou idée à l'équipe BUUPP. POST /api/me/suggestions → email vers
   jjlex64@gmail.com (paramétrable via env côté API). Toast inline
   de confirmation, reset du formulaire après succès.
   ───────────────────────────────────────────────────────────────── */
function SuggestionsPanel() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind: 'ok'|'err', text }
  const MAX_SUBJECT = 120;
  const MAX_MESSAGE = 4000;

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    const m = message.trim();
    if (!m) {
      setFeedback({ kind: 'err', text: 'Veuillez écrire votre message avant d’envoyer.' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/me/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim() || null, message: m }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFeedback({ kind: 'err', text: j?.message || 'Envoi impossible. Réessayez.' });
        return;
      }
      setFeedback({ kind: 'ok', text: 'Merci ! Votre message a été transmis à l’équipe BUUPP.' });
      setSubject('');
      setMessage('');
    } catch (err) {
      setFeedback({ kind: 'err', text: 'Erreur réseau. Réessayez dans un instant.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="suggestions-panel">
      <div>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
          Faites-nous part de vos suggestions
        </div>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 6, maxWidth: 560 }}>
          Une idée, un bug, une demande de fonctionnalité ? L'équipe BUUPP lit chaque
          message. Plus c'est précis, plus on peut agir vite.
        </p>
      </div>

      <form className="suggestions-form" onSubmit={onSubmit}>
        <label className="suggestions-field">
          <span className="suggestions-label">Sujet (optionnel)</span>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
            placeholder="Ex. Suggestion sur les notifications"
            maxLength={MAX_SUBJECT}
            disabled={submitting}
            className="suggestions-input"
          />
        </label>
        <label className="suggestions-field">
          <span className="suggestions-label">
            Votre message <span className="suggestions-count">{message.length} / {MAX_MESSAGE}</span>
          </span>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            placeholder="Décrivez votre idée ou votre retour. Les retours à la ligne sont préservés."
            rows={8}
            maxLength={MAX_MESSAGE}
            disabled={submitting}
            required
            className="suggestions-textarea"
          />
        </label>

        {feedback && (
          <div className={'suggestions-feedback suggestions-feedback-' + feedback.kind}>
            {feedback.text}
          </div>
        )}

        <div className="suggestions-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !message.trim()}
          >
            {submitting ? 'Envoi…' : 'Envoyer à l’équipe BUUPP'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* Champ de recherche du header — autocomplétion plein-texte sur les
   campagnes / contacts visibles dans l'espace courant.
   - prospect : interroge /api/prospect/movements et matche sur la raison
     sociale du pro (origin) ou le contenu du brief (« le mot du
     professionnel »). Au clic : dispatch d'un événement
     `bupp:search-select` → ProspectDashboardInner bascule sur l'onglet
     Portefeuille et Portefeuille ouvre RelationDetailModal.
   - pro : interroge /api/pro/campaigns + /api/pro/contacts. Match sur le
     nom de campagne ou son brief, et sur le nom masqué du prospect ou
     le nom de la campagne associée. Au clic : dispatch sur le même bus
     → ProDashboard ouvre la fiche campagne ou bascule sur Mes contacts. */
function HeaderSearch({ role }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = React.useRef(null);
  const cacheRef = React.useRef({ prospect: null, proCamps: null, proContacts: null });

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const ensureData = React.useCallback(async () => {
    if (role === 'prospect') {
      if (!cacheRef.current.prospect) {
        const j = await fetch('/api/prospect/movements', { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null);
        cacheRef.current.prospect = j?.movements || [];
      }
      return cacheRef.current.prospect;
    }
    if (!cacheRef.current.proCamps || !cacheRef.current.proContacts) {
      const [cj, kj] = await Promise.all([
        fetch('/api/pro/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/pro/contacts', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      cacheRef.current.proCamps = cj?.campaigns || [];
      cacheRef.current.proContacts = kj?.rows || [];
    }
    return { camps: cacheRef.current.proCamps, contacts: cacheRef.current.proContacts };
  }, [role]);

  React.useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    ensureData().then(data => {
      if (cancelled) return;
      if (role === 'prospect') {
        const movements = data || [];
        const items = movements
          .filter(m => m.relation)
          .filter(m => {
            const hay = [
              m.origin || '',
              m.relation?.brief || '',
              m.relation?.motif || '',
              m.relation?.pro || '',
            ].join(' ').toLowerCase();
            return hay.includes(q);
          })
          .slice(0, 8)
          .map(m => ({
            kind: 'relation',
            id: m.relation.id,
            title: m.origin || m.relation.pro || 'Mise en relation',
            sub: m.relation?.brief || m.relation?.motif || '',
            payload: m.relation,
          }));
        setResults(items);
      } else {
        const camps = data?.camps || [];
        const contacts = data?.contacts || [];
        const c = camps
          .filter(x => ((x.name || '') + ' ' + (x.brief || '')).toLowerCase().includes(q))
          .slice(0, 5)
          .map(x => ({
            kind: 'campaign',
            id: x.id,
            title: x.name || 'Campagne',
            sub: x.brief || '',
            payload: x,
          }));
        const k = contacts
          .filter(x => ((x.name || '') + ' ' + (x.campaign || '')).toLowerCase().includes(q))
          .slice(0, 5)
          .map(x => ({
            kind: 'contact',
            id: x.relationId,
            title: x.name || 'Contact',
            sub: x.campaign ? `Campagne · ${x.campaign}` : '',
            payload: x,
          }));
        setResults([...c, ...k]);
      }
      setHighlight(0);
    });
    return () => { cancelled = true; };
  }, [query, role, ensureData]);

  // Invalide le cache module-local quand un changement métier survient
  // (acceptation/refus de relation côté prospect, création/pause de
  // campagne côté pro, etc.) — sinon la recherche affiche des résultats
  // périmés tant que l'utilisateur ne recharge pas la page.
  React.useEffect(() => {
    const invalidate = () => {
      cacheRef.current = { prospect: null, proCamps: null, proContacts: null };
    };
    const events = role === 'prospect'
      ? ['prospect:profile-changed']
      : ['pro:overview-changed', 'pro:info-changed'];
    events.forEach(ev => window.addEventListener(ev, invalidate));
    return () => events.forEach(ev => window.removeEventListener(ev, invalidate));
  }, [role]);

  const select = (item) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    try {
      window.dispatchEvent(new CustomEvent('bupp:search-select', { detail: item }));
    } catch {}
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(results.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); select(results[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const placeholder = role === 'prospect'
    ? 'Rechercher une campagne…'
    : 'Rechercher une campagne ou un contact…';
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: 320 }}>
      <span style={{ position: 'absolute', left: 10, top: 'calc(50% - 1px)', transform: 'translateY(-50%)', color: 'var(--ink-5)', pointerEvents: 'none' }}>
        <Icon name="search" size={14}/>
      </span>
      <input
        className="input"
        style={{ paddingLeft: 32, fontSize: 13, background: 'var(--paper)' }}
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--paper)', border: '1px solid var(--line-2)',
          borderRadius: 10, boxShadow: '0 12px 28px -10px rgba(0,0,0,.18)',
          maxHeight: 360, overflowY: 'auto', zIndex: 30,
        }}>
          {results.length === 0 ? (
            <div className="muted" style={{ padding: 12, fontSize: 12 }}>Aucun résultat.</div>
          ) : (
            results.map((it, idx) => {
              const isHi = idx === highlight;
              const tag = it.kind === 'campaign' ? 'Campagne'
                : it.kind === 'contact' ? 'Contact'
                : 'Campagne';
              return (
                <div
                  key={it.kind + ':' + it.id}
                  onMouseDown={(e) => { e.preventDefault(); select(it); }}
                  onMouseEnter={() => setHighlight(idx)}
                  style={{
                    padding: '10px 12px', cursor: 'pointer',
                    background: isHi ? 'var(--ivory-2)' : 'transparent',
                    borderBottom: idx === results.length - 1 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <div className="row between center" style={{ gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.title}
                    </div>
                    <span className="mono caps" style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                      {tag}
                    </span>
                  </div>
                  {it.sub && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.sub}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
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
  const { profile, isFounder } = useProspect() || {};
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
          <div className="mono caps muted" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
            — Bonjour {prenom || '—'}
            {isFounder && (
              <span
                title="Vous êtes fondateur·ice — priorité 10 min sur les flash deals + bonus 2× le 1er mois"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: '#FFF1B8',
                  color: '#5C4400',
                  border: '1px solid #F2C879',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '.04em',
                  marginLeft: 8,
                }}
              >
                🎖️ Fondateur·ice
              </span>
            )}
          </div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            Vos gains du mois : <em>{gainsText}</em>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            3 mises en relation en attente · prochaine échéance dans 14 h 22 min
          </div>
        </div>
        <div className="row center gap-6 prospect-header-pills">
          <StatusPill
            label="Vérification"
            value={verification
              ? `${VERIF_LABELS[verification.tier] || 'Basique'} · Palier ${verifTierPosition(verification.tier)}/3`
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
        <style>{`
          /* Sur mobile, on aligne les 3 pastilles (Vérification / BUUPP
             Score / Parrainages) en grille 3 colonnes équidistantes pour
             que labels et chips soient alignés horizontalement, peu
             importe la longueur du texte de chaque chip. */
          @media (max-width: 720px) {
            .prospect-header-pills {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px !important;
              width: 100%;
              align-items: start;
            }
            .prospect-header-pills .prospect-pill {
              text-align: center;
              min-width: 0;
            }
            .prospect-header-pills .prospect-pill .chip {
              display: block;
              text-align: center;
              white-space: normal;
              word-break: break-word;
              line-height: 1.35;
            }
          }
          @media (max-width: 420px) {
            .prospect-header-pills .chip { font-size: 11.5px !important; padding: 5px 6px !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function StatusPill({ label, value, chip }) {
  return (
    <div className="prospect-pill">
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>{label}</div>
      <div className={'chip ' + chip} style={{ fontSize: 13, padding: '5px 10px' }}>{value}</div>
    </div>
  );
}

/* ---------- Portefeuille ---------- */
function Portefeuille({ pendingDetail, onPendingConsumed }) {
  const [modal, setModal] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [movements, setMovements] = useState(null);
  // `detail` : relation sélectionnée pour ouverture de RelationDetailModal au
  // clic sur une ligne d'historique. Null tant que rien n'est ouvert.
  const [detail, setDetail] = useState(null);
  const {
    acceptedRelations: accepted,
    refusedRelations: refused,
    acceptRelation,
    refuseRelation,
  } = useProspect();

  // Hydrate les 3 cartes (Disponible / En séquestre / Cumulé depuis ouverture)
  // depuis /api/prospect/wallet. Re-fetch sur prospect:profile-changed pour
  // refléter immédiatement un nouveau crédit ou retrait.
  const refreshMovements = React.useCallback(() => {
    let cancelled = false;
    fetch('/api/prospect/movements', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => !cancelled && setMovements(j))
      .catch(() => { if (!cancelled) setMovements({ movements: [] }); });
    return () => { cancelled = true; };
  }, []);
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

  // Ouverture de RelationDetailModal depuis le champ de recherche du
  // header. Le parent (ProspectDashboardInner) injecte `pendingDetail`
  // au moment de la bascule de section ; le token (timestamp) garantit
  // qu'on rouvre la modale même si la relation est la même qu'avant.
  useEffect(() => {
    if (!pendingDetail?.relation) return;
    setDetail(pendingDetail.relation);
    if (onPendingConsumed) onPendingConsumed();
  }, [pendingDetail, onPendingConsumed]);

  // Wrappers d'accept/refuse spécifiques à l'historique du Portefeuille :
  // après l'appel mutateur (qui rafraîchit les relations dans le contexte),
  // on rafraîchit aussi wallet + movements localement, puis on ferme la
  // modale. Le bouton "Refuser" sur une relation déjà settled, par exemple,
  // doit faire bouger les cartes du haut (séquestre/disponible) en plus de
  // mettre à jour la ligne du tableau.
  const handleAccept = async (id) => {
    await acceptRelation(id);
    invalidateProspectApiCache();
    fetchCachedJson('wallet', '/api/prospect/wallet').then(j => setWallet(j));
    refreshMovements();
    setDetail(null);
  };
  const handleRefuse = async (id) => {
    await refuseRelation(id);
    invalidateProspectApiCache();
    fetchCachedJson('wallet', '/api/prospect/wallet').then(j => setWallet(j));
    refreshMovements();
    setDetail(null);
  };

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
            ? 'Retirable immédiatement · minimum de 5 €'
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
          sub="Déblocage à la clôture de la campagne"
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
          {(() => {
            const rows = movements?.movements || [];
            const disabled = rows.length === 0;
            const exportCsv = () => {
              if (disabled) return;
              // CSV séparé par `;` (convention fr-FR pour ouverture
              // directe dans Excel) avec BOM UTF-8 pour préserver les
              // accents. Les champs contenant `;`, `"` ou un saut de
              // ligne sont entourés de guillemets doubles, les `"`
              // intérieurs sont doublés.
              const escape = (v) => {
                const s = v == null ? '' : String(v);
                return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
              };
              const dateFmt = new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              });
              const header = ['Date', 'Origine', 'Palier', 'Statut', 'Montant (€)'];
              const lines = rows.map((m) => {
                const date = m.date ? dateFmt.format(new Date(m.date)) : '';
                const tier = m.tier == null ? '' : `Palier ${m.tier}`;
                const amount =
                  (m.sign || (Number(m.amountCents ?? 0) >= 0 ? '+' : '−')) +
                  Number(Math.abs(m.amountEur ?? 0)).toFixed(2).replace('.', ',');
                return [date, m.origin || '', tier, m.statusLabel || '', amount].map(escape).join(';');
              });
              const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              const stamp = new Date().toISOString().slice(0, 10);
              a.href = url;
              a.download = `buupp-portefeuille-${stamp}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            };
            return (
              <button
                className="btn btn-sm btn-ghost btn-export-csv"
                onClick={exportCsv}
                disabled={disabled}
                title={disabled ? 'Aucun mouvement à exporter' : `Télécharger ${rows.length} ligne${rows.length > 1 ? 's' : ''}`}
                style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <Icon name="download" size={12}/> Exporter CSV
              </button>
            );
          })()}
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
                // Lignes cliquables uniquement quand le mouvement est lié à
                // une relation (escrow / credit issu d'une mise en relation).
                // Les retraits IBAN, parrainages sans campagne, etc. restent
                // non interactifs.
                const clickable = !!m.relation;
                return (
                  <tr
                    key={m.id}
                    onClick={clickable ? () => setDetail(m.relation) : undefined}
                    onKeyDown={clickable ? ((e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); setDetail(m.relation);
                      }
                    }) : undefined}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    title={clickable ? 'Voir le détail de la campagne' : undefined}
                    style={clickable ? { cursor: 'pointer' } : undefined}
                  >
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

      {detail && (
        <RelationDetailModal
          relation={detail}
          isAccepted={!!accepted[detail.id]}
          isRefused={!!refused[detail.id]}
          onAccept={() => handleAccept(detail.id)}
          onRefuse={() => handleRefuse(detail.id)}
          onClose={() => setDetail(null)}
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
  // Méthode choisie par le prospect dans la 1re étape. Seule "iban"
  // (virement) est ouverte aujourd'hui ; "card" et "gift" sont stubs et
  // n'apparaissent pas en sélection (boutons désactivés).
  const [method, setMethod] = useState(null);

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
        body: JSON.stringify({ amountCents: Math.round(eurValue * 100), method: 'iban' }),
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

  const subtitle = method === 'iban'
    ? `Solde disponible : ${availableEur.toFixed(2).replace('.', ',')} € · Virement vers votre IBAN sous 1–3 jours ouvrés`
    : `Solde disponible : ${availableEur.toFixed(2).replace('.', ',')} € · Choisissez votre mode de retrait`;

  return (
    <Modal onClose={onClose} title="Retirer mes gains" subtitle={subtitle}>
      {!method ? (
        <WithdrawMethodPicker onPick={setMethod} onClose={onClose}/>
      ) : loading ? (
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
              <button className="btn btn-ghost btn-sm" onClick={() => setMethod(null)} disabled={submitting}>← Méthode</button>
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

/* Étape 1 du retrait : choix du mode (virement / carte / cartes cadeaux & dons).
   Seul Virement est ouvert pour l'instant ; les deux autres restent visibles
   pour annoncer la roadmap, désactivés (opacité réduite, curseur "not-allowed",
   tooltip natif "Service à venir"). */
function WithdrawMethodPicker({ onPick, onClose }) {
  const options = [
    {
      key: 'iban',
      icon: 'wallet',
      title: 'Virement bancaire',
      desc: 'Vers votre IBAN, sous 1 à 3 jours ouvrés.',
      enabled: true,
    },
    {
      key: 'card',
      icon: 'money',
      title: 'Carte',
      desc: 'Paiement instantané sur votre carte de débit.',
      enabled: false,
    },
    {
      key: 'gift',
      icon: 'gift',
      title: 'Cartes cadeaux et dons',
      desc: 'Convertissez vos gains en bons d\'achat ou en dons.',
      enabled: false,
    },
  ];
  return (
    <div className="col gap-3">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={opt.enabled ? () => onPick(opt.key) : undefined}
          disabled={!opt.enabled}
          title={opt.enabled ? '' : 'Service à venir'}
          className="card row center"
          style={{
            gap: 14,
            padding: '14px 16px',
            border: '1px solid var(--line)',
            background: opt.enabled ? 'var(--paper)' : 'var(--ivory-2)',
            textAlign: 'left',
            cursor: opt.enabled ? 'pointer' : 'not-allowed',
            opacity: opt.enabled ? 1 : 0.55,
            transition: 'border-color .15s, background .15s',
          }}
        >
          <span
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--ivory-2)', color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={opt.icon} size={18}/>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="row center" style={{ gap: 8 }}>
              <span className="serif" style={{ fontSize: 16, color: 'var(--ink)' }}>{opt.title}</span>
              {!opt.enabled && (
                <span className="chip" style={{ fontSize: 10, padding: '2px 8px' }}>Bientôt</span>
              )}
            </span>
            <span className="muted" style={{ fontSize: 12.5, display: 'block', marginTop: 2 }}>
              {opt.desc}
            </span>
          </span>
          {opt.enabled && <Icon name="arrow" size={14} stroke={1.6}/>}
        </button>
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
      </div>
    </div>
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
    desc: "Adresse, ville, code postal.",
    fields: [
      ['adresse', 'Adresse postale'],
      ['ville', 'Ville'],
      ['codePostal', 'Code postal'],
    ],
  },
  {
    key: 'vie', tier: 3, label: 'Style de vie', icon: 'sparkle',
    desc: "Logement, mobilité, foyer, véhicule, sports, animaux.",
    fields: [
      ['foyer', 'Composition du foyer'],
      ['logement', 'Type de logement'],
      ['mobilite', 'Mobilité'],
      ['vehicule', 'Véhicule'],
      ['sports', 'Sports / loisirs'],
      ['animaux', 'Animaux'],
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

/* Configuration par champ : type de saisie + options (pour les tags) +
   éventuel sous-champ "détail" libre. La clé est `category.field`.
   - `tag`           : sélection unique parmi `options`
   - `tag+text`      : tag + champ libre secondaire (placeholder, persisté
                       dans `detailField`, optionnel sauf si `requireDetail`)
   - `numeric`       : input numérique (chiffres uniquement, message d'erreur
                       sur lettre / caractère spécial)
   - `text` (défaut) : input libre (tel placeholder éventuel)
*/
const TAG_VIOLET = '#7C3AED';
const FIELD_CONFIG = {
  'vie.foyer': {
    type: 'tag',
    options: ['Solo', 'Famille'],
  },
  'vie.logement': {
    type: 'tag',
    multi: true,
    options: ['Maison', 'Appartement', 'Studio', 'Loft', 'Duplex', 'Colocation'],
  },
  'vie.mobilite': {
    type: 'tag',
    multi: true,
    options: ['Voiture', 'Co-voiturage', 'Transports en commun', 'Vélo', 'Trottinette', 'Moto', 'Piéton'],
  },
  'vie.animaux': {
    type: 'tag+text',
    options: ['Oui', 'Non'],
    detailField: 'animauxDetail',
    detailPlaceholder: 'Chat',
    detailVisibleWhenTag: 'Oui',
  },
  'vie.vehicule': {
    type: 'tag+text',
    options: ['SUV', '4x4', 'Berline', 'Citadine', 'Break', 'Monospace', 'Coupé', 'Cabriolet', 'Utilitaire'],
    detailField: 'vehiculeMarque',
    detailPlaceholder: 'Marque du véhicule',
  },
  'pro.revenus': {
    type: 'numeric',
    placeholder: 'Montant en euros (chiffres uniquement)',
  },
  'patrimoine.residence': {
    type: 'tag',
    options: ['Oui', 'Non'],
  },
  'patrimoine.epargne': {
    type: 'text',
    placeholder: 'Actions, livret A, immobilier locatif...',
  },
  'patrimoine.projets': {
    type: 'tag',
    options: ['Achat', 'Construction', 'Location'],
  },
};

function fieldConfig(category, field) {
  return FIELD_CONFIG[`${category}.${field}`] || { type: 'text' };
}

function MesDonnees({ onGoPrefs }) {
  const ctx = useProspect();
  const profile = ctx?.profile;
  const deleted = ctx?.deleted || {};
  const removed = ctx?.removed || {};
  const phoneVerifiedAt = profile?.identityMeta?.phoneVerifiedAt || null;
  const [editing, setEditing] = useState(null); // { category, field, value }
  const [adding, setAdding] = useState(null); // category key
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmHide, setConfirmHide] = useState(null); // category key
  const [confirmFieldDelete, setConfirmFieldDelete] = useState(null); // { category, field, label }
  // Modal dédié à la vérification SMS du téléphone : on intercepte les
  // édit / add du champ `identity.telephone` pour le router ici plutôt
  // que par EditFieldModal / AddFieldModal, qui PATCHeraient en clair.
  const [phoneVerify, setPhoneVerify] = useState(null); // { initialPhone }

  // Categories permanently removed by the user are excluded from the list,
  // from the completeness calculation, and from the per-tier progress bars.
  const visibleCategories = DATA_CATEGORIES.filter(c => !removed[c.key]);
  // Niveau de palier = paliers atteints / paliers visibles (pondération
  // identique au scoring backend `/api/prospect/score`). Un palier est
  // "atteint" dès qu'au moins un de ses champs est renseigné. Aligné
  // avec la logique de matching côté pro (un palier requis n'a besoin
  // que d'une donnée pour qu'un prospect soit éligible).
  const reachedTiers = visibleCategories.filter(
    c => !deleted[c.key] && c.fields.some(([f]) => profile?.[c.key]?.[f]),
  ).length;
  const completeness = visibleCategories.length === 0
    ? 0
    : Math.round((reachedTiers / visibleCategories.length) * 100);
  // Détail "X champs remplis sur Y" affiché en sous-titre — granularité
  // utile pour le prospect qui veut maximiser ses gains.
  const totalFields = visibleCategories.reduce((acc, c) => acc + c.fields.length, 0);
  const filledFields = visibleCategories.reduce(
    (acc, c) => acc + (deleted[c.key] ? 0 : c.fields.filter(([f]) => profile?.[c.key]?.[f]).length),
    0,
  );

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
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Niveau de palier</div>
          <div className="serif tnum" style={{ fontSize: 40 }}>{completeness}<span style={{ fontSize: 20, color: 'var(--ink-4)' }}>%</span></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            <strong style={{ color: 'var(--ink-2)' }}>{reachedTiers}/{visibleCategories.length} paliers atteints</strong>
            {' · '}{filledFields}/{totalFields} champs renseignés
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
            Un palier est <em>atteint</em> dès qu'au moins une donnée y est renseignée. Plus vous remplissez de champs, plus votre BUUPP Score augmente.
          </div>
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
              {!isDeleted && (() => {
                // Bandeau "section incomplète" : visible dès qu'un champ est
                // rempli ET qu'un autre champ de la même section ne l'est pas.
                // Non-bloquant — c'est juste un nudge avec un peu d'humour pour
                // éviter d'avoir des sections à moitié renseignées en base.
                const missing = cat.fields
                  .filter(([f]) => !(profile?.[cat.key]?.[f]))
                  .map(([, l]) => l);
                const filledSomeButNotAll =
                  missing.length > 0 && missing.length < cat.fields.length;
                return (
                  <>
                    {filledSomeButNotAll && (
                      <div style={{
                        marginBottom: 14,
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'color-mix(in oklab, #B45309 8%, var(--paper))',
                        border: '1px solid color-mix(in oklab, #B45309 30%, var(--line))',
                        color: 'var(--ink-2)',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                      }} role="status">
                        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🙃</span>
                        <span>
                          Encore un petit effort pour valider la section{' '}
                          <strong>{cat.label}</strong> — il manque{' '}
                          <strong>
                            {missing.length === 1
                              ? missing[0].toLowerCase()
                              : missing.slice(0, -1).map(l => l.toLowerCase()).join(', ') +
                                ' et ' +
                                missing.slice(-1)[0].toLowerCase()}
                          </strong>{' '}
                          😉
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'var(--line)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                      {cat.fields.map(([field, label], idx) => {
                    const rawVal = profile?.[cat.key]?.[field] || '';
                    const cfg = fieldConfig(cat.key, field);
                    // Affichage compound : tag + détail (ex. "Berline · Renault").
                    const detailVal =
                      cfg.type === 'tag+text' && cfg.detailField
                        ? (profile?.[cat.key]?.[cfg.detailField] || '')
                        : '';
                    const showDetail =
                      detailVal &&
                      (!cfg.detailVisibleWhenTag || rawVal === cfg.detailVisibleWhenTag);
                    const val = rawVal && showDetail ? `${rawVal} · ${detailVal}` : rawVal;
                    const isPhone = cat.key === 'identity' && field === 'telephone';
                    const phoneVerified = isPhone && Boolean(phoneVerifiedAt);
                    const onEdit = isPhone
                      ? () => setPhoneVerify({ initialPhone: rawVal })
                      : () => setEditing({ category: cat.key, field, label, value: rawVal });
                    return (
                      <div key={field} style={{ background: 'var(--paper)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 3 }}>{label}</div>
                          <div className="row center" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 14, color: val ? 'var(--ink)' : 'var(--ink-5)', fontStyle: val ? 'normal' : 'italic' }}>
                              {val || '— non renseigné —'}
                            </div>
                            {isPhone && val && (
                              phoneVerified ? (
                                <span className="chip chip-good" style={{ fontSize: 10, fontWeight: 600 }}>✓ Vérifié</span>
                              ) : (
                                <span className="chip chip-warn" style={{ fontSize: 10, fontWeight: 600 }}>Non vérifié</span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="row gap-1">
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                            onClick={onEdit}
                            title={isPhone ? (val ? 'Modifier et vérifier le téléphone' : 'Renseigner et vérifier le téléphone') : undefined}>
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
              </>
            );
          })()}
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
          profileForCategory={profile?.[editing.category] || {}}
          onSave={(v) => {
            // Autocomplétion ville+CP → patch atomique des deux champs.
            if (v && typeof v === 'object' && v.pair) {
              ctx?.updateFields(editing.category, {
                ville: v.pair.ville,
                codePostal: v.pair.codePostal,
              });
            } else if (v && typeof v === 'object' && v.multi) {
              // tag+text (ex. animaux + animauxDetail) → patch atomique.
              ctx?.updateFields(editing.category, v.multi);
            } else {
              ctx?.updateField(editing.category, editing.field, v);
            }
            setEditing(null);
          }}
          onAutoSave={(v) => {
            // Persist sans fermer la modale (auto-save debounced 700 ms).
            if (v && typeof v === 'object' && v.multi) {
              ctx?.updateFields(editing.category, v.multi);
            } else {
              ctx?.updateField(editing.category, editing.field, v);
            }
          }}
          onClose={() => setEditing(null)}/>
      )}
      {adding && (
        <AddFieldModal category={DATA_CATEGORIES.find(c => c.key === adding)}
          existing={profile?.[adding] || {}}
          onSave={(field, value) => {
            // Intercepte l'ajout du téléphone : on bascule sur le flow
            // de vérification SMS au lieu d'un PATCH direct (l'API
            // /api/prospect/donnees rejette ce champ).
            if (adding === 'identity' && field === 'telephone') {
              setPhoneVerify({ initialPhone: value || '' });
              setAdding(null);
              return;
            }
            // Autocomplétion ville+CP : updateFields atomique au lieu
            // d'updateField (un seul PATCH, deux champs).
            if (value && typeof value === 'object' && value.pair) {
              ctx?.updateFields(adding, {
                ville: value.pair.ville,
                codePostal: value.pair.codePostal,
              });
            } else if (value && typeof value === 'object' && value.multi) {
              ctx?.updateFields(adding, value.multi);
            } else {
              ctx?.updateField(adding, field, value);
            }
            setAdding(null);
          }}
          onAutoSave={(field, value) => {
            // Auto-save debounced — exclus du flow téléphone (SMS) côté
            // modale ; ici on persiste direct les autres champs.
            if (value && typeof value === 'object' && value.multi) {
              ctx?.updateFields(adding, value.multi);
            } else {
              ctx?.updateField(adding, field, value);
            }
          }}
          onClose={() => setAdding(null)}/>
      )}
      {phoneVerify && (
        <PhoneVerifyModal
          initialPhone={phoneVerify.initialPhone}
          onDone={() => {
            setPhoneVerify(null);
            // Rafraîchit donnees + verification : le flow a écrit côté
            // serveur (telephone + phone_verified_at) sans passer par
            // updateField, donc le store local doit être resynchronisé.
            notifyProfileChanged();
          }}
          onClose={() => setPhoneVerify(null)}/>
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
            // Pour les champs composites (tag+text), on efface aussi le
            // sous-champ détail pour que l'état UI reste cohérent.
            const cfg = fieldConfig(confirmFieldDelete.category, confirmFieldDelete.field);
            if (cfg.type === 'tag+text' && cfg.detailField) {
              ctx?.updateFields(confirmFieldDelete.category, {
                [confirmFieldDelete.field]: '',
                [cfg.detailField]: '',
              });
            } else {
              ctx?.updateField(confirmFieldDelete.category, confirmFieldDelete.field, '');
            }
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

/* Masque "JJ/MM/AAAA" pour la date de naissance.
   - On extrait jusqu'à 8 chiffres (JJMMAAAA) et on insère les slashs
     automatiquement après 2 et 4 chiffres.
   - Pas de validation stricte ici (jour/mois) — uniquement le format.
     La validation jour/mois/année est faite à la sauvegarde via
     `isNaissanceValid` (et côté API, autoritaire). */
function maskNaissance(input) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}

function isNaissanceValid(s) {
  if (!s) return true; // vide = champ effacé, autorisé
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [d, m, y] = s.split('/').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Plage raisonnable (ex. pas de date dans le futur ni > 120 ans).
  const now = new Date();
  const year = now.getFullYear();
  if (y < year - 120 || y > year) return false;
  // Vérifie que la date existe (ex. 31/02/1990 → invalide).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/* Autocomplétion ville + code postal (France) basée sur l'API officielle
   `geo.api.gouv.fr`. CORS autorisé, gratuit, pas d'install.
   - Si l'utilisateur tape des chiffres → recherche par code postal.
   - Sinon → recherche par nom de commune.
   Une commune peut avoir plusieurs codes postaux (Paris, Lyon...) :
   chaque combinaison ville+CP est éclatée en suggestion distincte. */
function CityPostalAutocomplete({ value, onPick, autoFocus = false }) {
  const [query, setQuery] = useState(value || '');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = React.useRef(null);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const isPostal = /^\d{2,5}$/.test(q);
        const url = isPostal
          ? `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=nom,codesPostaux&limit=20`
          : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux&boost=population&limit=10`;
        const r = await fetch(url);
        if (!r.ok) { setItems([]); setLoading(false); return; }
        const data = await r.json();
        const exploded = [];
        for (const c of data || []) {
          const codes = Array.isArray(c.codesPostaux) ? c.codesPostaux : [];
          for (const cp of codes) {
            // Si l'utilisateur a saisi un code postal partiel, on filtre les
            // codes qui ne commencent pas par cette saisie pour réduire le
            // bruit (ex. taper "750" ne doit pas faire remonter "75116").
            if (isPostal && !cp.startsWith(q)) continue;
            exploded.push({ ville: c.nom, codePostal: cp });
          }
        }
        // Tri : code postal croissant pour les résultats par CP, ordre
        // pertinence sinon (déjà ordonné par boost=population).
        if (isPostal) exploded.sort((a, b) => a.codePostal.localeCompare(b.codePostal));
        setItems(exploded.slice(0, 30));
      } catch (e) {
        console.warn('[geo.api.gouv.fr] error', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Click extérieur ferme la liste.
  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (item) => {
    setQuery(`${item.codePostal} ${item.ville}`);
    setOpen(false);
    setHighlight(-1);
    onPick(item);
  };

  const onKeyDown = (e) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(items.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < items.length) {
        e.preventDefault();
        pick(items[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder="Tapez le nom de votre ville ou un code postal"
        style={{ width: '100%', fontSize: 14 }}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && query.trim().length >= 2 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--paper)', border: '1px solid var(--line-2)',
            borderRadius: 10, boxShadow: '0 12px 30px -12px rgba(15,22,41,.25)',
            maxHeight: 280, overflowY: 'auto', zIndex: 10,
          }}
        >
          {loading && items.length === 0 && (
            <div className="muted" style={{ padding: '10px 14px', fontSize: 13 }}>
              Recherche…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="muted" style={{ padding: '10px 14px', fontSize: 13 }}>
              Aucune ville trouvée.
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={`${it.codePostal}-${it.ville}-${i}`}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(it)}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: 'flex', justifyContent: 'space-between', width: '100%',
                padding: '10px 14px', textAlign: 'left',
                background: highlight === i ? 'var(--ivory-2)' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 14,
                color: 'var(--ink)',
              }}
            >
              <span>{it.ville}</span>
              <span className="mono" style={{ color: 'var(--ink-4)' }}>{it.codePostal}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* TagPicker : grille de pastilles cliquables. Tag actif rempli en violet.
   - Mode `multi=false` (défaut) : sélection unique. Cliquer le tag actif le
     désélectionne.
   - Mode `multi=true` : sélection multiple. Valeur stockée en CSV
     "A, B, C" pour rester compatible avec les colonnes TEXT. */
function tagsToList(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
function listToTags(list) {
  return list.join(', ');
}

function TagPicker({ value, options, onPick, multi = false }) {
  const selected = multi ? new Set(tagsToList(value)) : null;
  return (
    <div className="row gap-2" style={{ flexWrap: 'wrap', marginTop: 4 }}>
      {options.map(opt => {
        const active = multi ? selected.has(opt) : value === opt;
        const onClick = () => {
          if (multi) {
            const next = new Set(selected);
            if (next.has(opt)) next.delete(opt); else next.add(opt);
            // Préserve l'ordre des options pour un rendu stable.
            const ordered = options.filter(o => next.has(o));
            onPick(listToTags(ordered));
          } else {
            onPick(active ? '' : opt);
          }
        };
        return (
          <button
            key={opt}
            type="button"
            onClick={onClick}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1.5px solid ' + (active ? TAG_VIOLET : 'var(--line-2)'),
              background: active ? TAG_VIOLET : 'var(--paper)',
              color: active ? 'white' : 'var(--ink)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'background .15s, border-color .15s, transform .1s',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.borderColor = TAG_VIOLET;
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.borderColor = 'var(--line-2)';
            }}
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* Saisie générique pour un champ : route vers le bon widget selon
   FIELD_CONFIG (tag, tag+text, numeric, text). Renvoie via `onChange`
   un objet { value, detail? } : les modaux savent s'il faut PATCH un
   ou deux champs. */
function FieldInput({ category, field, value, detail, onChange, autoFocus = false }) {
  const cfg = fieldConfig(category, field);
  const setValue = (v) => onChange({ value: v, detail: cfg.type === 'tag+text' ? detail : undefined });
  const setDetail = (d) => onChange({ value, detail: d });

  if (cfg.type === 'tag') {
    return (
      <>
        <TagPicker value={value || ''} options={cfg.options} multi={!!cfg.multi} onPick={setValue} />
        {cfg.multi && (
          <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            Plusieurs choix possibles — cliquez pour ajouter ou retirer.
          </div>
        )}
      </>
    );
  }
  if (cfg.type === 'tag+text') {
    const showDetail =
      !cfg.detailVisibleWhenTag || value === cfg.detailVisibleWhenTag;
    return (
      <>
        <TagPicker value={value || ''} options={cfg.options} onPick={setValue} />
        {showDetail && (
          <input
            className="input"
            value={detail || ''}
            onChange={e => setDetail(e.target.value)}
            placeholder={cfg.detailPlaceholder}
            autoFocus={autoFocus && !!value}
            style={{ width: '100%', fontSize: 14, marginTop: 12 }}
          />
        )}
      </>
    );
  }
  if (cfg.type === 'numeric') {
    const invalid = !!value && !/^\d+$/.test(value);
    return (
      <>
        <input
          className="input"
          value={value || ''}
          onChange={e => setValue(e.target.value)}
          inputMode="numeric"
          placeholder={cfg.placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%', fontSize: 14,
            borderColor: invalid ? 'var(--danger)' : undefined,
          }}
        />
        {invalid && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>
            Renseignez uniquement les chiffres.
          </div>
        )}
      </>
    );
  }
  // type 'text' (défaut)
  return (
    <input
      className="input"
      value={value || ''}
      onChange={e => setValue(e.target.value)}
      placeholder={cfg.placeholder}
      autoFocus={autoFocus}
      style={{ width: '100%', fontSize: 14 }}
    />
  );
}

/* Validation de soumission selon le type de champ. Retourne `true`
   si l'enregistrement est autorisé. */
function isFieldSavable(category, field, value, detail) {
  const cfg = fieldConfig(category, field);
  if (cfg.type === 'tag' || cfg.type === 'tag+text') {
    // Pour les tags, vide = clear → autorisé.
    return true;
  }
  if (cfg.type === 'numeric') {
    if (!value) return true; // clear OK
    return /^\d+$/.test(value);
  }
  return true;
}

function EditFieldModal({ edit, onSave, onAutoSave, onClose, profileForCategory }) {
  const cfg = fieldConfig(edit.category, edit.field);
  const isNaissance = edit.field === 'naissance';
  const isCityPostal = edit.category === 'localisation' && (edit.field === 'ville' || edit.field === 'codePostal');
  const [val, setVal] = useState(edit.value);
  const initialDetail =
    cfg.type === 'tag+text' && cfg.detailField
      ? (profileForCategory?.[cfg.detailField] || '')
      : '';
  const [detail, setDetail] = useState(initialDetail);
  const [pair, setPair] = useState(null); // { ville, codePostal } après sélection
  // Auto-save indicator : "saving" pendant le PATCH, "saved" après ack.
  // Permet à l'utilisateur de fermer la modale sans crainte de perte de
  // données — la persistance s'est déjà faite à chaque pause de saisie.
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  // Debounce auto-save : 700 ms après la dernière modif valide → PATCH
  // sans fermer la modale. La saisie ville+CP (autocomplétion) garde son
  // flow explicite via le bouton "Enregistrer" : pas d'auto-save tant
  // qu'aucune sélection complète n'est faite.
  useEffect(() => {
    if (!onAutoSave || isCityPostal) return;
    if (isNaissance) {
      // Auto-save uniquement quand la date est complète et valide,
      // ou réinitialisée à vide (effacement explicite).
      const ok = val === '' || isNaissanceValid(val);
      if (!ok) return;
    } else if (!isFieldSavable(edit.category, edit.field, val, detail)) {
      return;
    }
    // Skip si rien n'a changé depuis l'ouverture.
    if (val === edit.value && detail === initialDetail) return;
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      try {
        if (cfg.type === 'tag+text' && cfg.detailField) {
          onAutoSave({ multi: { [edit.field]: val, [cfg.detailField]: detail } });
        } else {
          onAutoSave(val);
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, detail]);

  if (isCityPostal) {
    return (
      <ModalShell title={"Modifier : " + edit.label} onClose={onClose}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          Tapez les premières lettres de votre ville ou son code postal puis sélectionnez-la dans la liste — les deux champs (Ville et Code postal) seront renseignés automatiquement.
        </div>
        <CityPostalAutocomplete
          value={edit.value}
          onPick={(item) => setPair(item)}
          autoFocus
        />
        {pair && (
          <div className="row gap-2" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="chip">{pair.ville}</span>
            <span className="chip mono">{pair.codePostal}</span>
            <span className="muted" style={{ fontSize: 12 }}>Sélection prête à enregistrer.</span>
          </div>
        )}
        <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
          <button onClick={() => pair && onSave({ pair })} disabled={!pair} className="btn btn-primary btn-sm">
            Enregistrer
          </button>
        </div>
      </ModalShell>
    );
  }

  // Naissance : masque dédié, pas géré par FieldInput.
  if (isNaissance) {
    const showError = val && !isNaissanceValid(val);
    const canSave = isNaissanceValid(val) || !val;
    return (
      <ModalShell title={"Modifier : " + edit.label} onClose={onClose}>
        <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>{edit.label}</div>
        <input
          className="input"
          value={val}
          onChange={e => setVal(maskNaissance(e.target.value))}
          autoFocus
          placeholder="JJ/MM/AAAA"
          inputMode="numeric"
          maxLength={10}
          style={{ width: '100%', fontSize: 14, marginBottom: showError ? 8 : 20 }}
        />
        {showError && (
          <div className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
            Format attendu : JJ/MM/AAAA (ex. 14/06/1988).
          </div>
        )}
        {!val && (
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Format attendu : JJ/MM/AAAA.
          </div>
        )}
        <SaveIndicator status={saveStatus} />
        <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
          <button onClick={() => onSave(val)} disabled={!canSave} className="btn btn-primary btn-sm">Enregistrer</button>
        </div>
      </ModalShell>
    );
  }

  // Cas générique : route vers FieldInput selon la config.
  const canSave = isFieldSavable(edit.category, edit.field, val, detail);
  const submit = () => {
    if (cfg.type === 'tag+text' && cfg.detailField) {
      onSave({ multi: { [edit.field]: val, [cfg.detailField]: detail } });
    } else {
      onSave(val);
    }
  };
  return (
    <ModalShell title={"Modifier : " + edit.label} onClose={onClose}>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 12 }}>{edit.label}</div>
      <FieldInput
        category={edit.category}
        field={edit.field}
        value={val}
        detail={detail}
        onChange={({ value, detail: d }) => {
          setVal(value);
          if (d !== undefined) setDetail(d);
        }}
        autoFocus
      />
      <SaveIndicator status={saveStatus} />
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        <button onClick={submit} disabled={!canSave} className="btn btn-primary btn-sm">Enregistrer</button>
      </div>
    </ModalShell>
  );
}

/* Petit indicateur d'auto-save affiché sous les champs dans les modales
   d'édition. Donne au user le feedback que ses données ont été persistées
   sans qu'il ait besoin de cliquer sur "Enregistrer". */
function SaveIndicator({ status }) {
  if (status === 'idle') return null;
  const isSaving = status === 'saving';
  return (
    <div
      className="row"
      style={{
        gap: 6, marginTop: 14, alignItems: 'center', fontSize: 12,
        color: isSaving ? 'var(--ink-4)' : 'var(--good)',
      }}
      aria-live="polite"
    >
      <span aria-hidden="true">{isSaving ? '⏳' : '✓'}</span>
      <span>{isSaving ? 'Enregistrement…' : 'Modifications enregistrées automatiquement'}</span>
    </div>
  );
}

function AddFieldModal({ category, existing, onSave, onAutoSave, onClose }) {
  const empty = category.fields.filter(([f]) => !existing[f]);
  const pool = empty.length ? empty : category.fields;
  const [field, setField] = useState(pool[0][0]);
  const [val, setVal] = useState(existing[pool[0][0]] || '');
  const [detail, setDetail] = useState('');
  const [pair, setPair] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  const cfg = fieldConfig(category.key, field);
  const isNaissance = field === 'naissance';
  const isCityPostal = category.key === 'localisation' && (field === 'ville' || field === 'codePostal');

  // Auto-save : 700 ms après la dernière modif valide → PATCH sans
  // fermer la modale. Ne s'applique pas au flow ville+CP (Enregistrer
  // explicite après sélection) ni au champ téléphone qui passe par
  // PhoneVerifyModal (vérification SMS obligatoire).
  useEffect(() => {
    if (!onAutoSave) return;
    if (isCityPostal) return;
    if (category.key === 'identity' && field === 'telephone') return;
    if (isNaissance) {
      if (!val || !isNaissanceValid(val)) return;
    } else if (!isFieldSavable(category.key, field, val, detail)) {
      return;
    }
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      try {
        if (cfg.type === 'tag+text' && cfg.detailField) {
          onAutoSave(field, { multi: { [field]: val, [cfg.detailField]: detail } });
        } else {
          onAutoSave(field, val);
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, detail, field]);

  const showError = isNaissance && val && !isNaissanceValid(val);
  const canSubmit = isCityPostal
    ? !!pair
    : isNaissance
      ? !!val && isNaissanceValid(val)
      : (cfg.type === 'tag' || cfg.type === 'tag+text')
        ? !!val
        : cfg.type === 'numeric'
          ? !!val && /^\d+$/.test(val)
          : !!val;

  const onFieldChange = (nextField) => {
    setField(nextField);
    setPair(null);
    setDetail('');
    const initial = existing[nextField] || '';
    setVal(nextField === 'naissance' ? maskNaissance(initial) : initial);
  };

  const submit = () => {
    if (isCityPostal) {
      onSave(field, { pair });
      return;
    }
    if (cfg.type === 'tag+text' && cfg.detailField) {
      onSave(field, { multi: { [field]: val, [cfg.detailField]: detail } });
      return;
    }
    onSave(field, val);
  };

  return (
    <ModalShell title={"Ajouter : " + category.label} onClose={onClose}>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Donnée</div>
      <select className="input" value={field}
        onChange={e => onFieldChange(e.target.value)}
        style={{ width: '100%', fontSize: 14, marginBottom: 14, padding: '10px 12px' }}>
        {category.fields.map(([f, l]) => <option key={f} value={f}>{l}{existing[f] ? ' (déjà renseignée)' : ''}</option>)}
      </select>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Valeur</div>
      {isCityPostal ? (
        <>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
            Tapez les premières lettres de votre ville (ou son code postal) puis cliquez sur la bonne entrée — Ville et Code postal seront renseignés ensemble.
          </div>
          <CityPostalAutocomplete
            value={existing[field] || ''}
            onPick={(item) => setPair(item)}
            autoFocus
          />
          {pair && (
            <div className="row gap-2" style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="chip">{pair.ville}</span>
              <span className="chip mono">{pair.codePostal}</span>
            </div>
          )}
          <div style={{ marginBottom: 20 }} />
        </>
      ) : isNaissance ? (
        <>
          <input
            className="input"
            value={val}
            onChange={e => setVal(maskNaissance(e.target.value))}
            autoFocus
            placeholder="JJ/MM/AAAA"
            inputMode="numeric"
            maxLength={10}
            style={{ width: '100%', fontSize: 14, marginBottom: showError ? 8 : 20 }}
          />
          {showError && (
            <div className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
              Format attendu : JJ/MM/AAAA (ex. 14/06/1988).
            </div>
          )}
        </>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <FieldInput
            category={category.key}
            field={field}
            value={val}
            detail={detail}
            onChange={({ value, detail: d }) => {
              setVal(value);
              if (d !== undefined) setDetail(d);
            }}
            autoFocus
          />
        </div>
      )}
      <SaveIndicator status={saveStatus} />
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        <button onClick={submit} className="btn btn-primary btn-sm" disabled={!canSubmit}>
          Ajouter
        </button>
      </div>
    </ModalShell>
  );
}

/* Modal de vérification SMS du téléphone (Mes données → Identification).
   Flow en 2 étapes via Twilio Verify (proxy par /api/prospect/phone/*) :
     1. saisie du numéro → POST /api/prospect/phone/start
        → Twilio envoie un code à 6 chiffres par SMS.
     2. saisie du code → POST /api/prospect/phone/verify
        → Twilio valide → upsert prospect_identity.telephone +
          phone_verified_at en DB. */
function PhoneVerifyModal({ initialPhone, onDone, onClose }) {
  const [step, setStep] = useState('phone');     // 'phone' | 'code'
  const [phone, setPhone] = useState(initialPhone || '');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const sendCode = async () => {
    setErr(null); setInfo(null); setSubmitting(true);
    try {
      const r = await fetch('/api/prospect/phone/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const echoed = j.normalizedPhone ? ` (numéro normalisé : ${j.normalizedPhone})` : '';
        setErr((j.message || "Impossible d'envoyer le code.") + echoed);
        return;
      }
      setStep('code');
      // En mode dev (Twilio non configuré), le serveur renvoie le code
      // factice ('000000') pour permettre le test du flow.
      if (j.devCode) {
        setCode(j.devCode);
        setInfo(`Mode dev : code ${j.devCode} pré-rempli (Twilio non configuré).`);
      } else {
        setCode('');
        setInfo('Code envoyé par SMS. Saisissez-le ci-dessous.');
      }
    } catch (e) {
      setErr('Erreur réseau. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    setErr(null); setInfo(null); setSubmitting(true);
    try {
      const r = await fetch('/api/prospect/phone/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.message || 'Code incorrect.');
        return;
      }
      onDone?.();
    } catch (e) {
      setErr('Erreur réseau. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => onClose?.();

  return (
    <ModalShell title="Vérification du téléphone" onClose={close}>
      {step === 'phone' && (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Saisissez votre numéro. Nous vous enverrons un code de confirmation à 6 chiffres
            par SMS pour valider l'inscription du téléphone à votre profil.
          </div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Numéro de téléphone</div>
          <input className="input" value={phone} onChange={e => setPhone(e.target.value)} autoFocus
            placeholder="+33 6 12 34 56 78"
            inputMode="tel"
            style={{ width: '100%', fontSize: 14, marginBottom: 16 }}/>
          {err && <div className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
          <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button onClick={close} className="btn btn-ghost btn-sm" disabled={submitting}>Annuler</button>
            <button onClick={sendCode} className="btn btn-primary btn-sm"
              disabled={submitting || !phone.trim()}>
              {submitting ? 'Envoi…' : 'Envoyer le code'}
            </button>
          </div>
        </>
      )}
      {step === 'code' && (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Entrez le code à 6 chiffres reçu sur <strong style={{ color: 'var(--ink)' }}>{phone}</strong>.
            Le code expire dans 10 minutes.
          </div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Code reçu</div>
          <input className="input" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus inputMode="numeric" maxLength={6}
            placeholder="123456"
            style={{ width: '100%', fontSize: 18, letterSpacing: '.4em', textAlign: 'center', marginBottom: 12 }}/>
          {info && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{info}</div>}
          {err && <div className="muted" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{err}</div>}
          <div className="row between modal-actions" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => { setStep('phone'); setCode(''); setErr(null); setInfo(null); }}
              className="btn btn-ghost btn-sm" disabled={submitting}>
              ← Modifier le numéro
            </button>
            <div className="row gap-2">
              <button onClick={sendCode} className="btn btn-ghost btn-sm" disabled={submitting}>
                Renvoyer le code
              </button>
              <button onClick={submitCode} className="btn btn-primary btn-sm"
                disabled={submitting || code.length !== 6}>
                {submitting ? 'Vérification…' : 'Valider'}
              </button>
            </div>
          </div>
        </>
      )}
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
      <SectionTitle eyebrow="Mises en relation" title="Demandes en attente" desc="Le délai d'acceptation dépend de chaque campagne — il est affiché en temps réel sur chaque demande. Sans réponse à temps, la sollicitation expire."/>
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
                    <td>
                      <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
                        <span>{h.proName}</span>
                        {h.isFlashDeal && (
                          <span title="Sollicitation Flash Deal — gains multipliés"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 999,
                              background: 'linear-gradient(135deg, #B91C1C, #EF4444)',
                              color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                            }}>
                            <Icon name="bolt" size={9}/> FLASH
                          </span>
                        )}
                      </div>
                    </td>
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
    done: "Téléphone vérifié",
    requirement: "Vérifiez votre numéro de téléphone par SMS pour passer au palier Vérifié.",
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

// Index 1-based d'un palier de vérification dans l'échelle des 3 paliers.
// Utilisé pour afficher "Palier 2/3" plutôt que "66%" — qui prête à
// confusion (un user à 66% pensait être "vérifié à 66%" alors que c'est
// la position dans l'échelle, pas un degré de complétion).
function verifTierPosition(tier) {
  if (tier === 'verifie') return 2;
  if (tier === 'certifie_confiance') return 3;
  return 1;
}

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
  const ribValidated = data?.rib?.validated;
  const ibanMasked = data?.rib?.ibanMasked;


  return (
    <div className="col gap-6">
      <SectionTitle
        eyebrow="Paliers de vérification"
        title="Vos paliers"
        desc="Trois paliers : Basique (à la création), Vérifié (numéro de téléphone vérifié par SMS), Certifié confiance (rendez-vous physique accepté). Chaque palier débloque des demandes plus exigeantes et mieux rémunérées."
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
                    <span className="muted" style={{ fontSize: 14 }}>
                      {' · Palier '}{currentIdx + 1}/{VERIF_TIERS.length}
                    </span>
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
            [1, 'Identification', 'minimum 1,00 €'],
            [2, 'Localisation', '1,00 – 2,00 €'],
            [3, 'Style de vie', '2,00 – 3,50 €'],
            [4, 'Données pro', '3,50 – 5,00 €'],
            [5, 'Patrimoine', '5,00 – 10,00 €'],
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
          <div className="row gap-2" style={{ marginTop: 18, flexWrap: 'wrap' }}>
            {/* Les deux PDF sont toujours générables — même quand le seuil
                DGFiP n'a pas été atteint, l'attestation est utile au
                prospect (preuve qu'il n'avait rien à déclarer cette
                année-là). On retire donc le `disabled` historique. */}
            <a
              className="btn btn-ghost btn-sm"
              href={prev?.year ? `/api/prospect/fiscal/${prev.year}/recap` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={`Télécharger le récapitulatif annuel ${prev?.year ?? ''} (PDF)`}
              aria-disabled={!prev?.year}
              style={!prev?.year ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              <Icon name="download" size={12}/> Récap {prev?.year ?? ''} (PDF)
            </a>
            <a
              className="btn btn-ghost btn-sm"
              href={prev?.year ? `/api/prospect/fiscal/${prev.year}/dgfip-receipt` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={`Attestation DGFiP ${prev?.year ?? ''} (PDF)`}
              aria-disabled={!prev?.year}
              style={!prev?.year ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              <Icon name="doc" size={12}/> Reçu DGFiP
            </a>
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
