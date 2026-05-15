// Pro dashboard
var { useState, useEffect } = React;
const PRO_SECTIONS = [
  { id: 'create',       icon: 'plus',      label: 'Créer une campagne', featured: true },
  { id: 'overview',     icon: 'chart',     label: "Vue d'ensemble" },
  { id: 'campagnes',    icon: 'target',    label: 'Campagnes' },
  { id: 'contacts',     icon: 'users',     label: 'Mes contacts' },
  { id: 'analytics',    icon: 'trend',     label: 'Analytics' },
  { id: 'informations', icon: 'briefcase', label: 'Mes informations' },
  { id: 'facturation',  icon: 'money',     label: 'Facturation' },
  { id: 'messages',     icon: 'inbox',     label: 'Mes messages' },
];

function ProDashboard({ go }) {
  const [sec, setSec] = useState('overview');
  const [recharge, setRecharge] = useState(false);
  const [campDetail, setCampDetail] = useState(null);
  // Source de duplication pour le wizard "Nouvelle campagne". Null pour
  // une création vierge ; sinon contient l'`id` de la campagne à dupliquer.
  // CreateCampaign hydrate alors tout son state depuis /api/pro/campaigns/:id
  // et saute directement à l'étape Récap.
  const [duplicateSourceId, setDuplicateSourceId] = useState(null);
  // Section vers laquelle ramener le pro automatiquement dès qu'il a complété
  // les champs obligatoires (raison sociale + ville). Posée quand un écran
  // bloque sur des informations société manquantes et redirige vers
  // "Mes informations" (ex. CreateCampaign → onGoInformations).
  const [returnAfterInfo, setReturnAfterInfo] = useState(null);

  // Détecte le retour Stripe `?continue_campaign=1` → bascule
  // automatiquement sur le wizard de création de campagne. Le wizard
  // restaurera ensuite le brouillon depuis sessionStorage et sautera
  // à l'étape Récap. Le flag est laissé dans l'URL — il sera nettoyé
  // par ProHeader après le polling du wallet.
  useEffect(() => {
    try {
      const search = (window.top || window).location.search || '';
      if (search.includes('continue_campaign=1')) {
        setSec('create');
      }
    } catch {}
  }, []);
  // Informations société partagées entre l'onglet "Mes informations" et le
  // wizard "Créer une campagne" (la raison sociale + la ville sont obligatoires
  // pour pouvoir lancer une campagne — cf. ProInfoFieldDeleteModal).
  const [companyInfo, setCompanyInfoState] = useState({
    raisonSociale: '',
    adresse: '',
    ville: '',
    codePostal: '',
    siren: '',
    secteur: '',
    formeJuridique: '',
    capitalSocialEur: '',
    siret: '',
    rcsVille: '',
    rmNumber: '',
  });
  // Hydrate from /api/pro/info on mount + à chaque event `pro:info-changed`
  // (émis après un PATCH réussi, notamment depuis la modale "Compléter la
  // facture"). Sans ça, l'onglet "Mes informations" affichait les valeurs
  // stales tant qu'on ne rechargeait pas la page.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetch('/api/pro/info', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setCompanyInfoState(prev => ({ ...prev, ...j })); })
      .catch(() => {});
    refresh();
    const onChange = () => refresh();
    window.addEventListener('pro:info-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('pro:info-changed', onChange);
    };
  }, []);
  // Auto-redirect : dès que les deux champs requis pour lancer une campagne
  // (raison sociale + ville) sont renseignés, on ramène le pro vers la
  // section dont il vient (returnAfterInfo). Petit délai pour qu'il ait le
  // temps de voir la valeur saisie + la bannière de retour.
  useEffect(() => {
    if (!returnAfterInfo) return;
    if (!companyInfo?.raisonSociale?.trim()) return;
    if (!companyInfo?.ville?.trim()) return;
    const handle = setTimeout(() => {
      setSec(returnAfterInfo);
      setReturnAfterInfo(null);
    }, 800);
    return () => clearTimeout(handle);
  }, [returnAfterInfo, companyInfo]);

  // Toute navigation manuelle (clic sidebar, bouton "Annuler le retour")
  // efface l'intent de retour : on respecte le choix utilisateur de rester
  // ailleurs ou d'aller voir une autre section.
  const navTo = React.useCallback((next) => {
    setReturnAfterInfo(null);
    setSec(next);
  }, []);

  // Wrapper that persists each update via PATCH and notifies subscribers.
  const setCompanyInfo = React.useCallback((updater) => {
    setCompanyInfoState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const diff = {};
      for (const key of Object.keys(next)) {
        if (next[key] !== prev[key]) diff[key] = next[key];
      }
      if (Object.keys(diff).length > 0) {
        fetch('/api/pro/info', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(diff),
        })
          .then(async r => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              console.warn('[pro/info] PATCH failed', r.status, j);
              return;
            }
            try { window.dispatchEvent(new Event('pro:info-changed')); } catch {}
          })
          .catch(e => console.warn('[pro/info] PATCH error', e));
      }
      return next;
    });
  }, []);

  // `pendingContact` : ligne ciblée par la recherche header pour scroll
  // + surlignage dans <Contacts/>. On passe par un token (timestamp) pour
  // que la même ligne, sélectionnée à nouveau, soit consommée comme un
  // nouvel évènement par Contacts (qui dépend de `pendingContact`).
  const [pendingContact, setPendingContact] = useState(null);

  // Le champ de recherche du header (HeaderSearch) émet
  // `bupp:search-select` au clic sur un résultat. Pour un pro :
  //   - kind='campaign' → on ouvre la fiche de campagne (CampaignDetail).
  //   - kind='contact'  → on bascule sur l'onglet Mes contacts ; Contacts
  //                       lit `pendingContact` pour scroller / surligner.
  useEffect(() => {
    const onPick = (e) => {
      const d = e?.detail;
      if (!d) return;
      setReturnAfterInfo(null);
      if (d.kind === 'campaign' && d.payload) {
        setSec('campagnes');
        setCampDetail(d.payload);
      } else if (d.kind === 'contact') {
        setPendingContact({ token: Date.now(), id: d.id, payload: d.payload });
        setSec('contacts');
      }
    };
    window.addEventListener('bupp:search-select', onPick);
    return () => window.removeEventListener('bupp:search-select', onPick);
  }, []);

  // Bridge cloche → onglet Messages. Symétrique du prospect. Cf.
  // ProspectDashboardInner pour le pattern complet (event listener +
  // highlightId passé à MessagesPanel).
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

  return (
    <>
    <DashShell role="pro" go={go} sections={PRO_SECTIONS} current={sec} onNav={navTo}
      overrideName={companyInfo?.raisonSociale || ''}
      header={<ProHeader companyInfo={companyInfo} onCreate={() => { setDuplicateSourceId(null); setSec('create'); }} onRecharge={() => setRecharge(true)}/>}>
      {sec === 'overview' && <Overview onCreate={() => { setDuplicateSourceId(null); setSec('create'); }}/>}
      {sec === 'campagnes' && !campDetail && (
        <Campagnes
          onCreate={() => { setDuplicateSourceId(null); setSec('create'); }}
          onDetail={setCampDetail}
          onDuplicate={(id) => { setDuplicateSourceId(id); setSec('create'); }}
        />
      )}
      {sec === 'campagnes' && campDetail && (
        <CampaignDetail
          camp={campDetail}
          onBack={() => setCampDetail(null)}
          onDuplicate={(id) => {
            setCampDetail(null);
            setDuplicateSourceId(id);
            setSec('create');
          }}
        />
      )}
      {sec === 'create' && (
        <CreateCampaign
          onDone={() => { setDuplicateSourceId(null); setSec('campagnes'); }}
          companyInfo={companyInfo}
          onGoInformations={() => { setReturnAfterInfo('create'); setSec('informations'); }}
          duplicateSourceId={duplicateSourceId}
          onRecharge={() => setRecharge(true)}
        />
      )}
      {sec === 'contacts' && <Contacts pendingContact={pendingContact} onPendingConsumed={() => setPendingContact(null)}/>}
      {sec === 'analytics' && <Analytics/>}
      {sec === 'informations' && (
        <MesInformations
          info={companyInfo}
          setInfo={setCompanyInfo}
          returnAfterInfo={returnAfterInfo}
          onCancelReturn={() => setReturnAfterInfo(null)}
        />
      )}
      {sec === 'facturation' && <Facturation onRecharge={() => setRecharge(true)}/>}
      {sec === 'messages' && <MessagesPanel role="pro" highlightId={highlightMessageId} onHighlightConsumed={() => setHighlightMessageId(null)}/>}
      {sec === 'suggestions' && <SuggestionsPanel role="pro"/>}
    </DashShell>
    {recharge && <RechargeModal onClose={() => setRecharge(false)}/>}
    </>
  );
}

/* Cache module-level du wallet pro — partagé entre le header et la
   modale Recharge. Invalidé via l'event `pro:wallet-changed` (émis
   après un retour de Checkout success ou une recharge confirmée). */
let _proWalletCache = null;
let _proWalletPromise = null;
async function fetchProWallet() {
  if (_proWalletCache) return _proWalletCache;
  if (_proWalletPromise) return _proWalletPromise;
  _proWalletPromise = fetch('/api/pro/wallet', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { _proWalletCache = j; _proWalletPromise = null; return j; })
    .catch(() => { _proWalletPromise = null; return null; });
  return _proWalletPromise;
}
function invalidateProWallet() {
  _proWalletCache = null;
  _proWalletPromise = null;
}

// Cache module-level de l'aperçu pro — mutualisé entre ProHeader et Overview.
// Invalidé via l'event `pro:overview-changed` (à émettre après une action
// qui modifie un compteur affiché : pause/play campagne, accept relation, etc.).
let _proOverviewCache = null;
let _proOverviewPromise = null;
async function fetchProOverview() {
  if (_proOverviewCache) return _proOverviewCache;
  if (_proOverviewPromise) return _proOverviewPromise;
  _proOverviewPromise = fetch('/api/pro/overview', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { _proOverviewCache = j; _proOverviewPromise = null; return j; })
    .catch(() => { _proOverviewPromise = null; return null; });
  return _proOverviewPromise;
}
function invalidateProOverview() {
  _proOverviewCache = null;
  _proOverviewPromise = null;
}

const _eurFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
});

function ProHeader({ companyInfo, onCreate, onRecharge }) {
  // Reflète en direct la raison sociale saisie dans "Mes informations".
  // Pas de fallback figé : tant que l'hydratation /api/pro/info n'est pas
  // arrivée, on affiche '…' (cohérent avec les autres placeholders).
  const raison = (companyInfo?.raisonSociale || '').trim() || '…';
  const secteur = (companyInfo?.secteur || '').trim();

  const [wallet, setWallet] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchProWallet().then(j => !cancelled && setWallet(j));
    refresh();

    // Stripe Checkout renvoie sur /pro?topup=success&session_id=cs_…
    // Pour ne pas dépendre du webhook (qui n'arrive jamais en dev local
    // sans `stripe listen`), on appelle d'abord /api/pro/topup/reconcile
    // avec le session_id : il revérifie la session côté Stripe et
    // crédite le wallet si pas encore fait. Le polling reste en filet
    // de sécurité au cas où le reconcile a déjà été exécuté par un
    // refresh précédent — il verra `alreadyCredited`.
    if (typeof window !== 'undefined' && window.location.search.includes('topup=success')) {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const initialBalance = Number(_proWalletCache?.walletBalanceCents ?? 0);

      const cleanupUrl = () => {
        try { window.history.replaceState({}, '', window.location.pathname); } catch {}
      };

      const reconcile = async () => {
        if (!sessionId) return;
        try {
          const r = await fetch('/api/pro/topup/reconcile', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            console.warn('[pro/topup/reconcile] failed', r.status, j);
          }
        } catch (e) {
          console.warn('[pro/topup/reconcile] network error', e);
        }
      };

      let attempts = 0;
      const poll = async () => {
        if (cancelled || attempts >= 16) return;
        attempts++;
        invalidateProWallet();
        const fresh = await fetchProWallet();
        if (cancelled) return;
        setWallet(fresh);
        const newBalance = Number(fresh?.walletBalanceCents ?? 0);
        if (newBalance > initialBalance) {
          try { window.dispatchEvent(new Event('pro:wallet-changed')); } catch {}
          cleanupUrl();
          return;
        }
        setTimeout(poll, 750);
      };

      // Reconcile d'abord (réveille le wallet immédiatement si webhook
      // raté), puis poll en filet de sécurité.
      reconcile().then(() => setTimeout(poll, 200));
    }

    const onChange = () => { invalidateProWallet(); refresh(); };
    window.addEventListener('pro:wallet-changed', onChange);

    // Écoute des messages parent → iframe. Le composant TopupReconciler
    // côté Next.js émet `{bupp:'wallet-refresh'}` après avoir crédité
    // le wallet via /api/pro/topup/reconcile : on invalide le cache
    // et on retire la valeur fraîche pour que l'en-tête s'actualise
    // immédiatement. Pas de filtre origin — la même origine héberge
    // shell.html et les pages parentes (sécurité Clerk côté serveur).
    const onParentMsg = (e) => {
      if (e?.data?.bupp === 'wallet-refresh') {
        invalidateProWallet();
        fetchProWallet().then(j => {
          if (!cancelled) {
            setWallet(j);
            try { window.dispatchEvent(new Event('pro:wallet-changed')); } catch {}
          }
        });
      }
    };
    window.addEventListener('message', onParentMsg);

    return () => {
      cancelled = true;
      window.removeEventListener('pro:wallet-changed', onChange);
      window.removeEventListener('message', onParentMsg);
    };
  }, []);

  // Affiche le solde DISPONIBLE (= balance - réservé). Le réservé
  // correspond aux campagnes actives : montant déjà engagé qui ne
  // quittera réellement le wallet qu'à la clôture (`close_campaign_settle`).
  // Le pro voit ainsi "ce qu'il peut encore engager" pour de nouvelles
  // campagnes.
  const balanceText = wallet
    ? _eurFmt.format(Number(wallet.walletAvailableEur ?? wallet.walletBalanceEur ?? 0))
    : '…';
  const reservedEur = Number(wallet?.walletReservedEur ?? 0);

  // Overview stats — partagé via le cache module fetchProOverview pour
  // ne pas dupliquer la requête entre header et l'onglet Vue d'ensemble.
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchProOverview().then(j => { if (!cancelled) setOverview(j); });
    refresh();
    const onChange = () => { invalidateProOverview(); refresh(); };
    window.addEventListener('pro:overview-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('pro:overview-changed', onChange); };
  }, []);
  const contactsThisMonth = overview?.contactsAcceptedThisMonth ?? null;
  const activeCampaigns = overview?.activeCampaignsCount ?? null;
  const acceptanceRate = overview?.acceptanceRate ?? null;
  // ROI 30j servi par /api/pro/overview avec la vraie formule
  //   (gains_potentiels − coût) / coût × 100
  // gains_potentiels = contacts_acceptés × tauxConv × valeurClient
  // Hypothèses partagées dans lib/pro/roi.ts.
  const roiPct = overview?.roi?.pct ?? null;
  const roi = overview === null
    ? '…'
    : roiPct === null
      ? '—'
      : (roiPct > 0 ? '+' : '') + roiPct + ' %';

  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— {raison}{secteur ? ' · ' + secteur : ''}</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            <em>{balanceText}</em> de crédit disponible · {contactsThisMonth ?? '…'} contact{contactsThisMonth === 1 ? '' : 's'} ce mois
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {activeCampaigns ?? '…'} campagne{activeCampaigns === 1 ? '' : 's'} active{activeCampaigns === 1 ? '' : 's'} · taux d'acceptation moyen {acceptanceRate != null ? acceptanceRate + '%' : '…'} · ROI estimé {roi}
          </div>
          {reservedEur > 0 && (
            <div className="mono" style={{
              fontSize: 11.5, marginTop: 6, color: 'var(--ink-4)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 6,
              background: 'color-mix(in oklab, var(--accent) 8%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--line))',
            }} title="Engagé dans des campagnes actives — débité réellement à la clôture">
              {_eurFmt.format(reservedEur)} réservés sur campagnes actives
            </div>
          )}
        </div>
        <div className="row center gap-3 pro-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={onRecharge}><Icon name="plus" size={12}/> Recharger le crédit</button>
          <button className="btn btn-primary" onClick={onCreate}>
            <Icon name="plus" size={14}/> Nouvelle campagne
          </button>
        </div>
      </div>
    </div>
  );
}

function Overview({ onCreate }) {
  const [data, setData] = React.useState(null);
  // Popup d'explication du ROI (déclenché par l'icône "i" dans la carte
  // ROI). Boolean simple, fermé par défaut.
  const [roiInfoOpen, setRoiInfoOpen] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchProOverview().then(j => { if (!cancelled) setData(j); });
    refresh();
    const onChange = () => { invalidateProOverview(); refresh(); };
    window.addEventListener('pro:overview-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('pro:overview-changed', onChange); };
  }, []);
  // Fermeture sur Escape — UX standard pour les modales.
  React.useEffect(() => {
    if (!roiInfoOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setRoiInfoOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roiInfoOpen]);
  const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
  const k1 = data?.contactsAccepted30d ?? 0;
  const k2 = (data?.acceptanceRate ?? 0) + '%';
  const k3 = fmt2((data?.avgCostCents ?? 0) / 100) + ' €';
  // ROI 30j calculé côté serveur — (gains_potentiels − coût) / coût × 100.
  // pct = null ⇒ dépense nulle ⇒ on n'affiche rien de chiffré ("—").
  const roiPct = data?.roi?.pct ?? null;
  const roiDisplay = roiPct === null
    ? '—'
    : (roiPct > 0 ? '+' : '') + roiPct + ' %';
  const roiConvPct = data?.roi?.assumedConversionPct ?? 10;
  const roiValueEur = (data?.roi?.assumedValuePerClientCents ?? 10_000) / 100;
  const roiSpentEur = (data?.roi?.spentCents ?? 0) / 100;
  const roiPotentialEur = (data?.roi?.potentialRevenueCents ?? 0) / 100;
  const roiTooltip = roiPct === null
    ? "Aucune dépense sur les 30 derniers jours — le ROI sera calculé dès la première acceptation."
    : `Hypothèses : ${roiConvPct} % des contacts deviennent clients (estimation moyenne), valeur d'un client estimée à ${fmt2(roiValueEur)} €.\n`
      + `Gains potentiels 30j : ${fmt2(roiPotentialEur)} €.\n`
      + `Dépense réelle 30j : ${fmt2(roiSpentEur)} €.\n`
      + `ROI = (gains − dépense) / dépense × 100.`;
  const last = data?.lastAcceptances || [];
  const tiers = data?.tierBreakdown || [];

  return (
    <div className="col gap-6">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Contacts acceptés (30j)', String(k1), '', 'trend', null],
          ["Taux d'acceptation", k2, '', 'check', null],
          ['Coût moyen / contact', k3, '', 'money', null],
          ['ROI estimé', roiDisplay, '', 'sparkle', roiTooltip],
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 20, position: 'relative' }} title={k[4] || undefined}>
            <div className="row between center" style={{ marginBottom: 14 }}>
              <div className="row center gap-1" style={{ minWidth: 0 }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>{k[0]}</div>
                {/* Icône "info" cliquable uniquement sur la carte ROI —
                    ouvre une modale qui explique simplement la formule. */}
                {i === 3 && (
                  <button
                    type="button"
                    aria-label="Comment ce ROI est-il calculé ?"
                    title="Comment ce ROI est-il calculé ?"
                    onClick={() => setRoiInfoOpen(true)}
                    style={{
                      padding: 0, width: 16, height: 16, borderRadius: 999,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 0,
                      color: 'var(--ink-4)', cursor: 'pointer', lineHeight: 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="11" x2="12" y2="16"/>
                      <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
                    </svg>
                  </button>
                )}
              </div>
              <span style={{ color: 'var(--accent)' }}><Icon name={k[3]} size={14}/></span>
            </div>
            <div
              className="serif tnum"
              style={{
                fontSize: 36,
                color: i === 3 && roiPct !== null
                  ? (roiPct >= 0 ? 'var(--good)' : 'var(--danger)')
                  : undefined,
              }}>
              {k[1]}
            </div>
            {k[2] && <div className="mono" style={{ fontSize: 12, color: 'var(--good)', marginTop: 4 }}>{k[2]} vs mois dernier</div>}
            {i === 3 && roiPct !== null && (
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 6, lineHeight: 1.45 }}>
                base&nbsp;: {roiConvPct}&nbsp;% conversion × {fmt2(roiValueEur)}&nbsp;€/client
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <PerformanceCard/>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition par palier</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Coût et volume cumulés depuis l'ouverture</div>
          {tiers.every(t => t.contacts === 0) && (
            <div className="muted" style={{ fontSize: 13 }}>Aucun contact accepté pour le moment.</div>
          )}
          {!tiers.every(t => t.contacts === 0) && tiers.map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < tiers.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r.tier}</span> {r.label}</span>
                <span className="mono tnum" style={{ fontSize: 12 }}>{r.contacts} contacts · {fmt2(r.totalCents/100)} €</span>
              </div>
              <Progress value={Math.min(1, r.contacts / 40)}/>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 20 }}>
          <div className="serif" style={{ fontSize: 22 }}>Dernières acceptations</div>
          <button className="btn btn-ghost btn-sm btn-voir-tout">Voir tout <Icon name="arrow" size={12}/></button>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Prospect</th><th>Campagne</th><th>Palier</th><th>BUUPP Score</th><th>Reçu</th><th style={{textAlign:'right'}}>Coût</th></tr></thead>
            <tbody>
              {last.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '28px 12px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Aucune acceptation pour le moment.</span>
                </td></tr>
              )}
              {last.map((r, i) => (
                <tr key={i}>
                  <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                  <td>{r.campaign}</td>
                  <td><span className="chip">Palier {r.tier}</span></td>
                  <td><span className="mono tnum">{r.score}</span></td>
                  <td className="muted mono">{formatRelativeFr(r.receivedAt)}</td>
                  <td className="mono tnum" style={{ textAlign: 'right' }}>−{fmt2(r.costCents/100)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {roiInfoOpen && (
        <RoiInfoModal
          roiPct={roiPct}
          conversionPct={roiConvPct}
          valueEur={roiValueEur}
          spentEur={roiSpentEur}
          potentialEur={roiPotentialEur}
          acceptedCount={k1}
          fmt2={fmt2}
          onClose={() => setRoiInfoOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── RoiInfoModal — explication simple de la formule ROI ──────────
   Ouverte par l'icône "i" de la carte ROI estimé. Contenu pédagogique :
   formule en langage clair, exemple appliqué aux chiffres réels du pro,
   et avertissement honnête sur les hypothèses. */
function RoiInfoModal({ roiPct, conversionPct, valueEur, spentEur, potentialEur, acceptedCount, fmt2, onClose }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roi-info-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(15, 22, 41, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '40px 20px 60px',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper)', borderRadius: 16, padding: 28,
          maxWidth: 480, width: '100%',
          boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
          margin: 'auto 0',
        }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <div id="roi-info-title" className="serif" style={{ fontSize: 22, lineHeight: 1.25 }}>
            Comment on calcule votre ROI ?
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{
              background: 'transparent', border: 0, color: 'var(--ink-4)',
              fontSize: 20, lineHeight: 1, padding: 4, cursor: 'pointer',
            }}>✕</button>
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
          Une estimation honnête de la rentabilité de vos campagnes BUUPP sur les 30 derniers jours.
        </div>

        {/* Étape 1 — la formule en mots simples */}
        <div style={{
          padding: '14px 16px', borderRadius: 10, marginBottom: 14,
          background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
          border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--line))',
        }}>
          <div className="mono caps" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '.14em', marginBottom: 8 }}>
            La formule en clair
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            <strong>ROI</strong> = (ce que les contacts pourraient vous rapporter <strong>−</strong> ce que vous avez dépensé) <strong>÷</strong> ce que vous avez dépensé.
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
            Le résultat est exprimé en pourcentage. <strong>+100&nbsp;%</strong> veut dire que vous gagnez le double de ce que vous avez investi.
          </div>
        </div>

        {/* Étape 2 — les hypothèses */}
        <div style={{ marginBottom: 14 }}>
          <div className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.14em', marginBottom: 8 }}>
            Nos deux hypothèses
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
            <li>
              <strong>{conversionPct}&nbsp;%</strong> des contacts acceptés deviennent vraiment clients
              <span className="muted"> — moyenne tous secteurs confondus.</span>
            </li>
            <li>
              Un client vous rapporte en moyenne <strong>{fmt2(valueEur)}&nbsp;€</strong>
              <span className="muted"> — panier moyen générique.</span>
            </li>
          </ul>
        </div>

        {/* Étape 3 — application sur les chiffres du pro */}
        <div style={{
          padding: '14px 16px', borderRadius: 10, marginBottom: 14,
          background: 'var(--ivory)', border: '1px solid var(--line)',
        }}>
          <div className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.14em', marginBottom: 10 }}>
            Appliqué à vos chiffres (30 derniers jours)
          </div>
          {acceptedCount === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Vous n'avez pas encore d'acceptation sur les 30 derniers jours — le ROI sera affiché dès la première.
            </div>
          ) : (
            <table cellPadding="0" cellSpacing="0" style={{ width: '100%', fontSize: 13.5, lineHeight: 1.7 }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--ink-4)', padding: '2px 0' }}>Contacts acceptés</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{acceptedCount}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--ink-4)', padding: '2px 0' }}>Gains potentiels estimés</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {acceptedCount} × {conversionPct}&nbsp;% × {fmt2(valueEur)}&nbsp;€ = <strong>{fmt2(potentialEur)}&nbsp;€</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--ink-4)', padding: '2px 0' }}>Dépense réelle</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt2(spentEur)}&nbsp;€</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ borderTop: '1px dashed var(--line)', paddingTop: 8, marginTop: 4 }}>
                    <div className="row between center">
                      <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>ROI</span>
                      <span className="serif tnum" style={{
                        fontSize: 22,
                        color: roiPct === null
                          ? 'var(--ink-4)'
                          : roiPct >= 0 ? 'var(--good)' : 'var(--danger)',
                      }}>
                        {roiPct === null ? '—' : (roiPct > 0 ? '+' : '') + roiPct + ' %'}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Étape 4 — honnêteté */}
        <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.55, marginBottom: 18 }}>
          <strong style={{ color: 'var(--ink-3)' }}>À garder en tête :</strong> c'est une estimation. Si votre secteur convertit plus que la moyenne (services premium, immobilier…), votre ROI réel sera meilleur. À l'inverse en e-commerce, il sera plus faible. Bientôt vous pourrez personnaliser ces deux hypothèses dans vos paramètres.
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary btn-sm">
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

function BarChart({ buckets }) {
  const data = (buckets || []).map(b => Number(b.count) || 0);
  const labels = (buckets || []).map(b => b.label);
  const rawMax = Math.max(...data, 1);
  // Round up to a nice grid value.
  const step = rawMax <= 4 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : 10;
  const max = Math.ceil(rawMax / step) * step;
  const gridLines = [];
  for (let v = step; v <= max; v += step) gridLines.push(v);
  const H = 180, W = 560, P = 16;
  const bw = data.length > 0 ? (W - 2*P) / data.length : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H+28}`} style={{ width: '100%', height: 210 }}>
      {gridLines.map(v => {
        const y = P + (1 - v/max) * (H - 2*P);
        return <g key={v}><line x1={P} x2={W-P} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+2} y={y+3} fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{v}</text></g>;
      })}
      {data.map((v, i) => {
        const h = (v / max) * (H - 2*P);
        const x = P + i * bw + 4;
        const y = H - P - h;
        return <g key={i}>
          <rect x={x} y={y} width={Math.max(0, bw - 8)} height={Math.max(0, h)} fill={i === data.length - 1 ? 'var(--accent)' : 'var(--ink-2)'} rx="2"/>
          <text x={x + (bw-8)/2} y={H+4} textAnchor="middle" fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{labels[i]}</text>
        </g>;
      })}
    </svg>
  );
}

const RANGE_LABELS = { '7d': '7 derniers jours', '30d': '30 derniers jours', '90d': '90 derniers jours' };

function PerformanceCard() {
  const [range, setRange] = React.useState('30d');
  const [series, setSeries] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setSeries(null);
    fetch(`/api/pro/timeseries?range=${range}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setSeries(j); })
      .catch(() => { if (!cancelled) setSeries(null); });
    return () => { cancelled = true; };
  }, [range]);
  const buckets = series?.buckets || [];
  const totalCount = buckets.reduce((acc, b) => acc + (Number(b.count) || 0), 0);
  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <div className="serif" style={{ fontSize: 22 }}>Performance des campagnes</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Contacts obtenus, {RANGE_LABELS[range]}
            {series && ` · ${totalCount} acceptation${totalCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="row gap-2">
          {[['7d', '7J'], ['30d', '30J'], ['90d', '90J']].map(([k, l]) => {
            const active = range === k;
            return (
              <button key={k} onClick={() => setRange(k)} className="chip" style={{
                cursor: 'pointer',
                background: active ? 'var(--ink)' : 'var(--ivory-2)',
                color: active ? 'var(--paper)' : 'var(--ink-3)',
                border: 0,
              }}>{l}</button>
            );
          })}
        </div>
      </div>
      {series === null ? (
        <div className="muted" style={{ fontSize: 13, padding: 32, textAlign: 'center' }}>Chargement…</div>
      ) : (
        <BarChart buckets={buckets}/>
      )}
    </div>
  );
}

function CampaignDurationBanner({ compact }) {
  return (
    <div className="alert-block" style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: compact ? '12px 16px' : '14px 18px',
      background: 'color-mix(in oklab, var(--accent) 7%, var(--paper))',
      border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--line))',
      borderRadius: 10,
    }}>
      <div style={{
        width: 28, height: 28, minWidth: 28, borderRadius: '50%',
        background: 'var(--accent)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <Icon name="clock" size={14} stroke={2.25}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
          Prolongation de la durée d'une campagne
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
          Chaque campagne peut être prolongée <strong style={{ color: 'var(--ink)' }}>une seule fois</strong> moyennant{' '}
          <strong style={{ color: 'var(--ink)' }}>10 € HT</strong>. La <strong style={{ color: 'var(--ink)' }}>durée de prolongation est identique à la durée initiale</strong> :
          {' '}1 h flash deal → 1 h supplémentaire, 24 h → 24 h, 48 h → 48 h, 7 jours → 7 jours.
          {' '}Décision à prendre depuis la fiche campagne avant expiration.
        </div>
      </div>
    </div>
  );
}

function Campagnes({ onCreate, onDetail, onDuplicate }) {
  const [filter, setFilter] = useState('all');
  const [camps, setCamps] = useState(null); // null = loading
  const [reloadKey, setReloadKey] = useState(0);
  // Modale d'info pause 48h (s'ouvre quand le pro clique sur "Pause"
  // pour une campagne 7d éligible). On stocke la campagne ciblée pour
  // la confirmation ; null = modale fermée.
  const [pausePromptCamp, setPausePromptCamp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCamps(null);
    fetch('/api/pro/campaigns', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(j => { if (!cancelled) setCamps(j.campaigns || []); })
      .catch(() => { if (!cancelled) setCamps([]); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const togglePauseStatus = async (campId, nextStatus) => {
    try {
      const r = await fetch(`/api/pro/campaigns/${campId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Échec : " + (j?.error || r.status));
        return false;
      }
      try { window.dispatchEvent(new Event('pro:overview-changed')); } catch {}
      setReloadKey(k => k + 1);
      return true;
    } catch (e) {
      alert("Erreur réseau : " + (e.message || ''));
      return false;
    }
  };

  const ALL = camps || [];
  // Bucket "done" regroupe completed + canceled (les deux sont terminales).
  const isDone = (s) => s === 'completed' || s === 'canceled';
  const counts = {
    all: ALL.length,
    active: ALL.filter(c => c.status === 'active').length,
    paused: ALL.filter(c => c.status === 'paused').length,
    done: ALL.filter(c => isDone(c.status)).length,
  };
  const filtered = ALL.filter(c =>
    filter === 'all' ||
    (filter === 'done' ? isDone(c.status) : c.status === filter)
  );
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Campagnes" title="Vos initiatives en cours" action={
        <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={14}/> Nouvelle campagne</button>
      }/>
      <CampaignDurationBanner/>
      <div className="row gap-2">
        {[
          ['all', `Toutes (${counts.all})`],
          ['active', `Actives (${counts.active})`],
          ['paused', `En pause (${counts.paused})`],
          ['done', `Terminées (${counts.done})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="chip" style={{
            cursor: 'pointer', padding: '6px 12px', fontSize: 12,
            background: filter === k ? 'var(--ink)' : 'var(--paper)',
            color: filter === k ? 'var(--paper)' : 'var(--ink-3)',
            borderColor: filter === k ? 'var(--ink)' : 'var(--line-2)'
          }}>{l}</button>
        ))}
      </div>
      <div className="col gap-3">
        {camps === null && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
          </div>
        )}
        {camps !== null && camps.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Aucune campagne pour le moment.
            </div>
            <button className="btn btn-primary btn-sm" onClick={onCreate}>
              <Icon name="plus" size={12}/> Créer votre première campagne
            </button>
          </div>
        )}
        {camps !== null && camps.length > 0 && filtered.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Aucune campagne ne correspond à ce filtre.</div>
          </div>
        )}
        {filtered.map((c) => {
          const statusLabel = c.status === 'active' ? 'Active' : c.status === 'paused' ? 'En pause' : 'Terminée';
          const statusChip = c.status === 'active' ? 'chip-good' : c.status === 'paused' ? 'chip-warn' : '';
          const dateStr = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(c.createdAt));
          const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
          const isActive = c.status === 'active';
          const isPaused = c.status === 'paused';
          // Le bouton "Pause" n'est offert qu'aux campagnes 7d qui n'ont
          // jamais été mises en pause (`pauseEligible`). Pour toutes les
          // autres campagnes actives, on n'affiche tout simplement pas
          // le bouton (cf. `showPauseAction`). Le bouton "Relancer" est
          // toujours visible sur une campagne en pause.
          const showPauseAction = isActive && c.pauseEligible;
          const showResumeAction = isPaused;
          return (
            <div key={c.id} className="card" style={{ padding: 24 }}>
              <div className="row between" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="row center gap-3" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                    <div className="serif" style={{ fontSize: 22 }}>{c.name}</div>
                    <span className={'chip ' + statusChip}>{statusLabel}</span>
                    {c.authCode && (
                      <span
                        title="À fournir obligatoirement au prospect lors de la prise de contact pour authentifier le service BUUPP."
                        className="row center gap-2"
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'color-mix(in oklab, #B45309 10%, var(--paper))',
                          border: '1px solid color-mix(in oklab, #B45309 35%, var(--line))',
                          color: '#B45309',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'help',
                          letterSpacing: '.04em',
                        }}
                      >
                        <Icon name="lock" size={11}/>
                        <span className="caps" style={{ fontSize: 10, opacity: .85, letterSpacing: '.06em' }}>Code BUUPP</span>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.12em' }}>{c.authCode}</span>
                      </span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {c.objectiveLabel} · créée le {dateStr} · coût unitaire moyen {fmt2(c.avgCostEur)} €
                  </div>
                  <div className="row gap-6" style={{ marginTop: 16, flexWrap: 'wrap' }}>
                    {(() => {
                      // Budget consommé = budget effectif (campagne + 10 % de
                      // commission BUUPP) — le wallet est débité de l'intégralité.
                      const budgetTotal = c.budgetEur * 1.10;
                      const spentTotal = c.spentEur * 1.10;
                      const ratio = budgetTotal > 0 ? spentTotal / budgetTotal : 0;
                      return (
                        <>
                          <div title="Budget campagne + 10 % commission BUUPP — la commission n'est facturée qu'à l'acceptation d'un prospect">
                            <div className="muted mono caps" style={{ fontSize: 10 }}>Budget</div>
                            <div className="serif tnum" style={{ fontSize: 20 }}>{fmt2(spentTotal)} / {fmt2(budgetTotal)} €</div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>commission acquise sur acceptations</div>
                          </div>
                          <div title="Prospects notifiés au lancement de la campagne">
                            <div className="muted mono caps" style={{ fontSize: 10 }}>Touchés</div>
                            <div className="serif tnum" style={{ fontSize: 20 }}>{Number(c.reachedCount ?? 0)}</div>
                          </div>
                          <div title="Prospects ayant accepté la sollicitation"><div className="muted mono caps" style={{ fontSize: 10 }}>Contacts</div><div className="serif tnum" style={{ fontSize: 20 }}>{c.contactsCount}</div></div>
                          <div style={{ flex: 1, minWidth: 180, alignSelf: 'flex-end' }}>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6 }}>Budget consommé (commission incluse)</div>
                            <Progress value={ratio}/>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="row gap-2">
                  {showPauseAction && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPausePromptCamp(c)}
                      title="Mettre la campagne en pause 48 h (une seule fois)"
                    >
                      <Icon name="pause" size={12}/> Pause
                    </button>
                  )}
                  {showResumeAction && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => togglePauseStatus(c.id, 'active')}
                      title="Reprendre la campagne maintenant — le temps restant est préservé"
                    >
                      <Icon name="play" size={12}/> Relancer
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onDuplicate?.(c.id)}
                    title="Relancer la même campagne avec les mêmes paramètres"
                  >
                    <Icon name="copy" size={12}/> Dupliquer
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDetail(c)}>Détails <Icon name="arrow" size={12}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {pausePromptCamp && (
        <PauseCampaignModal
          camp={pausePromptCamp}
          onCancel={() => setPausePromptCamp(null)}
          onConfirm={async () => {
            const ok = await togglePauseStatus(pausePromptCamp.id, 'paused');
            setPausePromptCamp(null);
            if (!ok) return;
          }}
        />
      )}
    </div>
  );
}

/* Modale d'information affichée quand le pro clique sur "Pause" pour
   une campagne 7d. Explique :
     - durée fixe de 48 h, reprise automatique à l'expiration
     - bouton "Relancer" pour reprendre avant les 48 h (= temps restant
       préservé)
     - une seule pause par campagne (action irréversible)
     - les rémunérations déjà acceptées et la commission BUUPP
       correspondante restent acquises */
function PauseCampaignModal({ camp, onCancel, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);
  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div role="dialog" aria-modal="true" className="pause-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 220,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 16px 80px',
    }}>
      <div className="pause-modal-card" style={{
        position: 'relative', maxWidth: 520, width: '100%',
        background: 'var(--paper)', borderRadius: 18,
        padding: 'clamp(20px, 4vw, 32px)',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0', borderTop: '4px solid var(--accent)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--line))',
            color: 'var(--accent)', fontSize: 30, lineHeight: 1,
          }}>☕</div>
          <div className="serif" style={{ fontSize: 'clamp(20px, 3vw, 24px)', lineHeight: 1.2, marginBottom: 6 }}>
            Pause café · 48 h chrono
          </div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, maxWidth: 440, margin: '0 auto' }}>
            Votre campagne <strong style={{ color: 'var(--ink)' }}>{camp?.name}</strong> s'octroie un mini week-end aux Bahamas.
            Pendant ce temps, elle bronze, vous respirez.
          </div>
        </div>

        {camp?.durationKey === '1h' && (
          <div className="row" style={{
            marginBottom: 14, gap: 10, padding: '10px 12px', borderRadius: 10,
            background: 'color-mix(in oklab, #B91C1C 8%, var(--paper))',
            border: '1px solid color-mix(in oklab, #B91C1C 25%, var(--line))',
            color: '#7F1D1D', fontSize: 12.5, lineHeight: 1.5, alignItems: 'flex-start',
          }} role="alert">
            <span aria-hidden="true" style={{ fontSize: 14, flexShrink: 0 }}>📢</span>
            <span>
              <strong>Spécifique flash deal :</strong> votre annonce <strong>cesse immédiatement d'apparaître sur la page d'accueil</strong> pendant la pause.
              Elle réapparaîtra dès la reprise (manuelle ou automatique à 48 h), pour le temps restant.
            </span>
          </div>
        )}

        <ul style={{
          listStyle: 'none', padding: 0, margin: '0 0 18px',
          background: 'var(--ivory-2)', border: '1px solid var(--line)', borderRadius: 12,
          fontSize: 13, lineHeight: 1.55,
        }}>
          {[
            ['🛑', <>Plus aucun prospect <strong>n'est sollicité</strong> pendant les 48 h.</>],
            ['💰', <>Les acceptations <strong>déjà obtenues sont acquises</strong> — récompenses prospects + commission BUUPP <strong>restent dues</strong>.</>],
            ['⏱️', <>À l'issue des 48 h, la campagne <strong>reprend automatiquement</strong>. Le temps restant au moment de la pause est <strong>intégralement préservé</strong>.</>],
            ['▶️', <>Vous pouvez relancer manuellement <strong>avant 48 h</strong> via le bouton <em>Relancer</em>. Le temps restant reste préservé dans tous les cas.</>],
            ['⚠️', <>Une campagne <strong>ne peut être mise en pause qu'une seule fois</strong>. On ne rejoue pas la sieste.</>],
          ].map(([icon, text], i, arr) => (
            <li key={i} className="row" style={{
              gap: 12, padding: '10px 14px', alignItems: 'flex-start',
              borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
              <span style={{ color: 'var(--ink-2)' }}>{text}</span>
            </li>
          ))}
        </ul>

        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={submitting}
            style={{ flex: 1, minWidth: 120 }}
          >
            Finalement non
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
            style={{ flex: 2, minWidth: 200 }}
          >
            {submitting ? 'Pause en cours…' : <>Mettre en pause 48 h <Icon name="pause" size={12}/></>}
          </button>
        </div>

        <style>{`
          @media (max-width: 540px) {
            .pause-modal-overlay { align-items: stretch !important; padding: 0 !important; }
            .pause-modal-card { border-radius: 0 !important; min-height: 100vh; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* 6-step wizard — objectif, données, ciblage, budget, mots-clés, récap */
// allowedTiers : paliers accessibles selon le principe de minimisation RGPD.
// Données strictement nécessaires à la finalité de la campagne.
const OBJECTIVES = [
  { id:'contact', name:'Prise de contact direct', desc:'8 opérations — email, SMS, push, appel, WhatsApp', icon:'email', allowedTiers:[1], sub:[
    {id:'email',     name:'Email marketing',         desc:'Newsletter, campagne promotionnelle, séquence de bienvenue',   cost:0.15},
    {id:'sms',       name:'SMS marketing',           desc:'Message promotionnel, alerte offre, rappel personnalisé',      cost:0.20},
    {id:'mms',       name:'MMS marketing',           desc:'Message multimédia avec image ou vidéo courte',                cost:0.25},
    {id:'postal',    name:'Mailing postal',          desc:'Courrier physique personnalisé, catalogue, carte postale',     cost:0.80},
    {id:'phone',     name:'Phoning / Cold calling',  desc:'Appel téléphonique de prospection sortante',                   cost:0.50},
    {id:'wa',        name:'WhatsApp Business',       desc:'Message direct via canal messaging instantané',                cost:0.25},
    {id:'pushweb',   name:'Push notification web',   desc:'Notification navigateur envoyée à un abonné consentant',       cost:0.10},
    {id:'pushapp',   name:'Push notification app',   desc:'Notification mobile sur application installée',                cost:0.10},
  ]},
  { id:'rdv', name:'Prise de rendez-vous', desc:'6 opérations — physique, visio, devis, essai', icon:'calendar', allowedTiers:[1], sub:[
    {id:'rdvphys',   name:'RDV physique commercial', desc:'Rencontre en face-à-face chez le prospect ou en agence',       cost:2.00},
    {id:'rdvtel',    name:'RDV téléphonique',        desc:'Appel qualifié planifié avec un conseiller ou commercial',     cost:1.00},
    {id:'rdvvisio',  name:'RDV visioconférence',     desc:'Réunion en ligne via Teams, Zoom ou Google Meet',              cost:0.80},
    {id:'consult',   name:'Consultation gratuite',   desc:'Bilan offert en échange de coordonnées (coach, kiné…)',        cost:1.50},
    {id:'devis',     name:'Devis à domicile',        desc:'Visite technique pour établir un chiffrage (BTP, énergie)',    cost:3.00},
    {id:'essai',     name:'Essai produit planifié',  desc:'Test drive, essai cuisine, démo logiciel avec commercial',     cost:2.50},
  ]},
  { id:'evt', name:'Événementiel & inscription', desc:'8 opérations — webinar, atelier, conférence', icon:'flag', allowedTiers:[1,2,3,4,5], sub:[
    {id:'webinar',   name:'Webinar / conférence web',desc:'Événement en ligne éducatif ou commercial',                    cost:1.00},
    {id:'portes',    name:'Portes ouvertes',         desc:'Visite libre des locaux, découverte de l\u2019offre',                 cost:1.20},
    {id:'atelier',   name:'Atelier / workshop',      desc:'Événement pratique en petit groupe, en présentiel',            cost:2.00},
    {id:'conf',      name:'Conférence / intervention', desc:'Prise de parole d\u2019expert devant un public cible',                cost:1.50},
    {id:'network',   name:'Soirée client / networking', desc:'Événement de fidélisation ou prospection en soirée',                cost:2.00},
    {id:'demo',      name:'Démo produit collective', desc:'Présentation d\u2019un produit à un groupe d\u2019invités',                  cost:1.50},
    {id:'launch',    name:'Lancement produit',       desc:'Événement dédié à la révélation d\u2019une nouveauté',                cost:2.50},
    {id:'tournoi',   name:'Tournoi / challenge',     desc:'Compétition sponsorisée autour d\u2019un thème produit',              cost:1.20},
  ]},
  { id:'dl', name:'Contenus à télécharger', desc:'9 opérations — livre blanc, guide, étude', icon:'download', allowedTiers:[1], sub:[
    {id:'wb',        name:'Livre blanc',             desc:'Guide expert sur un sujet thématique avec valeur perçue élevée',cost:1.00},
    {id:'etude',     name:'Étude de cas',            desc:'Résultat client concret présenté sous forme narrative',        cost:1.20},
    {id:'cat',       name:'Fiche produit / catalogue', desc:'Descriptif commercial téléchargeable',                        cost:0.50},
    {id:'guide',     name:'Guide pratique',          desc:'Tutoriel ou aide à la décision pour le prospect',              cost:0.80},
    {id:'info',      name:'Infographie',             desc:'Contenu visuel résumant un sujet ou une statistique',          cost:0.60},
    {id:'rapport',   name:'Rapport / baromètre',     desc:'Étude de marché annuelle ou sectorielle',                      cost:1.50},
    {id:'tpl',       name:'Template / modèle',       desc:'Outil prêt à l\u2019emploi offert en échange d\u2019un email',              cost:0.60},
    {id:'check',     name:'Checklist',               desc:'Liste de contrôle pratique téléchargeable',                    cost:0.40},
    {id:'replay',    name:'Replay vidéo',            desc:'Enregistrement d\u2019un webinar ou conférence passée',               cost:0.80},
  ]},
  { id:'survey', name:'Études & collecte d\u2019avis', desc:'8 opérations — NPS, sondage, focus group', icon:'check', allowedTiers:[1,2,3,4,5], sub:[
    {id:'csat',      name:'Enquête satisfaction (CSAT)', desc:'Score de satisfaction sur une expérience récente',          cost:0.80},
    {id:'nps',       name:'Net Promoter Score (NPS)',    desc:'Mesure de la propension à recommander la marque',           cost:0.80},
    {id:'poll',      name:'Sondage d\u2019opinion',         desc:'Questionnaire sur un sujet marché ou produit',              cost:0.50},
    {id:'panel',     name:'Étude de marché panel',     desc:'Questionnaire rémunéré auprès d\u2019un panel ciblé',                cost:1.50},
    {id:'test',      name:'Test produit utilisateur',  desc:'Envoi d\u2019un produit en échange d\u2019un avis détaillé',                cost:2.00},
    {id:'focus',     name:'Groupe focus (focus group)',desc:'Réunion qualitative avec 6 à 12 participants',                 cost:3.00},
    {id:'interview', name:'Interview client',          desc:'Entretien individuel approfondi sur un besoin',                cost:2.50},
    {id:'vote',      name:'Vote / élection produit',   desc:'Participation à un choix (packaging, nom, design)',            cost:0.60},
  ]},
  { id:'promo', name:'Promotions & fidélisation', desc:'4 opérations — coupon, flash, concours', icon:'bolt', allowedTiers:[1,2,3,4,5], sub:[
    {id:'coupon',    name:'Offre de réduction ciblée', desc:'Coupon, code promo ou remise envoyé à un segment',            cost:0.30},
    {id:'welcome',   name:'Offre de bienvenue',        desc:'Avantage exclusif à la première commande ou inscription',     cost:0.60},
    {id:'flash',     name:'Vente flash',               desc:'Promotion à durée limitée pour créer l\u2019urgence',                cost:0.50},
    {id:'contest',   name:'Concours / jeu-concours',   desc:'Animation avec gain à la clé pour créer de l\u2019engagement',       cost:0.80},
  ]},
  { id:'addigital', name:'Publicité digitale', desc:'Adresses réseaux sociaux pour ciblage publicitaire', icon:'bolt', allowedTiers:[1,2,3,4,5], sub:[
    {id:'meta',      name:'Audience Meta (Facebook / Instagram)', desc:'Liste d\u2019emails / téléphones hashés pour ciblage publicitaire', cost:0.20},
    {id:'google',    name:'Google Customer Match',     desc:'Audience pour Google Ads, YouTube, Discovery',                cost:0.20},
    {id:'tiktok',    name:'TikTok Ads — Custom Audience', desc:'Liste pour ciblage publicitaire TikTok Ads',               cost:0.20},
    {id:'linkedin',  name:'LinkedIn Matched Audiences',desc:'Audience B2B pour LinkedIn Ads',                              cost:0.30},
    {id:'snap',      name:'Snapchat Ads',              desc:'Audience pour ciblage publicitaire Snap',                     cost:0.20},
    {id:'x',         name:'X (Twitter) Ads',           desc:'Liste pour ciblage publicitaire sur X',                       cost:0.20},
  ]},
];

const TIERS_DATA = [
  {id:1, name:'Identification',            sub:'Email, nom, téléphone, date de naissance',        min:1.00, max:1.00,  pct:20},
  {id:2, name:'Localisation',              sub:'Adresse postale, logement, mobilité',             min:1.00, max:2.00,  pct:40},
  {id:3, name:'Style de vie',              sub:'Habitudes, famille, véhicule, sport',             min:2.00, max:3.50,  pct:58},
  {id:4, name:'Données professionnelles',  sub:'Poste, revenus, statut, secteur',                 min:3.50, max:5.00,  pct:78},
  {id:5, name:'Patrimoine & projets',      sub:'Immobilier, épargne, succession, création',       min:5.00, max:10.00, pct:100},
];

const GEO_ZONES = [
  {id:'ville',    name:'Ville',       sub:'Rayon 20 km'},
  {id:'dept',     name:'Département', sub:'Rayon 50 km'},
  {id:'region',   name:'Région',      sub:'Rayon 150 km'},
  {id:'national', name:'National',    sub:'Toute la France'},
];

const AGE_RANGES = ['18–25','26–35','36–45','46–55','56–65','65+','Tous'];

// Paliers alignés sur la page Prospect → onglet "Paliers de vérification" :
// Basique (création de compte) → Vérifié (RIB validé) → Certifié confiance
// (rendez-vous physique accepté). Les ids restent `p0/p1/p2` pour rester
// rétro-compatibles avec les campagnes déjà persistées.
const VERIF_LEVELS = [
  {id:'p0', name:'Basique',            sub:'Compte créé — email vérifié',                                  mult:1},
  {id:'p1', name:'Vérifié',            sub:'Numéro de téléphone vérifié par SMS',                         mult:1.5},
  {id:'p2', name:'Certifié confiance', sub:'Rendez-vous physique accepté — Gains prospects doublés', mult:2, badge:'×2'},
];

const KW_SUGGESTIONS = ['véhicule','immobilier','retraite','sport','artisan','nutrition','coaching','BTP','épargne','assurance','crédit','jardinage','animaux','voyages','informatique'];

// 8 étapes : Objectif → Dates → Données → Ciblage → Budget → Mots-clés → Description → Récap.
// "Dates" et "Description" sont les deux étapes ajoutées récemment.
const WIZ_STEPS = ['Objectif','Dates','Données','Ciblage','Budget','Mots-clés','Description','Récap'];
const WIZ_TOTAL = WIZ_STEPS.length;
const WIZ_STEP_RECAP = WIZ_TOTAL; // dernière étape

const BRIEF_MAX_LENGTH = 50;
const BRIEF_PLACEHOLDER = "Ex : offre de remise de 10% les 10 premiers clients du jour…";

// Pré-remplissage des dates : démarrage demain, fin par défaut +7 jours.
const todayIso = () => new Date().toISOString().slice(0, 10);
const isoPlusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const fmtEur = (v) => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(v);

const fmtDateLong = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(d);
};

/* Popup de sélection de plan affichée à l'ouverture du wizard de
   création de campagne. Le plan choisi (Starter / Pro) est persisté
   dans `pro_accounts.plan` via /api/pro/plan et démarre un nouveau
   cycle de quotas (Starter = 2 campagnes, Pro = 10). La popup
   réapparaît automatiquement quand le quota du cycle en cours est
   atteint, pour inviter le pro à choisir / renouveler son mode. */
/* Les prix et caps des plans sont injectés dynamiquement depuis
   /api/pro/plan (qui lit `plan_pricing` en base). On garde ici les
   éléments statiques (features, couleur, badge) qui ne dépendent pas
   du tarif. */
const PLAN_DEFS_STATIC = [
  {
    id: 'starter',
    label: 'Starter',
    color: 'var(--ink)',
    features: [
      'Jusqu\'à 50 prospects par campagne',
      '2 campagnes par cycle',
      'Ciblage par paliers 1 à 3',
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    color: 'var(--accent)',
    badge: 'Recommandé',
    features: [
      'Jusqu\'à 500 prospects par campagne',
      '10 campagnes par cycle',
      'Tous les paliers 1 à 5',
      'Accès anticipé aux nouvelles fonctionnalités',
    ],
  },
];

function PlanSelectorModal({
  currentPlan,
  specs,
  onChoose,
  onClose,
  capReached = false,
  cycleCount = null,
  capPlan = null,
}) {
  const [selecting, setSelecting] = useState(null);
  const [error, setError] = useState(null);
  // Fusionne les éléments statiques (features, couleurs) avec les
  // valeurs dynamiques (prix, cap) lues depuis l'API pour rester
  // alignées avec ce qui sera prélevé en base.
  const planDefs = PLAN_DEFS_STATIC.map(p => {
    const s = specs?.[p.id] || {};
    const max = s.maxCampaigns ?? (p.id === 'pro' ? 10 : 2);
    return {
      ...p,
      monthly: s.monthlyEur != null
        ? Number(s.monthlyEur).toFixed(0).replace('.', ',') + ' €'
        : '—',
      maxProspects: s.maxProspects ?? null,
      maxCampaigns: max,
      priceSuffix: `€ / ${max} campagnes`,
    };
  });

  const choose = async (planId) => {
    setSelecting(planId);
    setError(null);
    try {
      const r = await fetch('/api/pro/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || 'Erreur');
      onChoose(planId);
    } catch (e) {
      setError(e.message || 'Impossible de mettre à jour le plan');
      setSelecting(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="plan-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 16px 80px',
    }}>
      <div className="plan-modal-card" style={{
        position: 'relative', maxWidth: 880, width: '100%',
        background: 'var(--paper)', borderRadius: 18,
        padding: 'clamp(20px, 4vw, 36px)',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0',
      }}>
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: 'absolute', top: 14, right: 14,
            padding: 6, color: 'var(--ink-4)', cursor: 'pointer',
            background: 'transparent', border: 'none',
          }}>
          <Icon name="close" size={18}/>
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="mono caps muted" style={{ fontSize: 11, letterSpacing: '.16em', marginBottom: 10 }}>
            {capReached ? '— Quota atteint' : '— Avant de lancer votre campagne'}
          </div>
          <div className="serif" style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1.2, marginBottom: 8 }}>
            {capReached ? 'Quota du cycle atteint' : 'Choisissez votre plan'}
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 560, margin: '0 auto' }}>
            {capReached
              ? `Vous avez consommé l'intégralité de votre cycle ${capPlan === 'pro' ? 'Pro (10 campagnes)' : 'Starter (2 campagnes)'}. Choisissez un mode pour lancer un nouveau cycle.`
              : 'Le mode sélectionné détermine le nombre de prospects par campagne et le nombre de campagnes incluses dans votre cycle. Vous pouvez changer à tout moment.'}
          </div>
        </div>

        <div className="plan-modal-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16,
        }}>
          {planDefs.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const isSubmitting = selecting === plan.id;
            // Les deux modes restent toujours sélectionnables : choisir un
            // mode (même le mode courant) démarre un nouveau cycle.
            const isLocked = false;
            return (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  position: 'relative',
                  padding: 'clamp(16px, 3vw, 22px)',
                  borderRadius: 14,
                  border: '1.5px solid ' + (isCurrent ? plan.color : 'var(--line-2)'),
                  background: isCurrent
                    ? `color-mix(in oklab, ${plan.color} 5%, var(--paper))`
                    : 'var(--paper)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  opacity: isLocked ? 0.55 : 1,
                }}>
                {plan.badge && !isLocked && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    padding: '3px 10px', borderRadius: 999,
                    background: plan.color, color: 'white',
                    fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '.1em',
                  }}>{plan.badge}</div>
                )}
                {isLocked && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'var(--ink-4)', color: 'white',
                    fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '.1em',
                  }}>Cap atteint</div>
                )}

                <div>
                  <div className="serif" style={{ fontSize: 24, color: plan.color, marginBottom: 4 }}>
                    {plan.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    <span className="serif tnum" style={{ fontSize: 22, color: 'var(--ink)' }}>{plan.monthly}</span>
                    <span className="muted"> {plan.priceSuffix.replace('€ ', '')}</span>
                  </div>
                </div>

                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--ivory-2)', fontSize: 13, lineHeight: 1.4,
                }}>
                  <span style={{ color: 'var(--ink-3)' }}>Cap par campagne : </span>
                  <strong>{plan.maxProspects} prospects</strong>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} className="row" style={{ gap: 8, fontSize: 13, lineHeight: 1.4, alignItems: 'flex-start' }}>
                      <span style={{ color: plan.color, flexShrink: 0, marginTop: 2 }}>
                        <Icon name="check" size={13} stroke={2.5}/>
                      </span>
                      <span style={{ color: 'var(--ink-2)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="btn"
                  onClick={() => choose(plan.id)}
                  disabled={isSubmitting}
                  style={{
                    marginTop: 'auto',
                    background: plan.id === 'pro' ? plan.color : 'var(--ink)',
                    color: 'white',
                    borderColor: 'transparent',
                    width: '100%',
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: 'pointer',
                  }}>
                  {isSubmitting
                    ? 'Activation…'
                    : capReached
                      ? `Démarrer un cycle ${plan.label}`
                      : isCurrent
                        ? `Continuer en ${plan.label}`
                        : `Choisir ${plan.label}`}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            marginTop: 18, padding: '10px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#991b1b', fontSize: 12.5,
          }}>
            {error}
          </div>
        )}

        <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 18 }}>
          Aucun engagement · Changement de plan possible à tout moment depuis l'onglet Facturation.
        </div>

        <style>{`
          @media (max-width: 720px) {
            .plan-modal-overlay { align-items: stretch !important; padding: 0 !important; }
            .plan-modal-card { border-radius: 0 !important; min-height: 100vh; max-width: none !important; }
            .plan-modal-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* Modale "Solde insuffisant" affichée à la validation finale d'une
   campagne quand wallet < (budget + frais plan). Pré-remplit le montant
   de recharge avec le manquant (arrondi au multiple de 50 supérieur).
   Sauvegarde le brouillon de campagne avant la redirection Stripe pour
   que le pro puisse reprendre où il en était au retour de paiement. */
function InsufficientBalanceModal({ details, onCancel, onTopup }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Arrondi au multiple de 50 € supérieur, plafonné à 10 000 €.
  const suggestedEur = Math.min(10000, Math.max(50, Math.ceil(details.missing / 50) * 50));
  const [amount, setAmount] = useState(suggestedEur);
  const fmt = v => Number(v || 0).toFixed(2).replace('.', ',');

  const goRecharge = async () => {
    if (amount < details.missing) { setError(`Montant insuffisant. Il vous manque ${fmt(details.missing)} €.`); return; }
    setSubmitting(true);
    setError(null);
    try {
      // 1) Sauve l'état du wizard pour reprise au retour Stripe.
      onTopup();
      // 2) Crée la session Stripe Checkout avec un flag de continuation
      //    qui sera lu par ProDashboard au retour pour ré-ouvrir le wizard.
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountCents: Math.round(amount * 100),
          continueCampaign: true,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.url) throw new Error(j?.message || j?.error || 'Erreur Stripe');
      try { window.top.location.href = j.url; } catch { window.location.href = j.url; }
    } catch (e) {
      setError(e.message || 'Erreur Stripe');
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="insuf-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 220,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 16px 80px',
    }}>
      <div className="insuf-modal-card" style={{
        position: 'relative', maxWidth: 540, width: '100%',
        background: 'var(--paper)', borderRadius: 18,
        padding: 'clamp(20px, 4vw, 32px)',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0', borderTop: '4px solid #f59e0b',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e',
            fontSize: 26, fontWeight: 700,
          }}>!</div>
          <div className="serif" style={{ fontSize: 'clamp(20px, 3vw, 24px)', lineHeight: 1.2, marginBottom: 6 }}>
            Solde insuffisant
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 440, margin: '0 auto' }}>
            Pour lancer cette campagne, votre solde doit couvrir le budget plus la commission BUUPP <strong>maximale</strong> (10 %) — celle-ci n'est facturée qu'aux acceptations effectives.
          </div>
        </div>

        <div style={{
          padding: 14, borderRadius: 10, background: 'var(--ivory-2)',
          border: '1px solid var(--line)', fontSize: 13, marginBottom: 14,
        }}>
          {[
            ['Solde actuel', fmt(details.balance) + ' €'],
            ['Budget de la campagne', fmt(details.campaignTotal) + ' €'],
            ['Commission BUUPP max. (10 %)', fmt(details.commission) + ' €'],
            ...(details.planFee > 0
              ? [[`Frais cycle ${details.planLabel || 'Starter'} (1ʳᵉ campagne)`, fmt(details.planFee) + ' €']]
              : []),
          ].map(([l, v], i) => (
            <div key={i} className="row between" style={{ padding: '4px 0' }}>
              <span className="muted">{l}</span>
              <span className="mono tnum">{v}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8 }} className="row between">
            <span style={{ fontWeight: 500 }}>Montant manquant</span>
            <span className="mono tnum" style={{ color: '#b45309', fontWeight: 600 }}>{fmt(details.missing)} €</span>
          </div>
          <div className="row" style={{
            marginTop: 10, gap: 8, padding: '8px 10px', borderRadius: 8,
            background: 'color-mix(in oklab, var(--good) 8%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--good) 25%, var(--line))',
            color: 'color-mix(in oklab, var(--good) 60%, var(--ink-2))',
            fontSize: 11.5, lineHeight: 1.5, alignItems: 'flex-start',
          }}>
            <span aria-hidden="true">ℹ︎</span>
            <span>La commission n'est prélevée qu'à chaque acceptation. Sans acceptation, aucune commission n'est facturée.</span>
          </div>
        </div>

        <div className="label" style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
          Montant à recharger
        </div>
        <div className="row center" style={{ gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(amount || '')}
            onChange={e => {
              const digits = (e.target.value || '').replace(/[^0-9]/g, '');
              setAmount(digits === '' ? 0 : Math.min(10000, parseInt(digits, 10)));
            }}
            className="input mono tnum"
            style={{ flex: 1, padding: '10px 12px', fontSize: 18 }}
          />
          <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>€</span>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5',
            color: '#991b1b', fontSize: 12.5, marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <div className="insuf-actions row gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={submitting} style={{ flex: 1, minWidth: 120 }}>
            Plus tard
          </button>
          <button className="btn btn-primary" onClick={goRecharge} disabled={submitting} style={{ flex: 2, minWidth: 200 }}>
            {submitting ? 'Redirection…' : `Recharger ${fmt(amount)} €`} <Icon name="arrow" size={12}/>
          </button>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
          Vous reprendrez la validation de votre campagne automatiquement après le paiement — aucune saisie ne sera perdue.
        </div>

        <style>{`
          @media (max-width: 540px) {
            .insuf-modal-overlay { align-items: stretch !important; padding: 0 !important; }
            .insuf-modal-card { border-radius: 0 !important; min-height: 100vh; }
            .insuf-actions .btn { flex: 1 1 100% !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

// Modal d'erreur de lancement (autre cas que solde insuffisant — qui a
// son propre modal avec recharge Stripe). Affiche le message lisible
// renvoyé par le backend, plutôt que l'alert() natif. Le style suit
// le pattern d'InsufficientBalanceModal : overlay, carte centrée,
// bandeau coloré, bouton "Compris".
function LaunchErrorModal({ title, message, onClose }) {
  return (
    <div role="dialog" aria-modal="true" className="launchErr-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 230,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 16px 80px',
    }} onClick={onClose}>
      <div className="launchErr-card" onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', maxWidth: 480, width: '100%',
        background: 'var(--paper)', borderRadius: 18,
        padding: 'clamp(20px, 4vw, 32px)',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0', borderTop: '4px solid #dc2626',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
            fontSize: 26, fontWeight: 700,
          }}>!</div>
          <div className="serif" style={{ fontSize: 'clamp(20px, 3vw, 24px)', lineHeight: 1.2, marginBottom: 6 }}>
            {title || 'Lancement impossible'}
          </div>
        </div>

        <div style={{
          padding: 14, borderRadius: 10, background: 'var(--ivory-2)',
          border: '1px solid var(--line)', fontSize: 13, lineHeight: 1.55,
          color: 'var(--ink)', marginBottom: 18,
        }}>
          {message || 'Une erreur est survenue lors du lancement de la campagne.'}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-primary" onClick={onClose} style={{ minWidth: 140 }}>
            Compris
          </button>
        </div>

        <style>{`
          @media (max-width: 480px) {
            .launchErr-overlay { align-items: stretch !important; padding: 0 !important; }
            .launchErr-card { border-radius: 0 !important; min-height: 100vh; }
          }
        `}</style>
      </div>
    </div>
  );
}

// Durées de campagne. Le multiplicateur s'applique au coût par contact
// (= gains du prospect) : plus la fenêtre est courte, plus le pro paie
// pour attirer une décision rapide. La durée 1h est une "flash deal"
// affichée sur la home page avec un compte à rebours.
const DURATIONS = [
  { id: '1h',  label: '1 heure',     sub: 'Flash Deal — exposition sur la home page', mult: 3,   ms: 3600 * 1000,                multBadge: '×3'   },
  { id: '24h', label: '24 heures',   sub: 'Diffusion accélérée',                       mult: 2,   ms: 24 * 3600 * 1000,           multBadge: '×2'   },
  { id: '48h', label: '48 heures',   sub: 'Diffusion étendue',                         mult: 1.5, ms: 48 * 3600 * 1000,           multBadge: '×1,5' },
  { id: '7d',  label: '7 jours',     sub: 'Diffusion standard',                        mult: 1,   ms: 7 * 24 * 3600 * 1000,       multBadge: '×1'   },
];
const DURATION_BY_ID = Object.fromEntries(DURATIONS.map(d => [d.id, d]));

function CreateCampaign({ onDone, companyInfo, onGoInformations, duplicateSourceId, onRecharge }) {
  const [step, setStep] = useState(1);
  const [launched, setLaunched] = useState(null); // {code} when launched
  const [insufficient, setInsufficient] = useState(null); // {balance, campaignTotal, planFee, needed, missing}
  // Erreur de lancement (autre que solde insuffisant) — affichée dans
  // un modal stylé plutôt qu'un alert() natif. Forme: {title, message}.
  const [launchError, setLaunchError] = useState(null);
  // ─── Plan tarifaire ─────────────────────────────────────────────
  // Au montage du wizard on récupère le plan actuel et on ouvre la
  // popup de sélection. Tant que `planChosen=false`, on bloque le
  // wizard (overlay devant le contenu) pour que le pro confirme son
  // plan avant toute saisie.
  const [plan, setPlan] = useState(null);
  const [planSpecs, setPlanSpecs] = useState(null);
  const [planChosen, setPlanChosen] = useState(false);
  // `null` tant que plan + cycle ne sont pas chargés — on n'ouvre PAS le
  // sélecteur tant qu'on ne sait pas s'il est nécessaire. Voir l'effet
  // ci-dessous : le sélecteur s'ouvre uniquement à la 1re campagne du
  // cycle (cycleCount === 0) ou quand le quota du cycle est atteint.
  const [planModalOpen, setPlanModalOpen] = useState(false);
  // Quota du cycle en cours (Starter = 2, Pro = 10). Quand le compteur
  // côté serveur atteint le cap, on rouvre la popup pour que le pro
  // démarre un nouveau cycle.
  const [cycleCount, setCycleCount] = useState(null);
  const [cycleCap, setCycleCap] = useState(null);
  const [capReached, setCapReached] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () => fetch('/api/pro/plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then((p) => {
      if (cancelled) return;
      const nextPlan = p?.plan || 'starter';
      const nextCycle = Number(p?.cycleCount ?? 0);
      const nextCap = Number(p?.cap ?? (nextPlan === 'pro' ? 10 : 2));
      setPlan(nextPlan);
      setPlanSpecs(p?.specs || null);
      setCycleCount(nextCycle);
      setCycleCap(nextCap);
      // Décide si le popup doit s'ouvrir :
      //  - quota du cycle atteint → ouvre en mode "renouveler cycle"
      //  - 1re campagne du cycle (compteur = 0) → ouvre en mode normal
      //  - sinon → skip silencieusement, le mode courant est conservé
      const reached = Boolean(p?.capReached);
      setCapReached(reached);
      if (reached || nextCycle === 0) {
        setPlanModalOpen(true);
        setPlanChosen(false);
      } else {
        setPlanModalOpen(false);
        setPlanChosen(true);
      }
    });
    load();
    // Si l'utilisateur change de formule depuis "Mes informations" pendant
    // que le wizard est ouvert, on resynchronise pour que les paliers et
    // le cap de prospects reflètent la nouvelle formule en temps réel.
    const onPlanChanged = (e) => {
      const next = e?.detail?.plan;
      if (next === 'starter' || next === 'pro') setPlan(next);
      load();
    };
    window.addEventListener('pro:plan-changed', onPlanChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('pro:plan-changed', onPlanChanged);
    };
  }, []);
  // Cap et frais lus depuis l'API (`plan_pricing` en base) plutôt que
  // codés en dur ici. Fallback raisonnable si l'API n'a pas (encore)
  // répondu : le brouillon UI reste utilisable.
  const planMaxProspects = planSpecs?.[plan]?.maxProspects ?? (plan === 'pro' ? 500 : 50);
  // Si l'utilisateur passe d'un plan Pro à Starter (ou si la valeur
  // initiale dépasse le cap), on rabote `contacts` au plafond du plan.
  useEffect(() => {
    setContacts(c => Math.min(c, planMaxProspects));
  }, [planMaxProspects]);

  // Solde wallet pro (DISPONIBLE = balance - réservé). Le réservé est
  // la somme des (budget + commission max) des campagnes actives non
  // encore clôturées : ce montant n'a pas quitté le wallet, mais il
  // est déjà engagé et ne peut pas servir à une nouvelle campagne.
  const [walletBalanceEur, setWalletBalanceEur] = useState(null);
  const refreshWalletBalance = React.useCallback(async () => {
    try {
      invalidateProWallet();
      const j = await fetchProWallet();
      const available = j?.walletAvailableEur != null
        ? Number(j.walletAvailableEur)
        : Number(j?.walletBalanceEur ?? 0);
      setWalletBalanceEur(available);
    } catch {}
  }, []);
  useEffect(() => { refreshWalletBalance(); }, [refreshWalletBalance]);

  // ─── Persistance brouillon de campagne ─────────────────────────
  // Si l'utilisateur est redirigé vers Stripe pour recharger son crédit
  // au moment de valider la campagne, on sauvegarde l'intégralité du
  // wizard dans `window.top.sessionStorage`, puis on restore au retour.
  // Cela évite de devoir refaire tout le wizard. La clé est nettoyée
  // dès la restauration pour ne pas rejouer un brouillon obsolète.
  const DRAFT_KEY = 'bupp:campaign-draft';
  const safeTopSession = () => {
    try { return window.top.sessionStorage; } catch { return window.sessionStorage; }
  };
  const saveDraft = () => {
    try {
      const draft = {
        version: 1,
        ts: Date.now(),
        plan,
        selectedObj,
        selectedSubs: Array.from(selectedSubs),
        selectedTiers: Array.from(selectedTiers),
        geo, ages: Array.from(ages),
        verif, contacts, durationKey, poolMode,
        keywords, kwInput, kwFilter,
        startDate, endDate, brief,
      };
      safeTopSession().setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) { console.warn('saveDraft failed', e); }
  };
  // Restaure le brouillon si présent (au montage du wizard, juste après
  // un retour de Stripe success). Saute directement à l'étape Récap.
  useEffect(() => {
    try {
      const raw = safeTopSession().getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d.version !== 1) return;
      // Considère le brouillon obsolète après 1 h.
      if (Date.now() - Number(d.ts || 0) > 60 * 60 * 1000) {
        safeTopSession().removeItem(DRAFT_KEY);
        return;
      }
      setSelectedObj(d.selectedObj ?? null);
      setSelectedSubs(new Set(d.selectedSubs || []));
      setSelectedTiers(new Set(d.selectedTiers || [1]));
      setGeo(d.geo ?? 'ville');
      setAges(new Set(d.ages || ['Tous']));
      setVerif(d.verif ?? 'p0');
      setContacts(Number(d.contacts ?? 10));
      setDurationKey(typeof d.durationKey === 'string' ? d.durationKey : '7d');
      setPoolMode(d.poolMode ?? 'standard');
      setKeywords(d.keywords || []);
      setKwInput(d.kwInput || '');
      setKwFilter(Boolean(d.kwFilter));
      setStartDate(d.startDate || isoPlusDays(1));
      setEndDate(d.endDate || isoPlusDays(8));
      setBrief(d.brief || '');
      // On considère que le plan est déjà acté (l'utilisateur a déjà
      // choisi avant de partir recharger).
      setPlanChosen(true);
      setPlanModalOpen(false);
      // Saute directement à l'étape Récap pour finaliser le paiement.
      setStep(WIZ_TOTAL);
      safeTopSession().removeItem(DRAFT_KEY);
    } catch (e) { console.warn('restoreDraft failed', e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // À chaque changement d'étape du wizard, on remonte automatiquement en
  // haut de la page : sinon l'utilisateur, qui vient de cliquer "Continuer"
  // en bas, atterrit sur l'étape suivante… toujours en bas. Mauvaise UX.
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    document.querySelectorAll('main, .page').forEach(el => { el.scrollTop = 0; });
  }, [step]);

  // ─── Duplication ─────────────────────────────────────────────────
  // Quand le wizard est ouvert via "Dupliquer" sur une campagne, on
  // hydrate tous les states depuis /api/pro/campaigns/:id puis on saute
  // directement à l'étape Récap. Le contrôle quota (cycle Starter/Pro)
  // reste actif : si le cap est atteint, le sélecteur de mode s'ouvre
  // par-dessus comme pour une création vierge.
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupSourceName, setDupSourceName] = useState(null);
  useEffect(() => {
    if (!duplicateSourceId) return;
    let cancelled = false;
    setIsDuplicate(true);
    setDupLoading(true);
    fetch(`/api/pro/campaigns/${duplicateSourceId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) return;
        const tg = d.targeting || {};
        if (d.objectiveId) setSelectedObj(d.objectiveId);
        if (Array.isArray(tg.subTypes)) setSelectedSubs(new Set(tg.subTypes));
        if (Array.isArray(tg.requiredTiers)) {
          setSelectedTiers(new Set(tg.requiredTiers.map((n) => Number(n)).filter((n) => n > 0)));
        }
        if (typeof tg.geo === 'string') setGeo(tg.geo);
        if (Array.isArray(tg.ages) && tg.ages.length > 0) setAges(new Set(tg.ages));
        if (typeof tg.verifLevel === 'string') setVerif(tg.verifLevel);
        if (typeof tg.durationKey === 'string') setDurationKey(tg.durationKey);
        if (typeof tg.poolMode === 'string') setPoolMode(tg.poolMode);
        if (Array.isArray(tg.keywords)) setKeywords(tg.keywords);
        if (typeof tg.kwFilter === 'boolean') setKwFilter(tg.kwFilter);
        if (typeof tg.excludeCertified === 'boolean') setExcludeCertified(tg.excludeCertified);
        if (typeof d.plannedContacts === 'number' && d.plannedContacts > 0) setContacts(d.plannedContacts);
        if (typeof d.brief === 'string') setBrief(d.brief);
        if (d.name) setDupSourceName(d.name);
        // Le plan a déjà été choisi (la campagne d'origine existe), on
        // saute la popup. Si le quota est atteint, l'effet `load()` ouvrira
        // automatiquement le sélecteur de mode au-dessus du récap.
        setPlanChosen(true);
        setPlanModalOpen(false);
        setStep(WIZ_TOTAL);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDupLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateSourceId]);
  // raison sociale + ville sont obligatoires pour permettre aux prospects
  // d'identifier l'entreprise dans l'annonce → le lancement est bloqué tant
  // que ces deux champs ne sont pas renseignés.
  const missingCompanyFields = [];
  if (!companyInfo?.raisonSociale) missingCompanyFields.push('raison sociale');
  if (!companyInfo?.ville) missingCompanyFields.push('ville');
  const canLaunch = missingCompanyFields.length === 0;
  const [selectedObj, setSelectedObj] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());
  const [selectedTiers, setSelectedTiers] = useState(new Set([1]));
  const [geo, setGeo] = useState('ville');
  const [ages, setAges] = useState(new Set(['Tous']));
  const [verif, setVerif] = useState('p0');
  const [contacts, setContacts] = useState(10);
  const [durationKey, setDurationKey] = useState('7d');
  const [poolMode, setPoolMode] = useState('standard');
  // Étape 5 : exclure ou non les profils "certifié confiance" du pool.
  // - false (défaut) : on garde les certifié confiance (gain ×2 pour eux,
  //   débit ×2 côté pro, déjà câblé serveur).
  // - true : findMatchingProspects retire ces prospects du résultat.
  const [excludeCertified, setExcludeCertified] = useState(false);
  // Affiche la confirmation quand le pro coche la case (false → true).
  const [confirmExcludeCertified, setConfirmExcludeCertified] = useState(false);
  // Bonus fondateur : pendant le 1er mois post-lancement de BUUPP, chaque
  // acceptation par un fondateur coûte 2× le tarif palier choisi.
  // Désactivé par défaut — opt-in volontaire.
  const [founderBonusEnabled, setFounderBonusEnabled] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState('');
  const [kwFilter, setKwFilter] = useState(false);
  // Étape 2 : dates de lancement / fin de campagne
  const [startDate, setStartDate] = useState(isoPlusDays(1));
  const [endDate, setEndDate] = useState(isoPlusDays(8));
  const datesValid = !!startDate && !!durationKey;
  // Étape 7 : brief / description (50 caractères max)
  const [brief, setBrief] = useState('');
  const briefValid = brief.trim().length > 0 && brief.length <= BRIEF_MAX_LENGTH;
  // Indicateur "l'utilisateur a tenté de continuer sans remplir" → on
  // affiche la bordure rouge + le message obligatoire. Reset dès qu'il
  // commence à saisir quelque chose.
  const [briefError, setBriefError] = useState(false);
  // Étape 8 : acceptation des CGU / CGV / Politique RGPD. Le bouton de
  // lancement est bloqué tant que la case n'est pas cochée. Si le pro
  // tente de lancer sans cocher, on affiche la bordure rouge + l'erreur.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const obj = OBJECTIVES.find(o => o.id === selectedObj);
  const objAllowedTiers = obj?.allowedTiers || [1,2,3,4,5];
  // Starter limite l'accès aux paliers 1 à 3 (cf. cards de prix). On
  // intersecte avec ce que la finalité autorise au titre du RGPD.
  const planTierCap = plan === 'starter' ? 3 : 5;
  const allowedTiers = objAllowedTiers.filter(t => t <= planTierCap);

  // RGPD + plan : prune tiers when objective or plan changes — only keep allowed ones
  useEffect(() => {
    setSelectedTiers(prev => {
      const next = new Set();
      prev.forEach(tid => { if (allowedTiers.includes(tid)) next.add(tid); });
      if (next.size === 0 && allowedTiers.length > 0) next.add(allowedTiers[0]);
      return next;
    });
  }, [selectedObj, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseCpc = (() => {
    if (!selectedTiers.size) return 0;
    // Seul le coût des paliers est retenu — les sous-types choisis à
    // l'étape 1 sont purement informatifs (nature de l'opération
    // marketing) et n'affectent pas le tarif. Le pro paie pour la
    // donnée, pas pour le canal utilisé.
    let base = 0;
    selectedTiers.forEach(tid => { const t = TIERS_DATA.find(t => t.id === tid); base += (t.min + t.max) / 2; });
    const mult = VERIF_LEVELS.find(v => v.id === verif)?.mult || 1;
    return Math.round(base * mult * 100) / 100;
  })();
  const durationMeta = DURATION_BY_ID[durationKey] || DURATION_BY_ID['7d'];
  const durationMultiplier = durationMeta.mult;
  const cpc = Math.round(baseCpc * durationMultiplier * 100) / 100;
  const total = Math.round(cpc * contacts * 100) / 100;
  // endDate dérivée — startDate + durée. Si startDate est invalide,
  // fallback sur 7 jours (ne devrait pas arriver, l'input est requis).
  const computedEndDate = (() => {
    const t = startDate ? new Date(startDate).getTime() : NaN;
    if (!isFinite(t)) return endDate;
    const ms = durationMeta.ms;
    const d = new Date(t + ms);
    return d.toISOString().slice(0, 10);
  })();

  const toggleSub = (sid) => setSelectedSubs(prev => {
    // Multi-sélection : on bascule l'appartenance dans le Set sans
    // jamais réinitialiser les autres entrées (ce serait une mono-
    // sélection radio, pas l'effet voulu sur cette étape).
    const next = new Set(prev);
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    return next;
  });
  const toggleTier = (tid) => setSelectedTiers(p => { const n = new Set(p); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  // "Tous" agit comme un raccourci "tout cocher" : un premier clic active
  // toutes les tranches d'âge en plus de la pill "Tous", un second clic
  // (quand tout est déjà coché) revient au défaut "Tous" seul. Les clics
  // sur les tranches individuelles synchronisent la pill "Tous" avec
  // l'état réel — elle reste cochée si et seulement si toutes les tranches
  // le sont. Le backend traite "Tous" et la liste complète comme un
  // synonyme (cf. lib/campaigns/mapping.ts → ageRangesToBounds).
  const ALL_AGE_RANGES_NO_TOUS = AGE_RANGES.filter(x => x !== 'Tous');
  const toggleAge = (a) => setAges(p => {
    if (a === 'Tous') {
      const allOn = ALL_AGE_RANGES_NO_TOUS.every(r => p.has(r));
      return allOn ? new Set(['Tous']) : new Set(AGE_RANGES);
    }
    const n = new Set(p);
    // En mode "Tous seul", un clic individuel passe en sélection explicite
    // sur ce seul âge (l'utilisateur restreint la sélection initiale).
    if (n.has('Tous') && !ALL_AGE_RANGES_NO_TOUS.every(r => n.has(r))) {
      return new Set([a]);
    }
    n.has(a) ? n.delete(a) : n.add(a);
    // Synchro de la pill "Tous" — cochée ssi toutes les tranches le sont.
    if (ALL_AGE_RANGES_NO_TOUS.every(r => n.has(r))) n.add('Tous');
    else n.delete('Tous');
    if (n.size === 0) n.add('Tous');
    return n;
  });
  const addKw = (val) => {
    const kw = (val ?? kwInput).trim();
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw]);
    if (!val) setKwInput('');
  };
  const removeKw = (i) => {
    const next = keywords.filter((_, idx) => idx !== i);
    setKeywords(next);
    if (!next.length) setKwFilter(false);
  };

  /* Cliquable : on autorise un retour direct vers une étape déjà visitée
     (idx <= step). Aller en avant force toujours à passer par "Continuer"
     pour s'assurer que les validations intermédiaires se font dans l'ordre. */
  const goToStep = (idx) => {
    if (idx >= 1 && idx <= step) setStep(idx);
  };
  const stepperBar = (
    <div className="card wizard-stepper" style={{ padding: 4 }}>
      <div className="row wizard-stepper-row" style={{ padding: 8 }}>
        {WIZ_STEPS.map((s, i) => {
          const idx = i + 1;
          const isDone = idx < step;
          const isActive = idx === step;
          const clickable = idx <= step;
          return (
            <button
              key={s}
              type="button"
              onClick={() => goToStep(idx)}
              disabled={!clickable}
              aria-current={isActive ? 'step' : undefined}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8,
                background: isActive ? 'var(--ivory-2)' : 'transparent',
                borderRight: i < WIZ_STEPS.length - 1 ? '1px solid var(--line)' : 'none',
                borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: clickable ? 1 : 0.5,
                cursor: clickable && !isActive ? 'pointer' : 'default',
                fontFamily: 'inherit', textAlign: 'left',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (clickable && !isActive) e.currentTarget.style.background = 'color-mix(in oklab, var(--accent) 6%, var(--paper))'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 999,
                background: isDone ? 'var(--good)' : isActive ? 'var(--ink)' : 'var(--line)',
                color: idx <= step ? 'white' : 'var(--ink-4)',
                fontSize: 11, fontFamily: 'var(--mono)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isDone ? '✓' : idx}
              </span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: 'var(--ink)' }}>{s}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Commission BUUPP = 10 % du budget total. Le wallet doit couvrir
  // budget + commission au lancement (cf. /api/pro/campaigns).
  const commission = Math.round(total * 0.10 * 100) / 100;
  // Frais d'accès au cycle (Starter / Pro) : facturés UNE SEULE FOIS au
  // démarrage d'un cycle (cycleCount === 0). Tant qu'il reste du quota,
  // les campagnes suivantes du cycle ne le repayent pas. Au cap+1, le
  // pro repick un mode → cycleCount remis à 0 → on repaye.
  const isFirstOfCycle = cycleCount === 0;
  const cycleStartFee = isFirstOfCycle
    ? Number(planSpecs?.[plan]?.monthlyEur ?? (plan === "pro" ? 59 : 19))
    : 0;
  const planLabel = plan === "pro" ? "Pro" : "Starter";
  const totalToDebit = Math.round((total + commission + cycleStartFee) * 100) / 100;
  const costPreview = cpc > 0 && (
    <div className="wizard-cost-preview" style={{
      background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
      border: '1px solid color-mix(in oklab, var(--accent) 20%, var(--line))',
      borderRadius: 14, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, color: 'color-mix(in oklab, var(--accent) 70%, var(--ink-3))' }}>Coût par contact estimé</div>
          <div className="serif tnum" style={{ fontSize: 30, color: 'var(--accent)' }}>{fmtEur(cpc)}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>selon paliers et vérification</div>
        </div>
        <div className="wizard-cost-right" style={{ textAlign: 'right' }}>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, color: 'color-mix(in oklab, var(--accent) 70%, var(--ink-3))' }}>Budget total</div>
          <div className="serif tnum" style={{ fontSize: 30, color: 'var(--accent)' }}>{fmtEur(total)}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>pour {contacts} contacts</div>
        </div>
      </div>
      <div style={{
        marginTop: 18, paddingTop: 14,
        borderTop: '1px dashed color-mix(in oklab, var(--accent) 25%, var(--line))',
        display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13,
      }}>
        <div className="row between" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Commission BUUPP</span>{' '}
            <span className="mono" style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 6,
              background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
              color: 'var(--accent)', fontWeight: 600, marginLeft: 4,
            }}>10 % = commission BUUPP</span>
          </div>
          <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--accent)' }}>jusqu'à {fmtEur(commission)}</span>
        </div>
        {cycleStartFee > 0 && (
          <div className="row between" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Frais cycle {planLabel}</span>{' '}
              <span className="mono" style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 6,
                background: 'color-mix(in oklab, var(--ink) 8%, var(--paper))',
                color: 'var(--ink-2)', fontWeight: 600, marginLeft: 4,
              }}>1ʳᵉ campagne du cycle</span>
            </div>
            <span className="mono tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtEur(cycleStartFee)}</span>
          </div>
        )}
        <div className="row between" style={{ alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--ink-3)' }}>
            Total à débiter de votre solde
            {cycleStartFee > 0 ? ' (budget + commission max. + frais cycle)' : ' (budget + commission max.)'}
          </span>
          <span className="mono tnum" style={{ fontWeight: 700, color: 'var(--ink)' }}>{fmtEur(totalToDebit)}</span>
        </div>
        <div className="row" style={{
          marginTop: 6, gap: 8, padding: '8px 10px', borderRadius: 8,
          background: 'color-mix(in oklab, var(--good) 8%, var(--paper))',
          border: '1px solid color-mix(in oklab, var(--good) 25%, var(--line))',
          color: 'color-mix(in oklab, var(--good) 60%, var(--ink-2))',
          fontSize: 12, lineHeight: 1.5, alignItems: 'flex-start',
        }}>
          <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ︎</span>
          <span>
            Le solde affichera le budget comme <strong>déjà engagé dès le lancement</strong>. Les fonds ne quittent réellement votre compte qu'à la <strong>clôture de la campagne</strong> :
            seules les acceptations effectives sont alors débitées (récompenses prospects + 10 % commission BUUPP).
            Sans acceptation, <strong>aucun centime ne quitte votre wallet</strong>.
          </span>
        </div>
        {walletBalanceEur != null && walletBalanceEur < totalToDebit && (
          <div style={{
            marginTop: 6, padding: '8px 10px', borderRadius: 8,
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
          }} role="alert">
            <div className="row recharge-alert" style={{
              gap: 8, fontSize: 12, fontWeight: 500, alignItems: 'flex-start',
            }}>
              <span aria-hidden="true">⚠</span>
              <span style={{ flex: 1 }}>Solde indisponible — {fmtEur(walletBalanceEur)} disponibles, {fmtEur(totalToDebit)} requis (budget + commission max.).</span>
              {onRecharge && (
                <button
                  type="button"
                  onClick={onRecharge}
                  className="btn btn-sm recharge-alert-cta"
                  style={{
                    background: '#991b1b', color: '#fff', border: 'none',
                    padding: '6px 12px', borderRadius: 6,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  <Icon name="plus" size={11}/> Recharger votre crédit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Nouvelle campagne" title={"Étape " + step + " · " + WIZ_STEPS[step-1]}/>
      {stepperBar}
      {!canLaunch && (
        <div className="alert-block" style={{
          padding: 16, borderRadius: 12,
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
              Lancement de campagne bloqué
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Vous devez renseigner <strong>{missingCompanyFields.join(' et ')}</strong> de votre
              société avant de pouvoir lancer une campagne. Ces informations permettent aux
              prospects d'identifier l'entreprise qui souhaite les solliciter et apparaissent
              dans l'annonce diffusée.
            </div>
            {onGoInformations && (
              <button onClick={onGoInformations} className="btn btn-sm" style={{
                marginTop: 12, background: '#DC2626', color: 'white'
              }}>
                <Icon name="briefcase" size={12}/> Compléter mes informations
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 32 }}>

        {/* Étape 1 — Objectif */}
        {step === 1 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Quel est l'objectif de votre campagne ?</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Choisissez un objectif principal, puis affinez avec les sous-types.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {OBJECTIVES.map(o => (
                <button key={o.id} onClick={() => {
                  // Ne ré-initialise les sous-types que si l'objectif change
                  // réellement — un retour en arrière (clic sur le même
                  // objectif) ne doit pas vider la saisie déjà effectuée.
                  if (selectedObj !== o.id) {
                    setSelectedObj(o.id);
                    setSelectedSubs(new Set());
                  }
                }}
                  style={{ textAlign: 'left', padding: 18, borderRadius: 12, cursor: 'pointer',
                    border: '1px solid ' + (selectedObj === o.id ? 'var(--accent)' : 'var(--line-2)'),
                    background: selectedObj === o.id ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                    boxShadow: selectedObj === o.id ? '0 0 0 1px var(--accent)' : 'none',
                    transition: 'all .15s ease' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ivory-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Icon name={o.icon} size={18}/>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{o.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{o.desc}</div>
                </button>
              ))}
            </div>

            {selectedObj && obj && (() => {
              // Aucun sous-type coché → bordure rouge sur tous les choix
              // pour signaler que la sélection est obligatoire avant
              // de passer à l'étape suivante.
              const noneSelected = selectedSubs.size === 0;
              const danger = '#DC2626';
              return (
                <div>
                  <div style={{ height: 1, background: 'var(--line)', margin: '24px 0 20px' }}/>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Précisez : {obj.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                    Multi-sélection possible.
                    {noneSelected && (
                      <span style={{ color: danger, fontWeight: 600, marginLeft: 6 }}>
                        Sélectionnez au moins un sous-type.
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {obj.sub.map(s => {
                      const checked = selectedSubs.has(s.id);
                      const borderColor = checked
                        ? 'var(--accent)'
                        : noneSelected ? danger : 'var(--line-2)';
                      return (
                        <button key={s.id} onClick={() => toggleSub(s.id)}
                          className="row center" style={{ gap: 12, padding: 12, borderRadius: 10, textAlign: 'left',
                            border: '1px solid ' + borderColor,
                            background: checked ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                            cursor: 'pointer' }}>
                          <span style={{ width: 16, height: 16, borderRadius: 4,
                            border: '1.5px solid ' + (checked ? 'var(--accent)' : noneSelected ? danger : 'var(--line-2)'),
                            background: checked ? 'var(--accent)' : 'var(--paper)',
                            color: 'white', fontSize: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {checked ? '✓' : ''}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                            {/* La description du sous-type sert d'info à
                                titre indicatif — le tarif final dépend
                                uniquement du palier de données sélectionné. */}
                            <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{s.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Étape 2 — Date de lancement + durée de campagne */}
        {step === 2 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Quand votre campagne sera-t-elle diffusée ?</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>
              Choisissez la date de lancement et la durée de diffusion. Plus la fenêtre est courte,
              plus les gains pour les prospects sont multipliés.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="mono caps muted" style={{ fontSize: 10, marginBottom: 8, display: 'block' }}>
                <Icon name="calendar" size={11}/> Date de lancement
              </label>
              <input
                type="date"
                className="input"
                value={startDate}
                min={todayIso()}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', maxWidth: 320, fontSize: 14, padding: '10px 12px' }}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {startDate ? fmtDateLong(startDate) : 'Sélectionnez une date'}
              </div>
            </div>

            <div className="label">Durée de la campagne</div>
            <div className="wizard-duration-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 8,
            }}>
              {DURATIONS.map((d) => {
                const sel = durationKey === d.id;
                const accent = d.id === '1h' ? '#B91C1C' : 'var(--accent)';
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDurationKey(d.id)}
                    className="col"
                    style={{
                      padding: 14, borderRadius: 12, gap: 6, textAlign: 'left',
                      border: '1.5px solid ' + (sel ? accent : 'var(--line-2)'),
                      background: sel
                        ? `color-mix(in oklab, ${accent} 6%, var(--paper))`
                        : 'var(--paper)',
                      boxShadow: sel ? `0 0 0 2px color-mix(in oklab, ${accent} 18%, transparent)` : 'none',
                      cursor: 'pointer',
                      transition: 'all .12s',
                      position: 'relative',
                    }}
                  >
                    <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 999,
                        background: `color-mix(in oklab, ${accent} 14%, var(--paper))`,
                        color: accent,
                        letterSpacing: '.04em',
                      }}>
                        {d.multBadge}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{d.sub}</div>
                    {d.id === '1h' && (
                      <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 500, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="bolt" size={11}/> Affichée sur la home page avec un compte à rebours.
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.55 }}>
              Le multiplicateur s'applique au coût par contact (= gains du prospect). Plus la
              fenêtre est courte, plus l'incitation à répondre rapidement est forte.
              {' '}Date de fin estimée :{' '}
              <strong style={{ color: 'var(--ink)' }}>{computedEndDate ? fmtDateLong(computedEndDate) : '—'}</strong>.
            </div>
          </div>
        )}

        {/* Étape 3 — Données (anciennement étape 2) */}
        {step === 3 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Quelles données souhaitez-vous obtenir ?</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>Sélectionnez un ou plusieurs paliers parmi ceux autorisés pour cette finalité.</div>

            {/* RGPD minimisation banner */}
            <div style={{
              display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10,
              border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--line))',
              background: 'color-mix(in oklab, var(--accent) 4%, var(--paper))',
              marginBottom: 22
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in oklab, var(--accent) 12%, var(--paper))',
                color: 'var(--accent)', fontWeight: 700, fontSize: 13
              }}>§</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  Principe de minimisation — Article 5.1.c du RGPD
                </div>
                <div>
                  Les données accessibles dépendent de la finalité de la campagne. Vous ne recevrez
                  que les données <strong>strictement nécessaires</strong> à l'objectif déclaré ci-dessus.
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  Ex. : prise de RDV → identité (Palier 1) · livre blanc → e-mail (Palier 1) ·
                  étude rémunérée → Paliers 1 à 5 selon les questions.
                </div>
              </div>
            </div>

            {plan === 'starter' && (
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid color-mix(in oklab, #B45309 30%, var(--line))',
                background: 'color-mix(in oklab, #B45309 6%, var(--paper))',
                marginBottom: 20,
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'color-mix(in oklab, #B45309 14%, var(--paper))',
                  color: '#B45309',
                }}>
                  <Icon name="lock" size={12}/>
                </span>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                  La formule <strong style={{ color: '#B45309' }}>Starter</strong> ne vous autorise qu'à obtenir les informations des
                  <strong style={{ color: 'var(--ink)' }}> paliers 1 à 3</strong>. Pour accéder aux paliers 4 et 5,
                  passez en formule{' '}
                  {onGoInformations ? (
                    <button
                      type="button"
                      onClick={onGoInformations}
                      style={{
                        background: 'none', border: 'none', padding: 0, margin: 0,
                        color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline',
                        cursor: 'pointer', font: 'inherit',
                      }}
                    >Pro</button>
                  ) : (
                    <strong style={{ color: 'var(--ink)' }}>Pro</strong>
                  )} depuis vos informations entreprise.
                </div>
              </div>
            )}

            {/* Tiers grid */}
            <div className="col gap-2">
              {TIERS_DATA.map(t => {
                const allowed = allowedTiers.includes(t.id);
                const blockedByPlan = !allowed && plan === 'starter' && t.id > 3 && objAllowedTiers.includes(t.id);
                const checked = selectedTiers.has(t.id) && allowed;
                return (
                  <button key={t.id}
                    onClick={() => allowed && toggleTier(t.id)}
                    disabled={!allowed}
                    title={allowed ? '' : (blockedByPlan ? 'Palier réservé à la formule Pro' : 'Palier non disponible pour cette finalité (RGPD — minimisation)')}
                    className="row center wizard-tier-row" style={{ gap: 16, padding: 16, borderRadius: 12, textAlign: 'left',
                      border: '1px solid ' + (checked ? 'var(--accent)' : 'var(--line-2)'),
                      background: checked ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))'
                                : allowed ? 'var(--paper)'
                                : 'color-mix(in oklab, var(--ink) 3%, var(--paper))',
                      boxShadow: checked ? '0 0 0 1px var(--accent)' : 'none',
                      opacity: allowed ? 1 : 0.45,
                      cursor: allowed ? 'pointer' : 'not-allowed',
                      position: 'relative'
                    }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999,
                      border: '2px solid ' + (checked ? 'var(--accent)' : 'var(--line-2)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }}/>}
                    </span>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: t.pct + '%', background: allowed ? 'var(--accent)' : 'var(--ink-4)', borderRadius: 999 }}/>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Palier {t.id} — {t.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {allowed ? (
                        <>
                          <div className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                            {t.min === t.max ? `min. ${fmtEur(t.min)}` : `${fmtEur(t.min)} – ${fmtEur(t.max)}`}
                          </div>
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>par contact</div>
                        </>
                      ) : (
                        <span className="mono caps" style={{ fontSize: 10, fontWeight: 600, color: blockedByPlan ? '#B45309' : 'var(--ink-4)', letterSpacing: '.08em' }}>
                          🔒 {blockedByPlan ? 'Plan Pro' : 'Non autorisé'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Allowed-tier summary */}
            <div className="row center" style={{
              gap: 10, marginTop: 16, padding: '10px 14px', borderRadius: 10,
              background: 'color-mix(in oklab, var(--accent) 5%, var(--paper))',
              border: '1px dashed color-mix(in oklab, var(--accent) 30%, var(--line))',
              fontSize: 12, color: 'var(--ink-2)'
            }}>
              <Icon name="lock" size={13}/>
              <span>
                <strong>{obj?.name || 'Cette finalité'}</strong> autorise{' '}
                {allowedTiers.length === 1
                  ? <>uniquement le <strong>Palier {allowedTiers[0]}</strong></>
                  : <>les <strong>Paliers {allowedTiers[0]} à {allowedTiers[allowedTiers.length-1]}</strong></>}.
              </span>
            </div>
          </div>
        )}

        {/* Étape 4 — Ciblage (anciennement étape 3) */}
        {step === 4 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Définissez votre ciblage</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Zone géographique, âge et niveau de vérification des prospects.</div>

            <div className="label">Zone géographique</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
              {GEO_ZONES.map(z => (
                <button key={z.id} onClick={() => setGeo(z.id)} style={{ padding: 14, borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  border: '1px solid ' + (geo === z.id ? 'var(--accent)' : 'var(--line-2)'),
                  background: geo === z.id ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                  boxShadow: geo === z.id ? '0 0 0 1px var(--accent)' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{z.name}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{z.sub}</div>
                </button>
              ))}
            </div>

            <div className="label">Tranche d'âge (multi-sélection)</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {AGE_RANGES.map(a => (
                <button key={a} onClick={() => toggleAge(a)} className="chip" style={{ cursor: 'pointer',
                  padding: '7px 14px', fontSize: 12, fontWeight: 500, borderRadius: 999,
                  background: ages.has(a) ? 'var(--accent)' : 'var(--paper)',
                  color: ages.has(a) ? 'white' : 'var(--ink-3)',
                  borderColor: ages.has(a) ? 'var(--accent)' : 'var(--line-2)' }}>
                  {a}
                </button>
              ))}
            </div>

            <div className="label">Niveau de vérification minimum</div>
            <div className="col gap-2">
              {VERIF_LEVELS.map(v => {
                const sel = verif === v.id;
                return (
                  <button key={v.id} onClick={() => setVerif(v.id)} className="row center" style={{ gap: 14, padding: 14, borderRadius: 10, cursor: 'pointer',
                    border: '1px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                    background: sel ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                    textAlign: 'left' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999,
                      border: '2px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }}/>}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{v.sub}</div>
                    </div>
                    {v.badge && <span className="chip chip-accent" style={{ fontSize: 11, fontWeight: 600 }}>{v.badge}</span>}
                  </button>
                );
              })}
            </div>

            {/* Avertissement quand le pro choisit un palier élevé : il
                gagne en qualité de profil mais perd en volume potentiel.
                Affiché uniquement pour Vérifié (p1) et Certifié confiance
                (p2) — Basique (p0) ne réduit pas le bassin. */}
            {(verif === 'p1' || verif === 'p2') && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 10,
                background: '#FFF7ED',
                border: '1px solid #FDBA74',
                color: '#7C2D12',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ flexShrink: 0, color: '#EA580C', marginTop: 1 }}>
                  <Icon name="alert" size={16} stroke={2}/>
                </div>
                <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
                  <strong>Œil de lynx, audience d'élite !</strong>{' '}
                  {verif === 'p2'
                    ? "Le palier Certifié confiance ne laisse passer que la crème de la crème — votre ciblage gagne en finesse, votre bassin de prospects en intimité."
                    : "Vérifié, c'est plus sûr — mais aussi plus rare. Vous gagnez en qualité ce que vous perdez en volume."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Étape 5 — Budget (anciennement étape 4) */}
        {step === 5 && (
          <div>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
              <div className="serif" style={{ fontSize: 22 }}>Définissez votre budget</div>
              <span className="mono" style={{
                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                background: durationKey === '1h' ? 'color-mix(in oklab, #B91C1C 12%, var(--paper))' : 'color-mix(in oklab, var(--accent) 12%, var(--paper))',
                color: durationKey === '1h' ? '#B91C1C' : 'var(--accent)',
                border: '1px solid ' + (durationKey === '1h' ? 'color-mix(in oklab, #B91C1C 28%, var(--line))' : 'color-mix(in oklab, var(--accent) 25%, var(--line))'),
                letterSpacing: '.04em',
              }} title={`Multiplicateur appliqué au coût par contact (durée ${durationMeta.label})`}>
                Gains {durationMeta.multBadge}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Ajustez le nombre de contacts. Le coût par contact intègre déjà le multiplicateur lié à la durée choisie.</div>

            {/* Bandeau bonus ×2 — informe le pro que les profils
                "certifié confiance" déclenchent le doublage automatique du
                gain prospect, et donc imputent ×2 sur le budget pour ces
                contacts-là. Léger, pédagogique, non-bloquant. */}
            <div className="bonus-banner" style={{
              marginBottom: 22,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'color-mix(in oklab, #7C3AED 7%, var(--paper))',
              border: '1px solid color-mix(in oklab, #7C3AED 30%, var(--line))',
              color: 'var(--ink-2)',
              fontSize: 13.5,
              lineHeight: 1.5,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }} role="status">
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✨</span>
              <div className="bonus-banner-text" style={{ flex: '1 1 240px', minWidth: 0 }}>
                Petit bonus à connaître 😉 — si certains de vos contacts ont un profil
                <strong style={{ color: '#7C3AED' }}> vérifié à 100% (certifié confiance)</strong>,
                <strong> leurs gains sont automatiquement doublés</strong> et viennent
                s'imputer sur le budget de la campagne. Prévoyez une petite marge !
              </div>
              <label
                className="row gap-2 bonus-exclude-pill"
                style={{
                  alignItems: 'center', flex: '0 0 auto',
                  padding: '8px 12px', borderRadius: 999,
                  background: excludeCertified ? '#7C3AED' : 'var(--paper)',
                  color: excludeCertified ? 'white' : 'var(--ink-2)',
                  border: '1.5px solid ' + (excludeCertified ? '#7C3AED' : 'color-mix(in oklab, #7C3AED 35%, var(--line))'),
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  whiteSpace: 'normal',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="checkbox"
                  checked={excludeCertified}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Passe par la confirmation : pas de toggle silencieux.
                      setConfirmExcludeCertified(true);
                    } else {
                      // Décocher (retour à l'état par défaut) : pas de friction.
                      setExcludeCertified(false);
                    }
                  }}
                  style={{ width: 14, height: 14, accentColor: '#7C3AED', flexShrink: 0 }}
                />
                <span>Retirer les “certifié confiance” de ma cible</span>
              </label>
              {/* Sur mobile, on bascule le pill en pleine largeur sous le texte
                  (centré, texte autorisé à wrap) pour éviter tout débordement. */}
              <style>{`
                @media (max-width: 720px) {
                  .bonus-banner { flex-direction: column !important; align-items: stretch !important; }
                  .bonus-banner-text { flex: 1 1 auto !important; }
                  .bonus-exclude-pill {
                    width: 100% !important;
                    justify-content: center !important;
                    text-align: center !important;
                  }
                }
              `}</style>
            </div>

            {costPreview}

            <div className="col gap-6" style={{ marginBottom: 24 }}>
              <div>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>Contacts souhaités</label>
                  <span className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{contacts}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={planMaxProspects}
                  step={planMaxProspects >= 100 ? 10 : 5}
                  value={Math.min(contacts, planMaxProspects)}
                  onChange={e => setContacts(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div className="row between mono muted" style={{ fontSize: 10, marginTop: 4 }}>
                  <span>10</span>
                  <span>{planMaxProspects}</span>
                </div>
                {plan === 'starter' && (
                  <div className="row center upgrade-pro-cta" style={{
                    marginTop: 12, padding: 12, borderRadius: 10, gap: 12,
                    background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
                    border: '1px dashed color-mix(in oklab, var(--accent) 30%, var(--line))',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
                      <strong>Plan Starter : 50 prospects max.</strong> Passez en mode Pro pour cibler jusqu'à <strong>500 prospects</strong> par campagne.
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        try {
                          const r = await fetch('/api/pro/plan', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ plan: 'pro' }),
                          });
                          if (!r.ok) throw new Error();
                          setPlan('pro');
                        } catch {
                          alert('Impossible de passer en mode Pro. Réessayez.');
                        }
                      }}
                      style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                    >
                      Passer en mode Pro <Icon name="arrow" size={12}/>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--line)', margin: '8px 0 20px' }}/>

            <div className="label">Mode de campagne</div>
            <div className="col gap-2">
              {[
                { id: 'standard', name: 'Mise en relation individuelle', sub: 'Contact direct avec chaque prospect — immédiat' },
                { id: 'pool', name: 'BUUPP Pool — enchère groupée', sub: 'Groupez des prospects ayant un besoin commun', disabled: true },
              ].map(m => {
                const sel = poolMode === m.id;
                const disabled = !!m.disabled;
                return (
                  <button
                    key={m.id}
                    onClick={() => { if (!disabled) setPoolMode(m.id); }}
                    disabled={disabled}
                    title={disabled ? 'À venir' : undefined}
                    aria-disabled={disabled || undefined}
                    className="row center wizard-mode-row"
                    style={{ gap: 14, padding: 14, borderRadius: 10,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.55 : 1,
                      border: '1px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                      background: sel ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                      boxShadow: sel ? '0 0 0 1px var(--accent)' : 'none',
                      textAlign: 'left' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 999,
                      border: '2px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)' }}/>}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="row center" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                        {disabled && (
                          <span className="chip" style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px' }}>À venir</span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{m.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bonus fondateur */}
            <div style={{
              marginTop: 16, padding: 14, borderRadius: 10,
              border: '1px solid var(--line)', background: 'var(--paper)',
            }}>
              <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    Activer le bonus fondateur (+100% le 1er mois)
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    Les fondateurs (aussi appelés <strong>parrains</strong>) sont des
                    <strong> prospects de confiance</strong>, inscrits avant le lancement
                    officiel : engagés, qualitatifs, et premiers à <strong>promouvoir
                    leur expérience</strong> de votre sollicitation. Activez le bonus
                    pour les rémunérer à <strong>2× le tarif palier</strong> pendant le
                    1<sup>er</sup> mois post-lancement. Désactivé, vos campagnes leur
                    restent visibles au tarif standard.{' '}
                    <strong>Palier VIP :</strong> un parrain ayant atteint 10 filleuls
                    bascule sur un bonus forfaitaire de <strong>+5,00 €</strong> par
                    acceptation (à la place du ×2) — uniquement si votre budget total
                    dépasse <strong>300 €</strong>. Détail au récap.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={founderBonusEnabled}
                  onClick={() => setFounderBonusEnabled(v => !v)}
                  style={{
                    flexShrink: 0, width: 42, height: 24, borderRadius: 999,
                    background: founderBonusEnabled ? 'var(--accent)' : 'var(--line-2)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: founderBonusEnabled ? 20 : 2,
                    width: 20, height: 20, borderRadius: 999, background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,.18)', transition: 'left .18s',
                  }}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 6 — Mots-clés (anciennement étape 5) */}
        {step === 6 && (
          <div>
            <div className="row center gap-3" style={{ marginBottom: 6 }}>
              <div className="serif" style={{ fontSize: 22 }}>Filtrage par mots-clés</div>
              <span className="chip chip-accent" style={{ fontSize: 10 }}>Optionnel</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22, maxWidth: 720 }}>
              Affinez votre ciblage en ajoutant des mots-clés. BUUPP vérifiera leur présence dans les données
              déclarées des prospects — centres d'intérêt, profession, projets de vie, type de logement, véhicule, etc.
            </div>

            <div style={{ background: 'var(--ivory-2)', border: '1px solid var(--line-2)', borderRadius: 14, padding: 22, marginBottom: 16 }}>
              <div className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'color-mix(in oklab, var(--accent) 12%, var(--paper))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}>
                  <Icon name="search" size={14}/>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Ajouter des mots-clés de ciblage</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Tapez un mot-clé et appuyez sur Entrée ou cliquez sur + Ajouter.</div>
                </div>
              </div>

              <div className="row gap-2 wizard-kw-input-row" style={{ marginBottom: 14 }}>
                <input value={kwInput} onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }}
                  placeholder="Ex : véhicule, immobilier, retraite…" maxLength={40}
                  className="input" style={{ flex: 1, fontSize: 13 }}/>
                <button onClick={() => addKw()} disabled={!kwInput.trim()}
                  className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', opacity: kwInput.trim() ? 1 : 0.4, cursor: kwInput.trim() ? 'pointer' : 'not-allowed' }}>
                  <Icon name="plus" size={12}/> Ajouter
                </button>
              </div>

              {keywords.length === 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div className="mono muted" style={{ fontSize: 10, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.1em' }}>Suggestions rapides</div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {KW_SUGGESTIONS.map(kw => (
                      <button key={kw} onClick={() => addKw(kw)} className="chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 10px' }}>{kw}</button>
                    ))}
                  </div>
                </div>
              )}

              {keywords.length > 0 && (
                <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {keywords.map((kw, i) => (
                    <div key={i} className="row center" style={{ gap: 6, padding: '4px 6px 4px 12px', borderRadius: 999,
                      background: 'color-mix(in oklab, var(--accent) 10%, var(--paper))',
                      border: '1px solid color-mix(in oklab, var(--accent) 25%, transparent)',
                      color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>
                      {kw}
                      <button onClick={() => removeKw(i)} style={{ width: 16, height: 16, borderRadius: 999,
                        background: 'color-mix(in oklab, var(--accent) 20%, transparent)', color: 'var(--accent)',
                        fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {keywords.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0 14px' }}/>
                  <button onClick={() => setKwFilter(f => !f)} className="row" style={{ gap: 12, padding: 14, borderRadius: 10, width: '100%', cursor: 'pointer', textAlign: 'left',
                    border: '1px solid ' + (kwFilter ? 'var(--accent)' : 'var(--line-2)'),
                    background: kwFilter ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                    alignItems: 'flex-start' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, marginTop: 2,
                      border: '1.5px solid ' + (kwFilter ? 'var(--accent)' : 'var(--line-2)'),
                      background: kwFilter ? 'var(--accent)' : 'var(--paper)',
                      color: 'white', fontSize: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {kwFilter ? '✓' : ''}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        Filtrer uniquement si le mot-clé est contenu dans les données du prospect
                      </div>
                      <div className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
                        Quand cette option est activée, seuls les prospects dont le profil contient au moins l'un de vos
                        mots-clés recevront votre mise en relation. Volume réduit, précision et taux d'acceptation améliorés.
                      </div>
                    </div>
                    <span style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, flexShrink: 0, marginTop: 2,
                      background: kwFilter ? 'var(--accent)' : 'var(--line-2)', transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 2, left: kwFilter ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: 'var(--paper)', transition: 'left .15s' }}/>
                    </span>
                  </button>

                  {kwFilter && (
                    <div className="row" style={{ gap: 10, padding: 12, marginTop: 10,
                      background: 'color-mix(in oklab, var(--warn) 8%, var(--paper))',
                      border: '1px solid color-mix(in oklab, var(--warn) 25%, transparent)',
                      borderRadius: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}>
                        <svg viewBox="0 0 16 16" width={14} height={14} fill="none">
                          <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                          <path d="M8 6.5v3M8 11v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </span>
                      <div style={{ fontSize: 11, lineHeight: 1.55, color: 'color-mix(in oklab, var(--warn) 60%, var(--ink-3))' }}>
                        Le filtre strict peut réduire le nombre de prospects disponibles. BUUPP vous notifiera
                        si le volume ciblé est insuffisant pour atteindre l'objectif de votre campagne.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ background: 'var(--ivory-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: 16 }}>
              <div className="mono caps" style={{ fontSize: 10, fontWeight: 600, marginBottom: 10, letterSpacing: '.1em' }}>Comment fonctionne le matching par mots-clés ?</div>
              <div className="col gap-3">
                <div className="row wizard-kw-explainer-row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span className="chip" style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0 }}>Sans filtre</span>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>
                    Les mots-clés agissent comme un <strong style={{ color: 'var(--ink)' }}>signal de priorité</strong> — les prospects
                    correspondants remontent en tête de liste sans exclure les autres. Le volume de campagne est préservé.
                  </div>
                </div>
                <div className="row wizard-kw-explainer-row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span className="chip chip-accent" style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0 }}>Filtre strict</span>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>
                    Seuls les prospects dont le profil contient l'un des mots-clés sont ciblés.
                    Volume réduit, précision maximale — idéal pour les campagnes très spécialisées.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Étape 7 — Description / brief de campagne (NOUVEAU, 50 caractères max) */}
        {step === 7 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Décrivez votre offre en quelques mots</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 18, lineHeight: 1.55 }}>
              Rédigez un message court et percutant qui sera affiché aux prospects dans le détail
              de votre campagne. Limité à <strong>{BRIEF_MAX_LENGTH} caractères</strong>.
            </div>
            <label className="mono caps muted" style={{ fontSize: 10, marginBottom: 8, display: 'block' }}>
              Le mot du professionnel
            </label>
            <textarea
              className="input"
              value={brief}
              onChange={e => {
                setBrief(e.target.value.slice(0, BRIEF_MAX_LENGTH));
                if (briefError) setBriefError(false);
              }}
              placeholder={BRIEF_PLACEHOLDER}
              maxLength={BRIEF_MAX_LENGTH}
              rows={3}
              aria-invalid={briefError ? true : undefined}
              style={{
                width: '100%', fontSize: 14, padding: '12px 14px',
                resize: 'vertical', minHeight: 80, lineHeight: 1.5,
                fontFamily: 'var(--sans)',
                /* Bordure rouge + halo doux quand l'utilisateur a tenté
                   de continuer sans rien saisir. */
                borderColor: briefError ? '#dc2626' : undefined,
                boxShadow: briefError ? '0 0 0 3px rgba(220, 38, 38, 0.15)' : undefined,
                outline: 'none',
              }}
            />
            {briefError && (
              <div role="alert" className="row center" style={{
                gap: 6, marginTop: 6, color: '#dc2626', fontSize: 12.5, fontWeight: 500,
              }}>
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
                <span>Information obligatoire</span>
              </div>
            )}
            <div className="row between" style={{ marginTop: 8, alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Conseil : un appel à l'action ou une remise concrète améliorent fortement le taux d'acceptation.
              </div>
              <div className="mono tnum" style={{
                fontSize: 12,
                color: brief.length >= BRIEF_MAX_LENGTH ? 'var(--danger)' : 'var(--ink-4)',
                fontWeight: brief.length >= BRIEF_MAX_LENGTH ? 600 : 400,
              }}>
                {brief.length} / {BRIEF_MAX_LENGTH}
              </div>
            </div>

            {/* Aperçu live tel qu'il sera affiché côté prospect */}
            <div style={{ marginTop: 22 }}>
              <label className="mono caps muted" style={{ fontSize: 10, marginBottom: 8, display: 'block' }}>
                Aperçu côté prospect
              </label>
              <div style={{
                padding: 14, borderRadius: 10,
                background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
                border: '1px solid color-mix(in oklab, var(--accent) 24%, var(--line))',
              }}>
                <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, color: 'color-mix(in oklab, var(--accent) 70%, var(--ink-3))' }}>
                  Le mot du professionnel
                </div>
                <div style={{ fontSize: 14, color: brief ? 'var(--ink)' : 'var(--ink-5)', lineHeight: 1.5, fontStyle: brief ? 'italic' : 'italic' }}>
                  « {brief || BRIEF_PLACEHOLDER} »
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Étape 8 — Récap (anciennement étape 6) */}
        {step === 8 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>
              {isDuplicate ? 'Duplication de campagne' : 'Récapitulatif de votre campagne'}
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>
              {isDuplicate
                ? 'Vérifiez tous les paramètres avant de relancer.'
                : 'Vérifiez tous les paramètres avant de lancer.'}
            </div>

            {isDuplicate && (
              <div className="row" style={{
                marginBottom: 18, gap: 12, padding: '12px 14px', borderRadius: 10,
                background: 'color-mix(in oklab, var(--accent) 7%, var(--paper))',
                border: '1px solid color-mix(in oklab, var(--accent) 25%, var(--line))',
                color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.55,
                alignItems: 'flex-start',
              }}>
                <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, color: 'var(--accent)' }}>
                  <Icon name="copy" size={14}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ color: 'var(--ink)' }}>Voici ce que vous aviez choisi lors de cette campagne</strong>
                  {dupSourceName && <span className="muted"> — « {dupSourceName} »</span>}.
                  {' '}Modifiez ce que vous voulez en cliquant sur <em>Modifier</em>, ou lancez tel quel.
                  {dupLoading && <span className="muted"> · Chargement des paramètres…</span>}
                </div>
              </div>
            )}

            {costPreview}

            <div style={{ background: 'var(--ivory-2)', border: '1px solid var(--line-2)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              {[
                ['Objectif', obj?.name || '—'],
                ['Sous-types', obj ? Array.from(selectedSubs).map(sid => obj.sub.find(s => s.id === sid)?.name).filter(Boolean).join(', ') || '—' : '—'],
                ['Date de lancement', fmtDateLong(startDate)],
                ['Date de fin estimée', fmtDateLong(computedEndDate)],
                ['Durée', `${durationMeta.label} (gains ${durationMeta.multBadge})`],
                ['Paliers de données', Array.from(selectedTiers).map(tid => TIERS_DATA.find(t => t.id === tid)?.name).join(', ') || '—'],
                ['Zone', GEO_ZONES.find(z => z.id === geo)?.name],
                ["Tranches d'âge", Array.from(ages).join(', ')],
                ['Vérification', VERIF_LEVELS.find(v => v.id === verif)?.name],
                ['Mode', poolMode === 'pool' ? 'BUUPP Pool — enchère groupée' : 'Mise en relation individuelle'],
                ['Contacts', contacts + ' contacts'],
                ['Le mot du pro', brief ? '« ' + brief + ' »' : '—'],
              ].map(([l, v], i) => (
                <div key={i} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', gap: 16, alignItems: 'flex-start' }}>
                  <span className="muted" style={{ fontSize: 12 }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
              <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', gap: 16, alignItems: 'flex-start' }}>
                <span className="muted" style={{ fontSize: 12 }}>Mots-clés</span>
                <div style={{ textAlign: 'right' }}>
                  {keywords.length > 0 ? (
                    <div className="row" style={{ flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                      {keywords.map((kw, i) => (
                        <span key={i} className="chip chip-accent" style={{ fontSize: 10, padding: '2px 8px' }}>{kw}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>Aucun</span>
                  )}
                </div>
              </div>
              {keywords.length > 0 && (
                <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', gap: 16 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Mode mot-clé</span>
                  <span className={'chip ' + (kwFilter ? 'chip-accent' : '')} style={{ fontSize: 10 }}>
                    {kwFilter ? 'Filtre strict activé' : 'Signal de priorité'}
                  </span>
                </div>
              )}
              <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="muted" style={{ fontSize: 12 }}>Coût par contact</span>
                <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{cpc > 0 ? fmtEur(cpc) : '—'}</span>
              </div>
              <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="muted" style={{ fontSize: 12 }}>Budget campagne</span>
                <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{total > 0 ? fmtEur(total) : '—'}</span>
              </div>
              <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Commission BUUPP (max.)
                  <span className="mono" style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 6,
                    background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
                    color: 'var(--accent)', fontWeight: 600,
                  }}>10 % = commission BUUPP</span>
                </span>
                <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{total > 0 ? `jusqu'à ${fmtEur(commission)}` : '—'}</span>
              </div>
              {cycleStartFee > 0 && (
                <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Frais cycle {planLabel}
                    <span className="mono" style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 6,
                      background: 'color-mix(in oklab, var(--ink) 8%, var(--paper))',
                      color: 'var(--ink-2)', fontWeight: 600,
                    }}>1ʳᵉ campagne du cycle · prélevé immédiatement</span>
                  </span>
                  <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtEur(cycleStartFee)}</span>
                </div>
              )}
              <div className="row between" style={{ padding: '12px 0 4px' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Total à débiter
                  {cycleStartFee > 0 && <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}> · réserve + frais cycle</span>}
                </span>
                <span className="mono tnum" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{total > 0 ? fmtEur(totalToDebit) : '—'}</span>
              </div>
              <div className="row" style={{
                marginTop: 4, gap: 8, padding: '10px 12px', borderRadius: 8,
                background: 'color-mix(in oklab, var(--good) 8%, var(--paper))',
                border: '1px solid color-mix(in oklab, var(--good) 25%, var(--line))',
                color: 'color-mix(in oklab, var(--good) 60%, var(--ink-2))',
                fontSize: 12, lineHeight: 1.5, alignItems: 'flex-start',
              }}>
                <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ︎</span>
                <span>
                  Votre solde affichera ce montant comme <strong>déjà engagé dès le lancement</strong>, mais les fonds ne quittent
                  réellement votre compte qu'à la <strong>clôture de la campagne</strong> (dans {durationMeta?.label?.toLowerCase?.() || 'la fenêtre choisie'}).
                  Seules les <strong>acceptations effectives</strong> sont facturées (rewards + 10 % commission BUUPP) ; sans aucune acceptation,
                  rien n'est prélevé et la réserve vous est restituée.
                </span>
              </div>
              {walletBalanceEur != null && total > 0 && walletBalanceEur < totalToDebit && (
                <div style={{
                  marginTop: 6, padding: '8px 10px', borderRadius: 8,
                  background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
                }} role="alert">
                  <div className="row recharge-alert" style={{
                    gap: 8, fontSize: 12, fontWeight: 500, alignItems: 'flex-start',
                  }}>
                    <span aria-hidden="true">⚠</span>
                    <span style={{ flex: 1 }}>Solde indisponible — {fmtEur(walletBalanceEur)} disponibles, {fmtEur(totalToDebit)} requis.</span>
                    {onRecharge && (
                      <button
                        type="button"
                        onClick={onRecharge}
                        className="btn btn-sm recharge-alert-cta"
                        style={{
                          background: '#991b1b', color: '#fff', border: 'none',
                          padding: '6px 12px', borderRadius: 6,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          flexShrink: 0, whiteSpace: 'nowrap',
                        }}
                      >
                        <Icon name="plus" size={11}/> Recharger votre crédit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, padding: 14, borderRadius: 10,
                          background: 'var(--ivory-2)', border: '1px solid var(--line)' }}>
              <div className="mono caps" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 6 }}>
                Bonus fondateur (1er mois post-lancement)
              </div>
              {founderBonusEnabled ? (
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Activé — chaque acceptation par un fondateur vous coûtera
                  <strong> {fmtEur(cpc * 2)}</strong> au lieu de {fmtEur(cpc)}.
                  Coût max si tous fondateurs : <strong>{fmtEur(cpc * 2 * contacts)}</strong>.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                  Désactivé pour cette campagne — les fondateurs gagneront le tarif
                  standard ({fmtEur(cpc)}).
                </div>
              )}
            </div>

            {/* Encart palier VIP : déclenché si budget > 300 € ET bonus fondateur ON.
                Prévient le pro qu'un parrain ayant atteint le plafond de 10 filleuls
                touche +5 € flat à la place du ×2 — débit pris sur son budget. */}
            {founderBonusEnabled && total > 300 && (
              <div style={{
                marginTop: 10, padding: 14, borderRadius: 10,
                background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                border: '1px solid #F59E0B',
                color: '#78350F',
              }}>
                <div className="mono caps" style={{
                  fontSize: 10, color: '#92400E', marginBottom: 6,
                  letterSpacing: '.12em', fontWeight: 700,
                }}>
                  🏆 Palier parrain VIP — surcoût éventuel
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                  Votre budget dépasse <strong>300 €</strong> : si un parrain ayant atteint
                  le plafond de <strong>10 filleuls</strong> accepte votre campagne, il
                  bascule sur un bonus exceptionnel de <strong>+5,00 € forfaitaires</strong>{' '}
                  (à la place du ×2 standard). Chaque acceptation de ce type vous coûtera
                  donc <strong>{fmtEur(cpc + 5)}</strong> au lieu de {fmtEur(cpc * 2)} —
                  uniquement pendant le 1er mois suivant le lancement officiel.
                </div>
              </div>
            )}

            <label
              htmlFor="terms-accept"
              className="terms-block"
              style={{
                padding: 14, borderRadius: 10,
                background: termsError
                  ? '#FEF2F2'
                  : 'color-mix(in oklab, var(--warn) 8%, var(--paper))',
                border: termsError
                  ? '1.5px solid #B91C1C'
                  : '1px solid color-mix(in oklab, var(--warn) 25%, transparent)',
                fontSize: 12, lineHeight: 1.55,
                color: termsError
                  ? '#991B1B'
                  : 'color-mix(in oklab, var(--warn) 55%, var(--ink-3))',
                marginBottom: termsError ? 8 : 20,
                display: 'flex', alignItems: 'flex-start', gap: 12,
                cursor: 'pointer',
                transition: 'border-color .18s, background .18s',
              }}
            >
              <input
                id="terms-accept"
                type="checkbox"
                checked={termsAccepted}
                onChange={e => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked) setTermsError(false);
                }}
                style={{
                  marginTop: 2, width: 18, height: 18, flexShrink: 0,
                  accentColor: termsError ? '#B91C1C' : 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              <span>
                En lançant cette campagne, vous acceptez les{' '}
                <a href="/cgu" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                   onClick={e => e.stopPropagation()}>
                  conditions générales d'utilisation du service BUUPP
                </a>
                , les{' '}
                <a href="/cgv" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                   onClick={e => e.stopPropagation()}>
                  conditions générales de vente
                </a>
                , et reconnaissez avoir pris connaissance de la{' '}
                <a href="/rgpd" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                   onClick={e => e.stopPropagation()}>
                  politique de gestion des données personnelles
                </a>
                .
              </span>
            </label>
            {termsError && (
              <div role="alert" style={{
                marginBottom: 20, fontSize: 12, color: '#B91C1C', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="alert" size={12}/> Vous devez accepter les conditions
                pour lancer la campagne.
              </div>
            )}

            <div className="row gap-3">
              <button onClick={() => setStep(1)} className="btn btn-ghost" style={{ flex: 1 }}>Modifier</button>
              <button
                onClick={async () => {
                  if (!canLaunch) return;
                  if (!termsAccepted) {
                    setTermsError(true);
                    return;
                  }
                  await refreshWalletBalance();
                  const balance = Number(walletBalanceEur ?? 0);
                  // Commission BUUPP = 10 % du budget (cf. backend).
                  const commission = Math.round(total * 0.10 * 100) / 100;
                  // Frais cycle facturés une seule fois quand cycleCount=0.
                  const totalNeeded = total + commission + cycleStartFee;
                  if (balance < totalNeeded) {
                    setInsufficient({
                      balance,
                      campaignTotal: total,
                      commission,
                      planFee: cycleStartFee,
                      planLabel,
                      needed: totalNeeded,
                      missing: Math.max(0, totalNeeded - balance),
                    });
                    return;
                  }
                  // POST vers /api/pro/campaigns — persist + match + emails.
                  try {
                    const r = await fetch('/api/pro/campaigns', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        name: obj?.name || '',
                        objectiveId: selectedObj,
                        subTypes: Array.from(selectedSubs),
                        requiredTiers: Array.from(selectedTiers),
                        geo, ages: Array.from(ages), verifLevel: verif,
                        contacts,
                        durationKey,
                        startDate, endDate: computedEndDate, brief,
                        costPerContactCents: Math.round(cpc * 100),
                        budgetCents: Math.round(total * 100),
                        keywords, kwFilter, poolMode,
                        excludeCertified,
                        founder_bonus_enabled: founderBonusEnabled,
                      }),
                    });
                    const j = await r.json();
                    if (!r.ok) {
                      if (r.status === 402) {
                        const wallet = (j.walletCents || 0) / 100;
                        const needed = (j.neededCents || 0) / 100;
                        const commission = j.commissionCents != null
                          ? j.commissionCents / 100
                          : Math.round(total * 0.10 * 100) / 100;
                        const planFee = j.planFeeCents != null
                          ? j.planFeeCents / 100
                          : cycleStartFee;
                        setInsufficient({
                          balance: wallet,
                          campaignTotal: total,
                          commission,
                          planFee,
                          planLabel,
                          needed,
                          missing: Math.max(0, needed - wallet),
                        });
                        return;
                      }
                      if (r.status === 403 && j?.error === 'mode_cap_reached') {
                        // Le serveur a refusé : le quota du cycle est atteint.
                        // On ré-ouvre le sélecteur de mode pour démarrer un
                        // nouveau cycle (Starter : 2 / Pro : 10).
                        setCycleCount(Number(j.cycleCount ?? cycleCap ?? 2));
                        setCycleCap(Number(j.cap ?? cycleCap ?? 2));
                        setCapReached(true);
                        setPlanChosen(false);
                        setPlanModalOpen(true);
                        return;
                      }
                      // Le backend renvoie {error: <code>, message: <texte
                      // lisible}. On préfère le message s'il est présent —
                      // sinon on traduit le code en libellé humain.
                      const friendly = j?.message || ({
                        launch_failed: 'Erreur inconnue, réessayez dans un instant.',
                        invalid_body: 'Certains champs sont invalides ou manquants.',
                        invalid_dates: 'Les dates choisies sont invalides.',
                        invalid_json: 'Requête mal formée.',
                        budget_mismatch: 'Le budget ne correspond pas au coût × nombre de contacts.',
                        tiers_above_plan_cap: `Votre plan ${j?.plan || ''} ne donne pas accès à ce palier (cap : ${j?.planTierCap ?? '?'}). Passez en Pro pour débloquer.`,
                        unauthorized: 'Session expirée — reconnectez-vous.',
                      })[j?.error] || `Erreur (${j?.error || r.status}).`;
                      setLaunchError({ title: 'Lancement impossible', message: friendly });
                      return;
                    }
                    // Wallet a été lu/contrôlé côté serveur — on invalide
                    // pour que le header et la facturation se rafraîchissent.
                    invalidateProWallet();
                    try { window.dispatchEvent(new Event('pro:wallet-changed')); } catch {}
                    setLaunched({ code: j.code, name: obj?.name, matched: j.matchedCount });
                  } catch (e) {
                    // Réseau / parse / inattendu — pas d'erreur backend
                    // structurée, on affiche un message générique.
                    setLaunchError({
                      title: 'Lancement impossible',
                      message: e?.message
                        ? `Problème réseau ou inattendu : ${e.message}`
                        : 'Problème réseau ou inattendu — réessayez dans un instant.',
                    });
                  }
                }}
                disabled={!canLaunch}
                title={canLaunch ? undefined : 'Renseignez ' + missingCompanyFields.join(' et ') + ' dans Mes informations'}
                className="btn btn-primary"
                style={{ flex: 2, opacity: canLaunch ? 1 : 0.55, cursor: canLaunch ? 'pointer' : 'not-allowed' }}
              >
                {canLaunch ? <>Lancer la campagne <Icon name="arrow" size={14}/></> : <>Lancement bloqué <Icon name="lock" size={14}/></>}
              </button>
            </div>
          </div>
        )}

      </div>

      <div className="row between">
        <button className="btn btn-ghost" onClick={() => step > 1 ? setStep(step - 1) : onDone()}>
          <Icon name="arrowLeft" size={14}/> {step > 1 ? 'Retour' : 'Annuler'}
        </button>
        {step < WIZ_STEP_RECAP && (
          <button className="btn btn-primary"
            onClick={() => {
              // Étape 7 : si le brief est vide, on bloque la navigation
              // ET on déclenche l'affichage rouge + le message
              // "Information obligatoire" sous le textarea.
              if (step === 7 && !briefValid) {
                setBriefError(true);
                return;
              }
              setStep(step + 1);
            }}
            // Bloque la navigation tant que raison sociale + ville ne sont
            // pas renseignées — l'alerte rouge en haut explique pourquoi et
            // pointe vers « Mes informations ».
            disabled={
              !canLaunch ||
              (step === 1 && (!selectedObj || !selectedSubs.size)) ||
              (step === 2 && !datesValid) ||
              (step === 3 && !selectedTiers.size)
            }
            title={
              !canLaunch
                ? 'Renseignez ' + missingCompanyFields.join(' et ') + ' dans Mes informations avant de continuer.'
                : undefined
            }
            style={{
              opacity: !canLaunch ? 0.55 : undefined,
              cursor: !canLaunch ? 'not-allowed' : undefined,
            }}
          >
            Continuer <Icon name="arrow" size={14}/>
          </button>
        )}
      </div>

      {confirmExcludeCertified && (
        <ExcludeCertifiedConfirmModal
          onCancel={() => setConfirmExcludeCertified(false)}
          onConfirm={() => {
            setExcludeCertified(true);
            setConfirmExcludeCertified(false);
          }}
        />
      )}
      {launched && <CampaignLaunchedModal data={launched} onClose={() => { setLaunched(null); onDone(); }}/>}
      {insufficient && (
        <InsufficientBalanceModal
          details={insufficient}
          onCancel={() => setInsufficient(null)}
          onTopup={() => { saveDraft(); }}
        />
      )}
      {launchError && (
        <LaunchErrorModal
          title={launchError.title}
          message={launchError.message}
          onClose={() => setLaunchError(null)}
        />
      )}
      {planModalOpen && plan && (
        <PlanSelectorModal
          currentPlan={plan}
          specs={planSpecs}
          capReached={capReached}
          capPlan={plan}
          cycleCount={cycleCount}
          onChoose={(p) => {
            setPlan(p);
            setPlanChosen(true);
            setPlanModalOpen(false);
            // Choisir un mode (re)démarre un cycle : le compteur côté
            // serveur a été remis à 0, on resynchronise localement.
            setCycleCount(0);
            setCapReached(false);
            const nextCap = planSpecs?.[p]?.maxCampaigns ?? (p === 'pro' ? 10 : 2);
            setCycleCap(nextCap);
          }}
          onClose={() => {
            // Refus de choisir → on retourne à l'écran précédent (campagnes)
            // pour ne pas laisser le pro saisir une campagne sans plan acté.
            if (!planChosen) onDone();
            else setPlanModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ─── Confirmation : retirer les certifié confiance de la cible ───
   Case à cocher dans l'étape Budget. Pas de toggle silencieux : on
   demande explicitement confirmation au pro pour qu'il prenne
   conscience que sa cible va se réduire. */
function ExcludeCertifiedConfirmModal({ onCancel, onConfirm }) {
  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 250,
      overflowY: 'auto',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 20px 80px',
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--paper)', borderRadius: 16, padding: 26,
        maxWidth: 460, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
        margin: 'auto 0',
      }}>
        <div className="row center gap-3" style={{ marginBottom: 14 }}>
          <span style={{
            width: 38, height: 38, borderRadius: 999,
            background: 'color-mix(in oklab, #7C3AED 14%, var(--paper))',
            color: '#7C3AED',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🤔</span>
          <div className="serif" style={{ fontSize: 20, lineHeight: 1.25 }}>
            Vraiment ?
          </div>
        </div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
          Dommage 😕 — vous passez à côté des prospects “certifié confiance”,
          les profils les plus engagés de BUUPP. Votre cible risque d'être
          réduite, et vous renoncez aux meilleurs taux d'acceptation.
        </div>
        <div className="row gap-2" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Non, je garde ce profil
          </button>
          <button
            className="btn btn-sm"
            onClick={onConfirm}
            style={{ background: '#7C3AED', color: 'white', borderColor: '#7C3AED' }}
          >
            Oui, je confirme
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Campaign launched modal — confetti + unique single-use code (RGPD art. 14) ─── */
function CampaignLaunchedModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(data.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      overflowY: 'auto',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 24px 110px', animation: 'bupp-fade-in .25s ease'
    }}>
      <ConfettiBurst />

      <div style={{
        position: 'relative', maxWidth: 520, width: '100%',
        background: 'var(--paper)', borderRadius: 18, padding: '38px 36px 32px',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        animation: 'bupp-pop-in .45s cubic-bezier(.18,1.2,.4,1)',
        margin: 'auto 0',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 18px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent) 16%, var(--paper)), color-mix(in oklab, var(--accent) 4%, var(--paper)))',
            border: '1px solid color-mix(in oklab, var(--accent) 28%, var(--line))',
            color: 'var(--accent)'
          }}>
            <span style={{ fontSize: 30 }}>🎉</span>
          </div>
          <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 10 }}>
            Félicitations !
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Votre campagne <em>{data.name}</em> vient d'être lancée.<br/>
            Vous pouvez suivre son évolution dans l'onglet <strong>Analytics</strong> de votre dashboard.
          </div>
        </div>

        {/* Unique code */}
        <div style={{
          padding: '18px 18px 16px', borderRadius: 12,
          background: 'color-mix(in oklab, var(--accent) 5%, var(--paper))',
          border: '1px dashed color-mix(in oklab, var(--accent) 30%, var(--line))',
          marginBottom: 18
        }}>
          <div className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.16em', marginBottom: 6 }}>
            Code unique de campagne
          </div>
          <div className="row between center" style={{ gap: 12 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.04em' }}>
              {data.code}
            </span>
            <button onClick={copy} className="btn btn-sm" style={{
              background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)'
            }}>
              {copied ? <><Icon name="check" size={13}/> Copié</> : <><Icon name="copy" size={13}/> Copier</>}
            </button>
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--ink-2)' }}>
            <strong>{Number(data.matched ?? 0)}</strong> prospect{Number(data.matched ?? 0) !== 1 ? 's' : ''} notifié{Number(data.matched ?? 0) !== 1 ? 's' : ''} pour cette campagne.
          </div>
        </div>

        {/* RGPD article 14 notice */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
          border: '1px solid var(--line)',
          fontSize: 12, lineHeight: 1.55, color: 'var(--ink-2)', marginBottom: 8
        }}>
          Communiquez ce code à chaque prospect afin de confirmer que vous avez bien obtenu
          ses données via la plateforme <strong>BUUPP</strong>, conformément à l'<strong>article 14
          du RGPD</strong> qui impose la communication de la source des données aux personnes concernées.
        </div>
        <div className="row center" style={{ gap: 8, fontSize: 11.5, color: 'var(--warn, #B45309)' }}>
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span><strong>Code à usage unique par sollicitation.</strong> À conserver de manière confidentielle.</span>
        </div>

        <div className="row gap-2 launched-actions" style={{ marginTop: 22 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Voir mes campagnes</button>
          <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>
            Aller au dashboard <Icon name="arrow" size={13}/>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bupp-fade-in { from {opacity:0} to {opacity:1} }
        @keyframes bupp-pop-in {
          from { opacity:0; transform: scale(.86) translateY(14px); }
          to { opacity:1; transform: scale(1) translateY(0); }
        }
        @keyframes bupp-confetti-fall {
          0% { transform: translate3d(0,-20vh,0) rotate(0deg); opacity:0; }
          8% { opacity:1; }
          100% { transform: translate3d(var(--dx, 0),110vh,0) rotate(var(--rot,720deg)); opacity:1; }
        }
      `}</style>
    </div>
  );
}

function ConfettiBurst() {
  // 60 confetti pieces with varying colors, sizes, delays, horizontal drift
  const colors = ['#4F46E5', '#F97316', '#10B981', '#FACC15', '#EC4899', '#06B6D4', '#0F1629', '#A5B4FC'];
  const pieces = React.useMemo(() => Array.from({ length: 70 }).map((_, i) => ({
    left: Math.random() * 100,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 8,
    dx: (Math.random() - 0.5) * 220 + 'px',
    rot: (Math.random() * 1440 + 360) + 'deg',
    delay: Math.random() * 0.6,
    duration: 2.4 + Math.random() * 1.6,
    shape: i % 3, // 0=rect, 1=circle, 2=ribbon
  })), []);
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1
    }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', top: 0, left: p.left + '%',
          width: p.shape === 2 ? p.size * 0.6 : p.size,
          height: p.shape === 2 ? p.size * 1.6 : p.size,
          background: p.color,
          borderRadius: p.shape === 1 ? '50%' : 2,
          ['--dx']: p.dx,
          ['--rot']: p.rot,
          animation: `bupp-confetti-fall ${p.duration}s cubic-bezier(.2,.6,.4,1) ${p.delay}s forwards`,
          opacity: 0,
        }}/>
      ))}
    </div>
  );
}

function formatRelativeFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'à l\'instant';
  if (h < 24) return `il y a ${h} h`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
}

function Contacts({ pendingContact, onPendingConsumed }) {
  const [allRows, setAllRows] = React.useState(null); // null = loading
  const [reveal, setReveal] = React.useState(null); // { relationId, field, name } | null
  // Modale de composition d'email (envoi serveur via BUUPP). Ouverte
  // quand le pro clique le bouton "email" pour un prospect qui n'a pas
  // encore atteint son quota.
  const [emailCompose, setEmailCompose] = React.useState(null); // row | null
  const [collapsed, setCollapsed] = React.useState(new Set()); // Set<campaignId>
  const [selected, setSelected] = React.useState(new Set()); // Set<relationId>
  const [groupSending, setGroupSending] = React.useState(false);
  // Mise en avant temporaire d'une ligne sélectionnée depuis le champ
  // de recherche du header — surlignage doux qui s'efface tout seul.
  const [highlightId, setHighlightId] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/contacts', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => { if (!cancelled) setAllRows(j.rows || []); })
      .catch(() => { if (!cancelled) setAllRows([]); });
    return () => { cancelled = true; };
  }, []);

  // Réception d'un pick depuis le champ de recherche du header.
  // Le parent injecte `pendingContact` au moment du dispatch (et change
  // le token à chaque clic, même sur la même cible), ce qui survit à un
  // changement de section : si Contacts vient juste d'être monté, on
  // consomme directement la valeur — désactive les filtres, déplie le
  // groupe, scroll et surligne ~2 s.
  React.useEffect(() => {
    if (!pendingContact?.id) return;
    setHighlightId(pendingContact.id);
    const camp = pendingContact.payload?.campaignId || pendingContact.payload?.campaign;
    if (camp) setCollapsed(s => { const n = new Set(s); n.delete(camp); return n; });
    setActive(new Set());
    setTimeout(() => {
      const el = document.querySelector(`[data-relation-id="${pendingContact.id}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    if (onPendingConsumed) onPendingConsumed();
    const t = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(t);
  }, [pendingContact, onPendingConsumed]);

  const FILTERS = {
    f1: { label: 'Score ≥ 720',          test: r => Number(r.score) >= 720 },
    f2: { label: "Contact atteint",      test: r => r.evaluation === 'atteint' },
    f3: { label: 'Palier 2',             test: r => Number(r.tier) === 2 },
  };

  // POST /api/pro/contacts/[relationId]/evaluation — optimistic.
  // On flip immédiatement `allRows` puis on appelle l'API ; en cas
  // d'erreur on revert et on alerte.
  const [evalSubmitting, setEvalSubmitting] = React.useState(new Set());
  const submitEvaluation = React.useCallback(async (relationId, evaluation) => {
    setAllRows(prev => (prev || []).map(r =>
      r.relationId === relationId ? { ...r, evaluation } : r
    ));
    setEvalSubmitting(s => { const n = new Set(s); n.add(relationId); return n; });
    try {
      const r = await fetch(`/api/pro/contacts/${encodeURIComponent(relationId)}/evaluation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ evaluation }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } catch (e) {
      // Revert optimistic update.
      setAllRows(prev => (prev || []).map(row =>
        row.relationId === relationId ? { ...row, evaluation: null } : row
      ));
      alert("Impossible d'enregistrer l'évaluation. Réessayez.");
    } finally {
      setEvalSubmitting(s => { const n = new Set(s); n.delete(relationId); return n; });
    }
  }, []);
  const [active, setActive] = useState(new Set());
  const toggle = (k) => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const clear = () => setActive(new Set());
  const ALL = allRows || [];
  const rows = active.size === 0 ? ALL : ALL.filter(r => [...active].every(k => FILTERS[k].test(r)));

  // Regroupement des lignes par campagne (préserve l'ordre d'arrivée).
  const groups = React.useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.campaignId || r.campaign || '—';
      if (!map.has(key)) map.set(key, { campaignId: key, campaign: r.campaign || '—', items: [] });
      map.get(key).items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const toggleCollapsed = (cid) => setCollapsed(s => {
    const n = new Set(s); n.has(cid) ? n.delete(cid) : n.add(cid); return n;
  });
  const toggleSelected = (rid) => setSelected(s => {
    const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n;
  });
  const setGroupSelected = (group, on) => setSelected(s => {
    const n = new Set(s);
    for (const item of group.items) {
      if (!item.emailAvailable) continue;
      if (on) n.add(item.relationId); else n.delete(item.relationId);
    }
    return n;
  });

  async function handleGroupMessage(group) {
    const ids = group.items
      .filter(it => it.emailAvailable && selected.has(it.relationId))
      .map(it => it.relationId);
    if (ids.length === 0) return;
    setGroupSending(true);
    try {
      const res = await fetch('/api/pro/contacts/group-reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ relationIds: ids }),
      });
      if (!res.ok) {
        alert("Impossible de récupérer les emails. Réessayez.");
        return;
      }
      const j = await res.json();
      const emails = (j.items || []).map(x => x.email).filter(Boolean);
      const skipped = ids.length - emails.length;
      if (emails.length === 0) {
        alert("Aucun email disponible parmi les prospects sélectionnés.");
        return;
      }
      if (skipped > 0) {
        alert(`${skipped} prospect${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''} (email non partagé).`);
      }
      // Hardening anti-fuite :
      //  - `to:` = email du pro lui-même → garantit que le mail part même
      //    sur les clients/serveurs SMTP qui refusent un To: vide.
      //  - `bcc:` = tous les prospects → chacun reçoit le mail sans voir
      //    les autres destinataires (protocole SMTP).
      //  - Body pré-rempli avec un rappel pour dissuader le pro de
      //    déplacer les destinataires de BCC vers TO/CC.
      const bcc = emails.map(encodeURIComponent).join(',');
      const toAddr = encodeURIComponent(j.proEmail || '');
      const subject = encodeURIComponent('Message — BUUPP');
      const body = encodeURIComponent(
        '\n\n— — — — — — — — — — — — — — — — — — — — — — — — — —\n' +
        "Envoi groupé via BUUPP — chaque destinataire est en Cci :\n" +
        "il ne verra pas les emails des autres prospects.\n" +
        "Ne déplacez pas les adresses dans « À » ou « Cc » avant\n" +
        "d'envoyer : cela exposerait les emails de tous à tous, ce qui\n" +
        "constitue une fuite de données personnelles (RGPD).\n" +
        "Rédigez votre message au-dessus de cette ligne.\n"
      );
      window.location.href =
        `mailto:${toAddr}?bcc=${bcc}&subject=${subject}&body=${body}`;
    } catch {
      alert("Impossible de récupérer les emails. Réessayez.");
    } finally {
      setGroupSending(false);
    }
  }

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Mes contacts" title="Prospects ayant accepté" desc="Coordonnées accessibles dans l'interface uniquement — watermarking appliqué à chaque fiche." action={
        <button className="btn btn-ghost btn-sm" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled><Icon name="lock" size={12}/> Export CSV indisponible</button>
      }/>

      {/* Filters bar */}
      <div className="card" style={{ padding: 18 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="row center gap-3">
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ivory-2)', color: 'var(--ink-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="filter" size={14}/>
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Filtres combinés</div>
              <div className="muted" style={{ fontSize: 12 }}>Activez plusieurs filtres simultanément pour affiner vos prospects.</div>
            </div>
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
            {rows.length} / {ALL.length} prospect{rows.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {Object.entries(FILTERS).map(([k, f]) => {
            const on = active.has(k);
            return (
              <button key={k} onClick={() => toggle(k)} style={{
                padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                background: on ? 'var(--accent)' : 'var(--paper)',
                color: on ? 'white' : 'var(--ink)',
                border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line-2)'),
                boxShadow: on ? '0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent)' : 'none',
                cursor: 'pointer', transition: 'all .15s'
              }}>
                {on && <span style={{ marginRight: 6 }}>✓</span>}
                {k.toUpperCase()} · {f.label}
              </button>
            );
          })}
          <button onClick={clear} style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
            background: active.size === 0 ? 'var(--ink)' : 'var(--paper)',
            color: active.size === 0 ? 'var(--paper)' : 'var(--ink-3)',
            border: '1.5px solid ' + (active.size === 0 ? 'var(--ink)' : 'var(--line-2)'),
            cursor: 'pointer', transition: 'all .15s', marginLeft: 'auto'
          }}>
            <Icon name="close" size={11}/> Sans filtre
          </button>
        </div>
      </div>

      {allRows === null && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
        </div>
      )}

      {allRows !== null && rows.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {allRows.length === 0
              ? "Aucun prospect n'a encore accepté de mise en relation."
              : "Aucun prospect ne correspond aux filtres activés."}
          </div>
        </div>
      )}

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.campaignId);
        const emailableIds = group.items.filter(it => it.emailAvailable).map(it => it.relationId);
        const selectedInGroup = emailableIds.filter(id => selected.has(id));
        const allSelected = emailableIds.length > 0 && selectedInGroup.length === emailableIds.length;
        const someSelected = selectedInGroup.length > 0 && !allSelected;
        return (
          <div key={group.campaignId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="row between"
              style={{
                padding: '14px 18px',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--line)',
              }}
            >
              <button
                onClick={() => toggleCollapsed(group.campaignId)}
                className="row center gap-3"
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  textAlign: 'left', minWidth: 0, flex: '1 1 240px',
                }}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Déplier' : 'Replier'}
              >
                <span style={{
                  display: 'inline-flex', width: 24, height: 24, borderRadius: 6,
                  background: 'var(--ivory-2)', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--ink-3)',
                  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                  transition: 'transform .15s',
                }}>
                  <Icon name="arrow" size={12}/>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 16, lineHeight: 1.2 }}>{group.campaign}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {group.items.length} prospect{group.items.length > 1 ? 's' : ''}
                    {selectedInGroup.length > 0 && ` · ${selectedInGroup.length} sélectionné${selectedInGroup.length > 1 ? 's' : ''}`}
                  </div>
                </div>
              </button>
              <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setGroupSelected(group, !allSelected)}
                  disabled={emailableIds.length === 0}
                  style={{ opacity: emailableIds.length === 0 ? 0.4 : 1 }}
                  title={emailableIds.length === 0 ? 'Aucun email partagé dans ce groupe' : (allSelected ? 'Tout désélectionner' : 'Sélectionner tous')}
                >
                  {allSelected ? 'Tout désélectionner' : someSelected ? 'Tout sélectionner' : 'Sélectionner tous'}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => handleGroupMessage(group)}
                  disabled={selectedInGroup.length === 0 || groupSending}
                  style={{
                    background: selectedInGroup.length === 0 ? 'var(--ivory-2)' : 'var(--ink)',
                    color: selectedInGroup.length === 0 ? 'var(--ink-4)' : 'var(--paper)',
                    cursor: selectedInGroup.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Icon name="email" size={12}/>
                  Message groupé{selectedInGroup.length > 0 ? ` (${selectedInGroup.length})` : ''}
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="tbl-scroll tbl-scroll-flush">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        aria-label="Tout sélectionner dans cette campagne"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={(e) => setGroupSelected(group, e.target.checked)}
                        disabled={emailableIds.length === 0}
                      />
                    </th>
                    <th>Prospect</th><th>Score</th><th>Palier</th><th>Email</th><th>Téléphone</th><th>Reçu</th><th>Évaluation</th><th style={{ textAlign: 'right' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {group.items.map((r, i) => {
                      const isChecked = selected.has(r.relationId);
                      const isHi = r.relationId === highlightId;
                      return (
                        <tr
                          key={r.relationId || i}
                          data-relation-id={r.relationId}
                          style={isHi ? {
                            background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
                            transition: 'background .4s',
                          } : undefined}
                        >
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Sélectionner ${r.name}`}
                              checked={isChecked}
                              onChange={() => toggleSelected(r.relationId)}
                              disabled={!r.emailAvailable}
                              title={r.emailAvailable ? '' : "Email non partagé — sélection désactivée"}
                            />
                          </td>
                          <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                          <td className="mono tnum">{r.score}</td>
                          <td><span className="chip">P{r.tier}</span></td>
                          <td className="mono" style={{ fontSize: 12 }}>{r.email}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{r.telephone}</td>
                          <td className="muted mono" style={{ fontSize: 12 }}>{formatRelativeFr(r.receivedAt)}</td>
                          <td>
                            {(() => {
                              const busy = evalSubmitting.has(r.relationId);
                              if (r.evaluation === 'atteint') {
                                return (
                                  <div className="row gap-1 center" style={{ flexWrap: 'wrap' }}>
                                    <span className="chip chip-good">✓ Atteint</span>
                                    <button
                                      type="button"
                                      className="chip"
                                      onClick={() => submitEvaluation(r.relationId, null)}
                                      disabled={busy}
                                      title="Réinitialiser l'évaluation"
                                      style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, fontSize: 10 }}
                                    >
                                      ↺
                                    </button>
                                  </div>
                                );
                              }
                              if (r.evaluation === 'non_atteint') {
                                return (
                                  <div className="row gap-1 center" style={{ flexWrap: 'wrap' }}>
                                    <span className="chip chip-warn">Non atteint</span>
                                    <button
                                      type="button"
                                      className="chip"
                                      onClick={() => submitEvaluation(r.relationId, null)}
                                      disabled={busy}
                                      title="Réinitialiser l'évaluation"
                                      style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, fontSize: 10 }}
                                    >
                                      ↺
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="chip"
                                    onClick={() => submitEvaluation(r.relationId, 'atteint')}
                                    disabled={busy}
                                    title="Vous avez joint le prospect (échange constructif)"
                                    style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
                                  >
                                    Atteint
                                  </button>
                                  <button
                                    type="button"
                                    className="chip"
                                    onClick={() => submitEvaluation(r.relationId, 'non_atteint')}
                                    disabled={busy}
                                    title="Le prospect n'a pas répondu à vos sollicitations"
                                    style={{ cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
                                  >
                                    Non atteint
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <ContactActionButtons row={r} onIntent={(intent) => {
                              // L'email passe par la modale de composition
                              // intégrée à BUUPP (envoi serveur, quota 1/campagne).
                              // Les autres canaux ouvrent toujours le client externe
                              // via le RevealContactModal historique.
                              if (intent === 'email') {
                                if ((r.emailsSent ?? 0) >= 1) return; // quota atteint
                                setEmailCompose(r);
                                return;
                              }
                              // Click-to-call : on enregistre l'intention en base
                              // (audit) avant que le RevealContactModal n'ouvre
                              // tel:// dans le navigateur. Fire-and-forget : on
                              // ne bloque pas l'UX si l'audit échoue.
                              if (intent === 'call' || intent === 'sms' || intent === 'whatsapp') {
                                if (intent === 'call') {
                                  fetch(`/api/pro/contacts/${r.relationId}/call-log`, {
                                    method: 'POST',
                                  }).catch(() => {});
                                }
                              }
                              setReveal({ relationId: r.relationId, intent, name: r.name });
                            }}/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <div className="card" style={{ padding: 16, background: 'var(--ivory-2)', borderStyle: 'dashed' }}>
        <div className="row center gap-3">
          <Icon name="shield" size={16}/>
          <div style={{ fontSize: 13 }}>
            <strong>Politique d'usage.</strong> <span className="muted">Les coordonnées sont watermarquées individuellement. Toute diffusion hors périmètre de la campagne déclenchera une enquête automatique et peut entraîner la résiliation du compte.</span>
          </div>
        </div>
      </div>

      {reveal && (
        <RevealContactModal
          relationId={reveal.relationId}
          intent={reveal.intent}
          name={reveal.name}
          onClose={() => setReveal(null)}
        />
      )}

      {emailCompose && (
        <EmailComposerModal
          row={emailCompose}
          onClose={() => setEmailCompose(null)}
          onSent={() => {
            // Optimistic update : marque le quota atteint sur la ligne
            // pour que le bouton se grise immédiatement sans attendre
            // un re-fetch complet.
            setAllRows((rows) =>
              rows ? rows.map((x) =>
                x.relationId === emailCompose.relationId
                  ? { ...x, emailsSent: (x.emailsSent ?? 0) + 1 }
                  : x,
              ) : rows,
            );
            setEmailCompose(null);
          }}
        />
      )}
    </div>
  );
}

// Métadonnées par "intent" — chaque bouton d'action déclenche un reveal
// puis ouvre une URL externe (tel, mailto, sms, wa.me, recherche FB/LI).
const REVEAL_INTENTS = {
  call:     { field: 'telephone', icon: 'phone',    title: 'Contacter',                  cta: 'Appeler maintenant',           build: v => `tel:${v.replace(/[^\d+]/g, '')}`,                                                          valuePresentation: 'mono' },
  email:    { field: 'email',     icon: 'email',    title: 'Écrire à',                   cta: 'Ouvrir mon mail',              build: v => `mailto:${encodeURIComponent(v)}`,                                                          valuePresentation: 'mono' },
  sms:      { field: 'telephone', icon: 'sms',      title: 'Envoyer un SMS à',           cta: 'Ouvrir mes SMS',               build: v => `sms:${v.replace(/[^\d+]/g, '')}`,                                                          valuePresentation: 'mono' },
  whatsapp: { field: 'telephone', icon: 'whatsapp', title: 'WhatsApp avec',              cta: 'Ouvrir WhatsApp',              build: v => `https://wa.me/${v.replace(/\D/g, '')}`,                                                    valuePresentation: 'mono' },
  facebook: { field: 'name',      icon: 'facebook', title: 'Trouver sur Facebook —',     cta: 'Rechercher sur Facebook',      build: v => `https://www.facebook.com/search/top/?q=${encodeURIComponent(v).replace(/%20/g, '+')}`,        valuePresentation: 'serif' },
  linkedin: { field: 'name',      icon: 'linkedin', title: 'Trouver sur LinkedIn —',     cta: 'Rechercher sur LinkedIn',      build: v => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(v)}`,         valuePresentation: 'serif' },
};

function ContactActionButtons({ row, onIntent }) {
  // Quand un bouton n'est pas actionnable (donnée non partagée, quota
  // atteint, canal désactivé), on N'oblige PAS le bouton à être grisé
  // et silencieux : on l'affiche normalement et un clic ouvre une
  // popup explicative qui renvoie aux CGU. Avantage UX : le pro
  // comprend pourquoi l'action n'est pas disponible plutôt que de
  // tomber sur un bouton "mort" qui ne réagit pas.
  const [infoModal, setInfoModal] = React.useState(null);
  // {title, body} ou null

  const channels = Array.isArray(row.campaignChannels) ? row.campaignChannels : null;
  const channelAllowed = (k) => channels === null || channels.includes(k);
  const phoneOk = !!row.telephoneAvailable;
  const emailOk = !!row.emailAvailable;
  // Quota email atteint (1 envoi max par campagne) → popup explicative.
  const emailQuotaReached = (row.emailsSent ?? 0) >= 1;
  // Pour FB/LI : on a toujours au moins le prénom (on travaille sur des
  // relations acceptées), donc la donnée "name" est toujours dispo.
  const buttons = [
    // `disabledReason` permet de distinguer la raison réelle du désactivement
    // pour afficher un tooltip cohérent : 'data' (donnée pas partagée),
    // 'quota' (limite d'envoi atteinte) ou null (bouton actif).
    {
      key: 'call', channel: 'phone',
      enabled: phoneOk && channelAllowed('phone'),
      disabledReason: !phoneOk ? 'data' : null,
      icon: 'phone', color: '#0F1629',
      title: 'Appeler ce prospect',
      missingDataMsg: "Le prospect n'a pas partagé son téléphone",
    },
    {
      key: 'email', channel: 'email',
      enabled: emailOk && channelAllowed('email') && !emailQuotaReached,
      // Si l'email n'est pas partagé → 'data'. S'il l'est mais le quota
      // est atteint → 'quota'. Sinon le bouton est actif.
      disabledReason: !emailOk ? 'data' : (emailQuotaReached ? 'quota' : null),
      icon: 'email', color: '#EA4335',
      title: emailQuotaReached ? 'Quota atteint (1 email envoyé)' : 'Envoyer un email via BUUPP',
      missingDataMsg: "Le prospect n'a pas partagé son email",
    },
    {
      key: 'sms', channel: 'sms',
      enabled: phoneOk && channelAllowed('sms'),
      disabledReason: !phoneOk ? 'data' : null,
      icon: 'sms', color: '#34B7F1',
      title: 'Envoyer un SMS',
      missingDataMsg: "Le prospect n'a pas partagé son téléphone",
    },
    {
      key: 'whatsapp', channel: 'whatsapp',
      enabled: phoneOk && channelAllowed('whatsapp'),
      disabledReason: !phoneOk ? 'data' : null,
      icon: 'whatsapp', color: '#25D366',
      title: 'Écrire sur WhatsApp',
      missingDataMsg: "Le prospect n'a pas partagé son téléphone",
    },
    {
      key: 'facebook', channel: 'facebook',
      enabled: channelAllowed('facebook'),
      disabledReason: null,
      icon: 'facebook', color: '#1877F2',
      title: 'Rechercher sur Facebook',
      missingDataMsg: '',
    },
    {
      key: 'linkedin', channel: 'linkedin',
      enabled: channelAllowed('linkedin'),
      disabledReason: null,
      icon: 'linkedin', color: '#0A66C2',
      title: 'Rechercher sur LinkedIn',
      missingDataMsg: '',
    },
  ];
  // Compose le contenu de la popup d'info selon la raison pour laquelle
  // le bouton n'est pas actionnable. Tous les messages renvoient aux CGU.
  function infoForButton(b, channelOff) {
    if (channelOff) {
      return {
        title: 'Canal non activé pour cette campagne',
        body: "Ce canal de contact n'a pas été activé lors de la configuration de votre campagne. Pour l'utiliser, créez une nouvelle campagne en cochant ce canal à l'étape « Objectif & canaux ».",
      };
    }
    if (b.disabledReason === 'quota' && b.key === 'email') {
      return {
        title: 'Quota d’envoi atteint',
        body: "Vous avez déjà envoyé un e-mail à ce prospect pour cette campagne. Pour préserver son expérience et éviter le harcèlement, BUUPP limite à « 1 envoi par campagne et par prospect ».",
      };
    }
    if (b.disabledReason === 'data') {
      const what =
        b.channel === 'phone' || b.channel === 'sms' || b.channel === 'whatsapp'
          ? 'son numéro de téléphone'
          : b.channel === 'email'
          ? 'son adresse e-mail'
          : 'cette information';
      return {
        title: 'Donnée non partagée par le prospect',
        body: `Le prospect n’a pas partagé ${what} pour cette campagne. Vous ne pouvez donc pas le contacter par ce canal. Sur BUUPP, chaque donnée révélée est conditionnée à l’accord explicite du prospect.`,
      };
    }
    return null;
  }

  return (
    <>
      <div className="row gap-1" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {buttons.map((b) => {
          const channelOff = !channelAllowed(b.channel);
          const info = infoForButton(b, channelOff);
          // Le bouton reste TOUJOURS visible et cliquable. Un clic
          // déclenche soit l’action normale (`onIntent`), soit la popup
          // d’info quand la donnée/quota/canal bloque l’action.
          const handleClick = () => {
            if (info) {
              setInfoModal(info);
            } else {
              onIntent(b.key);
            }
          };
          // Visuel : couleur normale toujours, mais opacité réduite et
          // curseur "help" quand l’action n'est pas réellement faisable
          // — signal subtil mais pas bloquant.
          return (
            <button
              key={b.key}
              className="btn btn-ghost btn-sm"
              style={{
                padding: '4px 8px',
                opacity: info ? 0.55 : 1,
                cursor: info ? 'help' : 'pointer',
                color: b.color,
              }}
              title={info ? info.title : b.title}
              onClick={handleClick}
            >
              <Icon name={b.icon} size={12}/>
            </button>
          );
        })}
      </div>
      {infoModal && (
        <ActionInfoModal info={infoModal} onClose={() => setInfoModal(null)}/>
      )}
    </>
  );
}

function ActionInfoModal({ info, onClose }) {
  // Fermeture par Escape pour cohérence avec les autres modales du site.
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portail vers <body> de l'iframe prototype : sort la modale de tout
  // ancestor (cellule du tableau, conteneur scrollable, etc.) qui aurait
  // pu casser `position: fixed` via un transform / overflow / contain.
  // C'est la cause racine de la modale qui débordait à droite en mobile :
  // un parent du <td> action contraignait la largeur disponible.
  const modalNode = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-info-title"
        style={{ width: '100%', maxWidth: 440, padding: 24 }}
      >
        {/* En-tête : icône + titre alignés, croix de fermeture à droite —
            même pattern que RevealContactModal pour rester cohérent. */}
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
            <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: 'var(--ink-3)', lineHeight: 0 }}>
              <Icon name="alert" size={16}/>
            </span>
            <h3
              id="action-info-title"
              className="serif"
              style={{
                fontSize: 18, lineHeight: 1.3, margin: 0, color: 'var(--ink)',
                wordBreak: 'break-word', hyphens: 'auto',
              }}
            >
              {info.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Fermer"
            style={{ flexShrink: 0 }}
          >
            <Icon name="close" size={12}/>
          </button>
        </div>

        {/* Corps du message. */}
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-3)', margin: 0 }}>
          {info.body}
        </p>

        {/* Référence CGU. */}
        <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 14, marginBottom: 0 }}>
          cf.{' '}
          <a
            href="/cgu"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            CGU de BUUPP
          </a>
        </p>

        {/* CTA aligné à droite. */}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            onClick={onClose}
            className="btn"
            style={{
              background: 'var(--ink)', color: 'var(--paper)',
              padding: '10px 18px', borderRadius: 8, fontWeight: 500,
              fontSize: 14, border: 0, cursor: 'pointer', minWidth: 120,
            }}
          >
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>
  );

  // ReactDOM.createPortal n'est dispo que côté navigateur. SSR-safe.
  if (typeof document === 'undefined') return modalNode;
  return ReactDOM.createPortal(modalNode, document.body);
}

function RevealContactModal({ relationId, intent, name, onClose }) {
  const [status, setStatus] = React.useState('loading'); // 'loading' | 'ok' | 'not_shared' | 'error'
  const [value, setValue] = React.useState(null);
  const meta = REVEAL_INTENTS[intent] || REVEAL_INTENTS.call;
  const field = meta.field;

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/pro/contacts/${relationId}/reveal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field }),
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) { setStatus('not_shared'); return; }
        if (!r.ok) { setStatus('error'); return; }
        const j = await r.json();
        setValue(j.value);
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [relationId, field]);

  const ctaHref = value ? meta.build(value) : '#';
  const ctaLabel = meta.cta;
  const iconName = meta.icon;
  const title = `${meta.title} ${name}`;
  const isExternalLink = ctaHref.startsWith('http');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 420, padding: 24 }}
      >
        <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
          <div className="row center gap-2">
            <Icon name={iconName} size={16}/>
            <span className="serif" style={{ fontSize: 18 }}>{title}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer">
            <Icon name="close" size={12}/>
          </button>
        </div>

        {status === 'loading' && (
          <div className="muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Récupération du contact…
          </div>
        )}

        {status === 'ok' && (
          <>
            <div
              className={meta.valuePresentation === 'serif' ? 'serif' : 'mono'}
              style={{ fontSize: meta.valuePresentation === 'serif' ? 24 : 22, padding: '20px 0', textAlign: 'center', userSelect: 'text', wordBreak: 'break-all' }}
            >
              {value}
            </div>
            <a
              href={ctaHref}
              target={isExternalLink ? '_blank' : undefined}
              rel={isExternalLink ? 'noopener noreferrer' : undefined}
              className="btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--ink)', color: 'var(--paper)', textDecoration: 'none',
                padding: '10px 16px', borderRadius: 8, fontWeight: 500,
              }}
            >
              <Icon name={iconName} size={14}/> {ctaLabel}
            </a>
            {field === 'email' ? (
              <div className="muted" style={{ fontSize: 11, marginTop: 14, textAlign: 'left', lineHeight: 1.5 }}>
                ⓘ <strong>Alias unique BUUPP.</strong> Cet email est un alias propre
                à cette relation : tout message envoyé à cette adresse est routé
                vers le vrai email du prospect. Si le prospect reçoit un mail venant
                d'une autre source, il remontera instantanément à votre compte.
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 11, marginTop: 14, textAlign: 'center' }}>
                ⓘ Cet accès a été enregistré dans votre historique de consultations.
              </div>
            )}
            <div
              role="alert"
              style={{
                fontSize: 11,
                marginTop: 10,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'color-mix(in oklab, #B91C1C 10%, transparent)',
                border: '1px solid color-mix(in oklab, #B91C1C 30%, transparent)',
                color: '#B91C1C',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                textAlign: 'left',
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <Icon name="alert" size={14}/>
              </span>
              <span>L'accès aux informations des prospects est loggé pour des raisons d'audit et de traçabilité. Une seule sollicitation par prospect est autorisée conformément aux CGV de BUUPP.</span>
            </div>
          </>
        )}

        {status === 'not_shared' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Le prospect n'a pas partagé ce contact pour cette campagne.</div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
              Fermer
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Impossible de récupérer le contact. Réessayez.</div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Templates email pré-remplis par type de campagne ─────────────
   Chaque objectif (campaign.targeting.objectiveId) propose 1-2
   templates de départ. Le pro clique un template, ça remplit subject +
   body, il édite ensuite. Tokens supportés dans body :
     {{prenom}} → prénom du prospect (ou "vous" si inconnu)
     {{pro}}   → raison sociale du pro
     {{camp}}  → nom de la campagne
   Les tokens sont remplacés au clic d'application, pas à l'envoi
   (l'API reçoit le texte déjà résolu côté front). */
const EMAIL_TEMPLATES_BY_OBJECTIVE = {
  contact: [
    {
      label: "Premier contact — neutre",
      subject: "Suite à votre acceptation sur BUUPP",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Merci d'avoir accepté notre sollicitation dans le cadre de la campagne « {{camp}} ».\n\n"
        + "Je reviens vers vous pour échanger plus en détail sur vos besoins et voir comment {{pro}} peut vous aider concrètement.\n\n"
        + "Quel serait le meilleur moment pour échanger ?\n\n"
        + "Très bonne journée,",
    },
  ],
  rdv: [
    {
      label: "Proposition de RDV",
      subject: "Fixons un rendez-vous — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Suite à votre acceptation de la campagne « {{camp}} », je vous propose un échange pour avancer concrètement.\n\n"
        + "Quelques créneaux que je peux vous réserver cette semaine :\n"
        + "  • Mardi 10h – 11h\n"
        + "  • Jeudi 14h – 15h\n"
        + "  • Vendredi 16h – 17h\n\n"
        + "Vous pouvez aussi me proposer un autre horaire qui vous arrange — je m'adapte.\n\n"
        + "À très bientôt,",
    },
  ],
  evt: [
    {
      label: "Invitation à un événement",
      subject: "Invitation — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Merci d'avoir manifesté votre intérêt pour notre campagne « {{camp}} » !\n\n"
        + "Comme convenu, voici le détail de l'événement auquel vous êtes convié(e) :\n\n"
        + "  📅 Date :\n"
        + "  📍 Lieu :\n"
        + "  ⏰ Horaire :\n\n"
        + "Merci de confirmer votre présence en répondant simplement à ce mail. Au plaisir de vous y retrouver !\n\n"
        + "Cordialement,",
    },
  ],
  dl: [
    {
      label: "Envoi du contenu téléchargeable",
      subject: "Votre contenu BUUPP — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Merci de l'intérêt que vous portez à la campagne « {{camp}} » !\n\n"
        + "Vous trouverez ci-dessous le lien pour télécharger le contenu :\n"
        + "  → [insérer le lien ici]\n\n"
        + "N'hésitez pas à me dire ce que vous en pensez — vos retours nous aident à améliorer nos prochains contenus.\n\n"
        + "Bonne lecture,",
    },
  ],
  devis: [
    {
      label: "Demande d'informations pour devis",
      subject: "Préparons votre devis — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Merci d'avoir accepté notre proposition de devis dans le cadre de la campagne « {{camp}} ».\n\n"
        + "Pour préparer une estimation précise, j'aurais besoin de quelques informations :\n"
        + "  • Votre besoin principal :\n"
        + "  • Vos contraintes (délai, budget approximatif) :\n"
        + "  • Le meilleur moyen de vous joindre (téléphone, email) :\n\n"
        + "Une fois ces éléments en main, je vous reviens sous 48 h avec une proposition chiffrée.\n\n"
        + "Bien à vous,",
    },
  ],
  survey: [
    {
      label: "Lancement du sondage",
      subject: "Votre avis compte — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n"
        + "Merci d'avoir accepté de participer à notre sondage dans le cadre de « {{camp}} ».\n\n"
        + "Le questionnaire prend environ 5 minutes :\n"
        + "  → [insérer le lien]\n\n"
        + "Vos réponses sont entièrement anonymes et nous aideront à mieux comprendre vos besoins.\n\n"
        + "Merci d'avance pour votre temps !",
    },
  ],
};

function applyTemplateTokens(text, { prenom, pro, camp }) {
  return text
    .replaceAll('{{prenom}}', (prenom || '').trim() || 'vous')
    .replaceAll('{{pro}}', (pro || '').trim() || 'BUUPP')
    .replaceAll('{{camp}}', (camp || '').trim() || 'la campagne en cours');
}

/* ─── EmailComposerModal — envoi serveur via BUUPP ──────────────────
   Ouverte depuis l'onglet Contacts au clic du bouton "email" sur une
   ligne non bloquée par le quota. Le pro saisit objet + message, l'envoi
   passe par /api/pro/contacts/[id]/email (template HTML BUUPP, Reply-To
   = email du pro). Le quota 1 email par campagne est appliqué côté API,
   l'UI cache simplement le bouton après envoi.

   Conformité RGPD : le pro ne voit JAMAIS l'email du prospect dans
   cette modale — il est résolu serveur-side. Le prospect garde son
   adresse cachée, et toute réponse est routée par Reply-To. */
function EmailComposerModal({ row, onClose, onSent }) {
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  // Templates disponibles selon le type de campagne. Si l'objectiveId
  // n'est pas reconnu, on retombe sur les templates "contact" génériques.
  const templates = React.useMemo(() => {
    const obj = row.campaignObjective || 'contact';
    return EMAIL_TEMPLATES_BY_OBJECTIVE[obj] || EMAIL_TEMPLATES_BY_OBJECTIVE.contact;
  }, [row.campaignObjective]);
  // Sépare le prénom du masque "Prénom N." pour l'utiliser dans les
  // tokens. row.name est de la forme "Marie L." → prénom = "Marie".
  const prospectFirstName = ((row.name || '').split(/\s+/)[0] || '').replace(/\.$/, '');
  const applyTemplate = (tpl) => {
    setSubject(applyTemplateTokens(tpl.subject, {
      prenom: prospectFirstName,
      pro: row.proName || '',
      camp: row.campaign || '',
    }));
    setBody(applyTemplateTokens(tpl.body, {
      prenom: prospectFirstName,
      pro: row.proName || '',
      camp: row.campaign || '',
    }));
  };
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Ferme sur Escape — UX standard.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const submit = async () => {
    const subj = subject.trim();
    const bod = body.trim();
    if (!subj) { setError("L'objet est requis."); return; }
    if (!bod) { setError("Le message ne peut pas être vide."); return; }
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/pro/contacts/${row.relationId}/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: subj, body: bod }),
      });
      if (r.ok) {
        if (onSent) onSent();
        return;
      }
      const j = await r.json().catch(() => null);
      const codeMap = {
        quota_reached: 'Vous avez déjà envoyé un email à ce prospect pour cette campagne.',
        prospect_email_missing: "Le prospect n'a pas partagé son email.",
        relation_not_accepted: "Cette relation n'est plus active.",
        forbidden: 'Action non autorisée sur ce contact.',
        subject_too_long: "L'objet est trop long (200 caractères max).",
        body_too_long: 'Le message est trop long (10 000 caractères max).',
        pro_email_missing: "Votre email Clerk est introuvable.",
      };
      setError(codeMap[String(j?.error ?? '')] ?? 'Échec — réessayez.');
    } catch {
      setError('Erreur réseau — réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1000, padding: '40px 20px 60px', overflowY: 'auto',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 560, padding: 26 }}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 20 }}>Envoyer un email à {row.name}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer" disabled={sending}>
            <Icon name="close" size={12}/>
          </button>
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 14,
          background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
          border: '1px solid color-mix(in oklab, var(--accent) 24%, var(--line))',
          fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)',
        }}>
          <strong style={{ color: 'var(--ink) ' }}>Envoi via BUUPP.</strong>{' '}
          Votre message part depuis nos serveurs avec votre adresse en
          <em> Reply-To</em> — le prospect répondra directement chez vous.
          L'adresse email du prospect reste cachée. Quota : 1 envoi par campagne.
        </div>

        {/* Sélecteur de template adapté à l'objectif de la campagne */}
        {templates.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, letterSpacing: '.12em' }}>
              Templates suggérés
            </div>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {templates.map((tpl, i) => (
                <button key={i} type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="btn btn-ghost btn-sm"
                  disabled={sending}
                  style={{
                    fontSize: 12,
                    border: '1px solid var(--line)',
                    padding: '6px 12px',
                  }}>
                  <Icon name="sparkle" size={11}/> {tpl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="label" style={{ marginBottom: 4, display: 'block' }}>Objet</label>
        <input
          type="text"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, 200))}
          maxLength={200}
          placeholder="Ex. : Suite à votre intérêt pour notre cuisine sur-mesure"
          style={{ width: '100%', fontSize: 14, padding: '10px 12px', marginBottom: 14 }}
          disabled={sending}
          autoFocus/>

        <label className="label" style={{ marginBottom: 4, display: 'block' }}>
          Message
          <span className="mono muted" style={{ float: 'right', fontSize: 11 }}>{body.length} / 10000</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 10000))}
          rows={9}
          maxLength={10000}
          placeholder={`Bonjour,\n\nMerci d'avoir accepté ma sollicitation. Je vous recontacte pour…`}
          style={{
            width: '100%', padding: 10, borderRadius: 8,
            border: '1px solid var(--line)', background: 'var(--paper)',
            fontFamily: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 6,
          }}
          disabled={sending}/>

        <div className="muted" style={{ fontSize: 11, marginBottom: 14, lineHeight: 1.45 }}>
          Votre message sera intégré dans un email aux couleurs BUUPP, en mentionnant la campagne {row.campaign ? <><em>«&nbsp;{row.campaign}&nbsp;»</em></> : 'concernée'}.
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 12,
            background: 'color-mix(in oklab, var(--danger) 8%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--danger) 30%, var(--line))',
            color: 'var(--danger)', fontSize: 13,
          }}>{error}</div>
        )}

        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={sending}>
            Annuler
          </button>
          <button onClick={submit} className="btn btn-primary btn-sm"
            disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? 'Envoi…' : 'Envoyer via BUUPP'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  const [data, setData] = React.useState(null);
  // Filtres : 'all' = pas de filtre. campaignId = UUID d'une campagne.
  // period = '7d' | '30d' | '90d' | 'all'.
  const [campaignFilter, setCampaignFilter] = React.useState('all');
  const [periodFilter, setPeriodFilter] = React.useState('all');
  // Loading distinct du data===null pour éviter le clignotement à chaque
  // changement de filtre (on garde l'ancien rendu en arrière-plan).
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (campaignFilter !== 'all') params.set('campaignId', campaignFilter);
    if (periodFilter !== 'all') params.set('period', periodFilter);
    const qs = params.toString();
    const url = qs ? `/api/pro/analytics?${qs}` : '/api/pro/analytics';
    fetch(url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) { setData(j); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [campaignFilter, periodFilter]);

  const campaigns = data?.campaigns || [];
  const empty = !data || data.sampleSize?.wins === 0;
  const acceptance = data?.acceptanceByTier || [
    {tier:1,label:'Identification',pct:0},{tier:2,label:'Localisation',pct:0},
    {tier:3,label:'Style de vie',pct:0},{tier:4,label:'Pro',pct:0},
    {tier:5,label:'Patrimoine',pct:0},
  ];
  const geo = data?.geoBreakdown || [];
  const ages = data?.ageBreakdown || [];
  const sex = data?.sexBreakdown || [
    {label:'Femmes',pct:0},{label:'Hommes',pct:0},{label:'Autre / non précisé',pct:0},
  ];

  // Nombre d'acceptations sur lequel reposent les agrégats — utile pour
  // contextualiser les pourcentages (3 wins ⇒ chaque ligne ≈ 33 %).
  const winsTotal = data?.sampleSize?.wins ?? 0;

  // Sous-titre dynamique : reflète les filtres actifs pour ne PAS
  // mentir sur le périmètre des chiffres affichés (cf. correctif
  // 74b1cf8 qui avait déjà supprimé le faux "30 derniers jours").
  function describeScope() {
    const periodLabel = ({
      all: "depuis l'ouverture du compte",
      '7d': 'sur les 7 derniers jours',
      '30d': 'sur les 30 derniers jours',
      '90d': 'sur les 90 derniers jours',
    })[periodFilter] || "depuis l'ouverture du compte";
    if (campaignFilter === 'all') {
      return `Analyses cumulées ${periodLabel} · calculées sur ${winsTotal} acceptation${winsTotal > 1 ? 's' : ''}`;
    }
    const camp = campaigns.find(c => c.id === campaignFilter);
    const campLabel = camp ? `« ${camp.name} »` : 'la campagne sélectionnée';
    return `Analyses de ${campLabel} ${periodLabel} · calculées sur ${winsTotal} acceptation${winsTotal > 1 ? 's' : ''}`;
  }

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Analytics" title="Performance fine" desc={empty
        ? (loading ? "Chargement…" : "Aucune mise en relation acceptée pour ce périmètre — modifiez les filtres pour élargir la sélection.")
        : describeScope()}/>

      {/* Filtres : campagne + période. Responsive : 2 colonnes en
          desktop, empilés sur mobile (≤640px) via grid auto-fit. */}
      <div
        className="card analytics-filters"
        style={{
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="mono caps muted" style={{ fontSize: 10, letterSpacing: '0.08em' }}>
            Campagne
          </span>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="all">Toutes les campagnes</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="mono caps muted" style={{ fontSize: 10, letterSpacing: '0.08em' }}>
            Période
          </span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="all">Tout l&apos;historique</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
          </select>
        </label>
      </div>
      <div style={{
        display: 'grid',
        // Auto-fit : 2 colonnes côte à côte si ≥720px de large, sinon
        // empilement vertical (1 colonne pleine largeur).
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
        gap: 20,
      }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Taux d'acceptation par palier</div>
          {acceptance.map(r => (
            <div key={r.tier} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r.tier}</span> {r.label}</span>
                <span className="mono tnum">{r.pct}%</span>
              </div>
              <Progress value={r.pct/100}/>
            </div>
          ))}
        </div>
        <div className="card analytics-creneaux" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Meilleurs créneaux</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
            Concentration des acceptations heure × jour (heure de Paris)
          </div>
          <Heatmap heatmap={data?.creneauHeatmap || null}/>
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition géographique</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Pourcentage de contacts acceptés par zone</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {geo.length === 0 && (
            <div className="muted" style={{ gridColumn: '1 / -1', fontSize: 13, padding: 16 }}>
              Aucune ville renseignée chez vos prospects acceptés pour le moment.
            </div>
          )}
          {geo.map((r, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="serif" style={{ fontSize: 18 }}>{r.ville}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{r.pct}%</div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{r.contacts} contact{r.contacts > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par tranche d'âge</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par segment</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 12,
        }}>
          {ages.map(({ label: l, pct: v }, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>{l}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{v}%</div>
              <div style={{ height: 4, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: Math.min(100, v * 3) + '%', background: 'var(--accent)', borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par sexe</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par genre déclaré</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 16,
        }}>
          {[
            [sex[0].label, sex[0].pct, 'color-mix(in oklab, var(--accent) 90%, #EC4899)'],
            [sex[1].label, sex[1].pct, 'var(--accent)'],
            [sex[2].label, sex[2].pct, 'var(--ink-4)'],
          ].map(([l, v, c], i) => (
            <div key={i} style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="row between center" style={{ marginBottom: 10 }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>{l}</div>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: c }}/>
              </div>
              <div className="serif tnum" style={{ fontSize: 36, color: c }}>{v}%</div>
              <div style={{ height: 6, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: v + '%', background: c, borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, height: 14, borderRadius: 999, overflow: 'hidden', display: 'flex', border: '1px solid var(--line)' }}>
          <div style={{ width: sex[0].pct + '%', background: 'color-mix(in oklab, var(--accent) 90%, #EC4899)' }}/>
          <div style={{ width: sex[1].pct + '%', background: 'var(--accent)' }}/>
          <div style={{ width: sex[2].pct + '%', background: 'var(--ink-4)' }}/>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ heatmap }) {
  // Convention française : lundi → dimanche (≠ Date.getDay() qui démarre
  // dimanche). Doit correspondre à l'ordre renvoyé par /api/pro/analytics.
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const dayLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  // Si l'API n'a pas encore répondu ou si aucune acceptation, on reste
  // sur la grille vide (toutes cellules à intensité 0). L'utilisateur
  // verra des cases pâles + le message "Aucune acceptation" sous la grille.
  const hours = heatmap?.hourLabels || ['8', '10', '12', '14', '16', '18', '20'];
  const counts = heatmap?.counts || days.map(() => hours.map(() => 0));
  const max = heatmap?.max || 0;
  const total = heatmap?.total || 0;

  // Repérage des 3 meilleurs créneaux pour le résumé textuel sous la
  // grille — utile car l'œil ne capte pas toujours la cellule la plus
  // chaude au premier regard.
  const allCells = [];
  for (let di = 0; di < days.length; di++) {
    for (let hi = 0; hi < hours.length; hi++) {
      if (counts[di]?.[hi] > 0) {
        allCells.push({ di, hi, count: counts[di][hi] });
      }
    }
  }
  allCells.sort((a, b) => b.count - a.count);
  const top = allCells.slice(0, 3);

  return (
    <div>
      <div className="heatmap-grid" style={{ display: 'grid', gridTemplateColumns: '18px repeat(7, 1fr)', gap: 4 }}>
        <div/>
        {hours.map(h => <div key={h} className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center' }}>{h}h</div>)}
        {days.map((d, di) => (
          <React.Fragment key={di}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{d}</div>
            {hours.map((_, hi) => {
              const c = counts[di]?.[hi] ?? 0;
              // Intensité 0–1 normalisée sur le max de la grille pour que
              // la couleur soit comparable entre cellules du même pro.
              const intensity = max > 0 ? c / max : 0;
              return (
                <div key={hi}
                  title={`${dayLabels[di]} ${hours[hi]}h : ${c} acceptation${c > 1 ? 's' : ''}`}
                  style={{
                    aspectRatio: '1', borderRadius: 4,
                    background: `color-mix(in oklab, var(--accent) ${Math.round(intensity * 80)}%, var(--ivory-2))`,
                    border: c > 0 && intensity < 0.1 ? '1px solid color-mix(in oklab, var(--accent) 20%, transparent)' : 'none',
                  }}/>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Résumé textuel — soit message vide soit top 3 des créneaux */}
      {total === 0 ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
          Aucune acceptation enregistrée pour le moment. La heatmap s'animera dès vos premiers contacts.
        </div>
      ) : (
        <div style={{ fontSize: 12, marginTop: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          <span className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.12em' }}>
            Top créneaux ·
          </span>{' '}
          {top.map((c, i) => (
            <span key={i}>
              <strong>{dayLabels[c.di]} {hours[c.hi]}h</strong>
              {' '}({c.count}){i < top.length - 1 ? ', ' : ''}
            </span>
          ))}
          <span className="muted"> — sur {total} acceptation{total > 1 ? 's' : ''} au total</span>
        </div>
      )}
    </div>
  );
}

function Facturation() {
  // Historique des factures alimenté par /api/pro/invoices (table
  // transactions filtrée sur account_kind='pro'). Re-fetch déclenché
  // sur l'event `pro:wallet-changed` (émis après une recharge réussie)
  // pour intégrer immédiatement la nouvelle facture sans rechargement.
  const [invoices, setInvoices] = useState(null);
  // Plan actif (label + prix mensuel) lu depuis /api/pro/plan, lui-même
  // alimenté par la table `plan_pricing`.
  const [planInfo, setPlanInfo] = useState(null);
  // État du modal "Compléter la facture" : la facture qu'on s'apprête
  // à télécharger. La modale pré-remplit les mentions légales lues
  // depuis /api/pro/info, et persiste les modifs avant de déclencher
  // l'ouverture du PDF.
  const [pdfPrompt, setPdfPrompt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch('/api/pro/invoices', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { invoices: [] })
        .then(j => !cancelled && setInvoices(j.invoices || []))
        .catch(() => !cancelled && setInvoices([]));
    refresh();
    fetch('/api/pro/plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setPlanInfo(j); })
      .catch(() => {});
    const onChange = () => refresh();
    window.addEventListener('pro:wallet-changed', onChange);
    return () => { cancelled = true; window.removeEventListener('pro:wallet-changed', onChange); };
  }, []);

  const _eurFmtFr = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  });
  const _dateFmtFr = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const statusChipClass = (s) =>
    s === 'completed' ? 'chip-good' :
    s === 'pending' ? 'chip-warn' :
    s === 'failed' || s === 'canceled' ? '' : '';
  const statusIcon = (s) =>
    s === 'completed' ? '✓ ' :
    s === 'pending' ? '◷ ' :
    s === 'failed' ? '✗ ' :
    s === 'canceled' ? '— ' : '';

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Facturation" title="Paiements &amp; factures"/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          [
            'Abonnement actuel',
            planInfo ? planInfo.label : '…',
            planInfo
              ? `${Number(planInfo.monthlyEur).toFixed(0)} € / ${planInfo.maxCampaigns ?? (planInfo.plan === 'pro' ? 10 : 2)} campagnes`
              : '—',
          ],
          ['Renouvellement', '02 mai 2026', 'Prélèvement auto.'],
          ['Carte enregistrée', 'Visa ••4521', 'Expire 08/28'],
        ].map((r, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>{r[0]}</div>
            <div className="serif" style={{ fontSize: 24 }}>{r[1]}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{r[2]}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 18 }}>
          <div className="serif" style={{ fontSize: 22 }}>Historique des factures</div>
          <button className="btn btn-ghost btn-sm btn-telecharger"><Icon name="download" size={12}/> Tout télécharger</button>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date</th>
                <th>Libellé</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices === null && (
                <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>Chargement…</td></tr>
              )}
              {invoices !== null && invoices.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>
                  Aucune facture pour le moment. Effectuez une recharge pour générer votre première facture.
                </td></tr>
              )}
              {invoices !== null && invoices.map((inv) => {
                // Le PDF est généré côté serveur (pdfkit) à partir des
                // mêmes données que la ligne ci-dessus + les infos
                // société du pro renseignées dans "Mes informations".
                // Cliquer ouvre d'abord la modale de validation/complétion
                // des mentions légales obligatoires sur la facture.
                return (
                  <tr key={inv.transactionId}>
                    <td className="mono" style={{ fontSize: 12 }}>{inv.number}</td>
                    <td className="muted">{_dateFmtFr.format(new Date(inv.date))}</td>
                    <td>{inv.label}</td>
                    <td><span className={'chip ' + statusChipClass(inv.status)}>{statusIcon(inv.status)}{inv.statusLabel}</span></td>
                    <td className="mono tnum" style={{ textAlign: 'right' }}>{_eurFmtFr.format(inv.amountEur)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setPdfPrompt(inv)}
                        className="btn btn-ghost btn-sm btn-telecharger"
                        title={`Télécharger la facture ${inv.number} (PDF)`}
                      >
                        <Icon name="download" size={12}/> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {pdfPrompt && (
        <InvoiceFieldsModal
          invoice={pdfPrompt}
          onClose={() => setPdfPrompt(null)}
          onConfirmed={(savedInvoice) => {
            // Patch a réussi : on ouvre le PDF dans un nouvel onglet et
            // on referme la modale.
            const url = `/api/pro/invoices/${encodeURIComponent(savedInvoice.transactionId)}/pdf`;
            window.open(url, '_blank', 'noopener,noreferrer');
            setPdfPrompt(null);
          }}
        />
      )}
    </div>
  );
}

/* Modale "Compléter la facture" — interceptée au clic sur le bouton
   PDF de l'historique. Recharge les Mes informations courantes,
   permet de compléter les mentions légales obligatoires, persiste
   les modifications via PATCH /api/pro/info, puis renvoie au parent
   pour qu'il déclenche le téléchargement PDF. */
function InvoiceFieldsModal({ invoice, onClose, onConfirmed }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    raisonSociale: '',
    formeJuridique: '',
    adresse: '',
    ville: '',
    codePostal: '',
    capitalSocialEur: '',
    siren: '',
    siret: '',
    rcsVille: '',
    rmNumber: '',
  });
  // État de la vérification SIREN/SIRET côté API officielle
  // (data.gouv.fr / SIRENE). `status` ∈ {'idle','loading','found',
  // 'not_found','error'} ; `data` contient les valeurs officielles
  // pour comparaison + import éventuel.
  const [verify, setVerify] = useState({ status: 'idle', data: null, queriedFor: null });

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/info', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j) { setLoading(false); return; }
        setForm({
          raisonSociale: j.raisonSociale ?? '',
          formeJuridique: j.formeJuridique ?? '',
          adresse: j.adresse ?? '',
          ville: j.ville ?? '',
          codePostal: j.codePostal ?? '',
          capitalSocialEur: j.capitalSocialEur == null ? '' : String(j.capitalSocialEur),
          siren: j.siren ?? '',
          siret: j.siret ?? '',
          rcsVille: j.rcsVille ?? '',
          rmNumber: j.rmNumber ?? '',
        });
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Vérification auto SIREN/SIRET sur l'API publique data.gouv.fr.
  // Déclenchée dès qu'un identifiant atteint sa longueur valide (9
  // chiffres pour le SIREN, 14 pour le SIRET). Debouncée. La clé du
  // dernier appel est suivie via une `ref` pour ne pas créer de
  // boucle de re-render avec l'état `verify`.
  const lastQueryRef = React.useRef(null);
  React.useEffect(() => {
    const siren = form.siren.replace(/\s+/g, '');
    const siret = form.siret.replace(/\s+/g, '');
    const target =
      /^\d{14}$/.test(siret) ? `siret:${siret}` :
      /^\d{9}$/.test(siren)  ? `siren:${siren}` : null;
    if (!target) {
      setVerify({ status: 'idle', data: null });
      lastQueryRef.current = null;
      return;
    }
    if (target === lastQueryRef.current) return;
    lastQueryRef.current = target;
    setVerify({ status: 'loading', data: null });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const qs = target.startsWith('siret:')
          ? `siret=${target.slice(6)}`
          : `siren=${target.slice(6)}`;
        const r = await fetch(`/api/pro/info/verify-company?${qs}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setVerify({ status: 'error', data: null }); return; }
        if (!j.found) { setVerify({ status: 'not_found', data: null }); return; }
        setVerify({ status: 'found', data: j });
      } catch {
        if (!cancelled) setVerify({ status: 'error', data: null });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.siren, form.siret]);

  // Diff utilisateur ↔ valeurs officielles. Comparaison souple :
  // trim + case-insensitive, et "espace insécable" normalisé.
  const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  const diffs =
    verify.status === 'found' && verify.data
      ? [
          ['raisonSociale',  'Raison sociale',   form.raisonSociale,  verify.data.raisonSociale],
          ['adresse',        'Adresse',          form.adresse,        verify.data.adresse],
          ['ville',          'Ville',            form.ville,          verify.data.ville],
          ['codePostal',     'Code postal',      form.codePostal,     verify.data.codePostal],
          ['formeJuridique', 'Forme juridique',  form.formeJuridique, verify.data.formeJuridique],
        ].filter(([, , user, off]) => off && user && norm(user) !== norm(off))
      : [];

  const importOfficial = () => {
    if (verify.status !== 'found' || !verify.data) return;
    setForm(f => ({
      ...f,
      raisonSociale: verify.data.raisonSociale || f.raisonSociale,
      adresse: verify.data.adresse || f.adresse,
      ville: verify.data.ville || f.ville,
      codePostal: verify.data.codePostal || f.codePostal,
      formeJuridique: verify.data.formeJuridique || f.formeJuridique,
      siren: verify.data.siren || f.siren,
      siret: verify.data.siret || f.siret,
    }));
  };

  const required = [
    ['raisonSociale',  'Dénomination sociale ou nom/prénom',  form.raisonSociale.trim()],
    ['formeJuridique', 'Forme juridique',                      form.formeJuridique.trim()],
    ['adresse',        'Adresse du siège social',              form.adresse.trim()],
    ['ville',          'Ville',                                form.ville.trim()],
  ];
  const missing = required.filter(([, , v]) => !v).map(([, l]) => l);
  // SIREN ou SIRET — un des deux requis. Ville d'immatriculation RCS
  // OU numéro RM — un des deux requis pour les structures concernées.
  const hasIdentifier = !!form.siren.trim() || !!form.siret.trim();
  const hasRegistration = !!form.rcsVille.trim() || !!form.rmNumber.trim();
  const canSubmit = !loading && missing.length === 0 && hasIdentifier && hasRegistration;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/pro/info', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          raisonSociale: form.raisonSociale.trim(),
          formeJuridique: form.formeJuridique.trim() || null,
          adresse: form.adresse.trim() || null,
          ville: form.ville.trim() || null,
          codePostal: form.codePostal.trim() || null,
          capitalSocialEur: form.capitalSocialEur === '' ? null : form.capitalSocialEur,
          siren: form.siren.trim() || null,
          siret: form.siret.trim() || null,
          rcsVille: form.rcsVille.trim() || null,
          rmNumber: form.rmNumber.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || 'save_failed');
      }
      // Notifie l'app pour que "Mes informations" se rafraichisse à
      // l'écran s'il est ouvert dans un autre onglet du dashboard.
      try { window.dispatchEvent(new Event('pro:info-changed')); } catch {}
      onConfirmed(invoice);
    } catch (e) {
      setError(e?.message === 'invalid_capital'
        ? 'Le capital social doit être un nombre positif.'
        : e?.message === 'invalid_siren'
        ? 'Le SIREN doit comporter 9 chiffres.'
        : e?.message === 'invalid_siret'
        ? 'Le SIRET doit comporter 14 chiffres.'
        : 'Impossible d\'enregistrer ces informations. Réessayez.');
      setSaving(false);
    }
  };

  const fld = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 220,
      overflowY: 'auto',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 20px 80px',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--paper)', borderRadius: 16, padding: 26,
        maxWidth: 600, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
        margin: 'auto 0',
      }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div className="mono caps muted" style={{ fontSize: 11, marginBottom: 6 }}>— Génération facture</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
              Compléter les mentions légales
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ color: 'var(--ink-4)', padding: 4, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8, marginBottom: 18 }}>
          Vérifiez (et complétez si nécessaire) les informations qui apparaîtront sur votre facture <strong>{invoice.number}</strong>. Elles seront automatiquement enregistrées dans <strong>Mes informations</strong> pour les prochaines factures.
        </div>

        {loading ? (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>Chargement de vos informations…</div>
        ) : (
          <div className="col gap-3">
            <div>
              <div className="label">Dénomination sociale ou nom/prénom *</div>
              <input className="input" {...fld('raisonSociale')} placeholder="Atelier Mercier" />
            </div>
            <div className="row gap-3 wrap">
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">Forme juridique *</div>
                <input className="input" {...fld('formeJuridique')} placeholder="SARL, SAS, EI, Auto-entrepreneur…" />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">Capital social</div>
                <input className="input" {...fld('capitalSocialEur')} inputMode="decimal" placeholder="Montant en € (sociétés)" />
              </div>
            </div>
            <div>
              <div className="label">Adresse du siège social *</div>
              <input className="input" {...fld('adresse')} placeholder="12 rue des Artisans" />
            </div>
            <div className="row gap-3 wrap">
              <div style={{ flex: '0 1 160px' }}>
                <div className="label">Code postal</div>
                <input className="input" {...fld('codePostal')} placeholder="64000" inputMode="numeric" />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">Ville *</div>
                <input className="input" {...fld('ville')} placeholder="Pau" />
              </div>
            </div>
            <div className="row gap-3 wrap">
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">SIREN</div>
                <input className="input mono" {...fld('siren')} placeholder="9 chiffres" inputMode="numeric" maxLength={9} />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">SIRET</div>
                <input className="input mono" {...fld('siret')} placeholder="14 chiffres" inputMode="numeric" maxLength={14} />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Renseignez au moins l'un des deux numéros (SIREN ou SIRET). Vérification automatique sur le registre officiel SIRENE / data.gouv.fr.
            </div>

            {/* Statut vérification numéro entreprise (data.gouv.fr) */}
            {verify.status === 'loading' && (
              <div role="status" style={{
                marginTop: 4, padding: '10px 12px', borderRadius: 8,
                background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
                color: 'var(--ink-3)', fontSize: 12.5,
              }}>
                Vérification en cours sur le registre officiel…
              </div>
            )}
            {verify.status === 'not_found' && (
              <div role="alert" style={{
                marginTop: 4, padding: '10px 12px', borderRadius: 8,
                background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                color: '#991B1B', fontSize: 12.5,
              }}>
                ❌ Numéro introuvable dans le registre officiel des entreprises (SIRENE). Vérifiez la saisie.
              </div>
            )}
            {verify.status === 'error' && (
              <div role="status" style={{
                marginTop: 4, padding: '10px 12px', borderRadius: 8,
                background: '#FEF3C7', border: '1px solid #FCD34D',
                color: '#78350F', fontSize: 12.5,
              }}>
                Vérification temporairement indisponible — vous pouvez quand même enregistrer.
              </div>
            )}
            {verify.status === 'found' && diffs.length === 0 && (
              <div role="status" style={{
                marginTop: 4, padding: '12px 14px', borderRadius: 10,
                background: 'color-mix(in oklab, var(--good) 10%, var(--paper))',
                border: '1.5px solid color-mix(in oklab, var(--good) 35%, var(--line))',
                color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5,
              }}>
                ✅ <strong>Validé</strong> — les informations correspondent au registre officiel
                {verify.data?.raisonSociale ? ` (${verify.data.raisonSociale})` : ''}.
                {verify.data?.actif === false && (
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--warn)' }}>
                    ⚠ Cet établissement est marqué comme cessé dans la base SIRENE.
                  </span>
                )}
              </div>
            )}
            {verify.status === 'found' && diffs.length > 0 && (
              <div role="alert" style={{
                marginTop: 4, padding: '12px 14px', borderRadius: 10,
                background: '#FEF3C7', border: '1.5px solid #FCD34D',
                color: '#78350F', fontSize: 12.5, lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: '#78350F' }}>
                  ⚠ Discordances détectées avec le registre officiel
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {diffs.map(([key, label, user, official]) => (
                    <li key={key} style={{ marginBottom: 2 }}>
                      <strong>{label}</strong> — saisi : « {user || '∅'} » · officiel : « {official} »
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={importOfficial}
                  className="btn btn-sm"
                  style={{
                    marginTop: 10,
                    background: '#7C3AED', color: 'white', borderColor: '#7C3AED',
                  }}
                >
                  Remplacer les informations collectées
                </button>
              </div>
            )}
            <div className="row gap-3 wrap">
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">Ville d'immatriculation RCS</div>
                <input className="input" {...fld('rcsVille')} placeholder="Pau, Lyon…" />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">Numéro RM (artisans)</div>
                <input className="input mono" {...fld('rmNumber')} placeholder="Si artisan inscrit au répertoire des métiers" />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Renseignez la ville RCS pour les sociétés commerciales, ou le numéro RM pour les artisans.
            </div>

            {missing.length > 0 && (
              <div role="alert" style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 8,
                background: '#FEF3C7', border: '1.5px solid #FCD34D',
                color: '#78350F', fontSize: 12.5,
              }}>
                Champs obligatoires manquants : {missing.join(', ')}.
              </div>
            )}
            {missing.length === 0 && !hasIdentifier && (
              <div role="alert" style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 8,
                background: '#FEF3C7', border: '1.5px solid #FCD34D',
                color: '#78350F', fontSize: 12.5,
              }}>
                Renseignez votre SIREN ou votre SIRET pour générer la facture.
              </div>
            )}
            {missing.length === 0 && hasIdentifier && !hasRegistration && (
              <div role="alert" style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 8,
                background: '#FEF3C7', border: '1.5px solid #FCD34D',
                color: '#78350F', fontSize: 12.5,
              }}>
                Renseignez votre ville d'immatriculation RCS (sociétés) ou votre numéro RM (artisans).
              </div>
            )}
            {error && (
              <div role="alert" style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 8,
                background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                color: '#991B1B', fontSize: 12.5,
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 22, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={!canSubmit || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer & télécharger le PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ camp, onBack, onDuplicate }) {
  const [tab, setTab] = useState('overview');
  // null = en cours de chargement, objet = data fetchée, string = erreur.
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // Modale de confirmation prolongation (one-time +10 €).
  const [extendOpen, setExtendOpen] = useState(false);
  // Modale d'info pause 48 h (réservée aux campagnes 7d, une seule fois).
  const [pauseOpen, setPauseOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const togglePauseStatus = async (campId, nextStatus) => {
    try {
      const r = await fetch(`/api/pro/campaigns/${campId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Échec : " + (j?.error || r.status));
        return false;
      }
      try { window.dispatchEvent(new Event('pro:overview-changed')); } catch {}
      setReloadKey(k => k + 1);
      return true;
    } catch (e) {
      alert("Erreur réseau : " + (e.message || ''));
      return false;
    }
  };

  // Camp est l'objet de la liste (cf. Campagnes → onDetail(c)). On l'utilise
  // pour des fallbacks d'affichage tant que le détail complet n'a pas répondu.
  const campId = camp?.id || null;

  // Fetch du détail (campaign + funnel + contacts + activity) à l'arrivée
  // sur la page et à chaque changement d'id de campagne.
  useEffect(() => {
    if (!campId) return;
    let cancelled = false;
    setData(null);
    setLoadError(null);
    fetch(`/api/pro/campaigns/${campId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || ('HTTP ' + r.status));
        }
        return r.json();
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setLoadError(e.message || 'load_failed'); });
    return () => { cancelled = true; };
  }, [campId, reloadKey]);

  // Remonte en haut à chaque changement d'onglet pour que l'utilisateur
  // n'atterrisse pas en bas du nouvel onglet après son clic.
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    document.querySelectorAll('main, .page').forEach(el => { el.scrollTop = 0; });
  }, [tab]);

  // Vue erreur — non-fatal pour la nav (on garde le bouton retour visible).
  if (loadError) {
    return (
      <div className="col gap-6">
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={12}/> Toutes les campagnes
        </button>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 6 }}>
            Impossible de charger les détails de cette campagne.
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>{loadError}</div>
        </div>
      </div>
    );
  }

  // Skeleton pendant le fetch — utilise les valeurs du résumé pour donner
  // au pro une indication immédiate plutôt qu'un écran totalement vide.
  if (!data) {
    return (
      <div className="col gap-6">
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={12}/> Toutes les campagnes
        </button>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— Campagne</div>
          <h3 className="serif" style={{ fontSize: 40, letterSpacing: '-0.015em' }}>
            {camp?.name || '—'}
          </h3>
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Chargement des détails…
          </div>
        </div>
      </div>
    );
  }

  const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
  const fmt0 = v => Math.round(Number(v ?? 0)).toLocaleString('fr-FR');

  const status = data.status;
  const statusLabel = status === 'active' ? 'Active'
    : status === 'paused' ? 'En pause'
    : status === 'completed' ? 'Terminée'
    : status === 'canceled' ? 'Annulée'
    : status === 'draft' ? 'Brouillon'
    : status;
  const statusChip = status === 'active' ? 'chip-good'
    : status === 'paused' ? 'chip-warn'
    : '';

  const budgetEur = Number(data.budgetEur ?? 0);
  const spentEur = Number(data.spentEur ?? 0);
  const remainingEur = Number(data.remainingEur ?? Math.max(0, budgetEur - spentEur));
  // Commission BUUPP = 10 % du budget. Le solde du pro est débité de
  // l'intégralité (campagne + commission), donc la consommation du budget
  // intègre proportionnellement la commission.
  const COMMISSION_RATE = 0.10;
  const commissionTotalEur = budgetEur * COMMISSION_RATE;
  const commissionSpentEur = spentEur * COMMISSION_RATE;
  const budgetWithCommissionEur = budgetEur + commissionTotalEur;
  const spentWithCommissionEur = spentEur + commissionSpentEur;
  const remainingWithCommissionEur = Math.max(0, budgetWithCommissionEur - spentWithCommissionEur);
  const cpcEur = Number(data.costPerContactEur ?? 0);
  const avgCostEur = Number(data.avgCostEur ?? cpcEur);
  const winCount = Number(data.winCount ?? 0);
  const objectivePlannedContacts = cpcEur > 0 ? Math.round(budgetEur / cpcEur) : 0;
  const acceptanceRate = data.acceptanceRate;

  const funnel = [
    ['Prospects matchés (au lancement)', data.funnel?.matched || 0],
    ['Demandes envoyées',                data.funnel?.sent || 0],
    ['Acceptées',                        (data.funnel?.accepted || 0) + (data.funnel?.settled || 0)],
    ['Créditées (séquestre écoulé)',     data.funnel?.settled || 0],
  ];
  const funnelMax = Math.max(...funnel.map(([, v]) => v), 1);

  // Bucket les événements (kind=accepted|settled) sur les 14 derniers jours
  // — alimente la barre quotidienne de l'onglet "Vue d'ensemble".
  const dailyData = (() => {
    const buckets = new Array(14).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const a of (data.activity || [])) {
      if (a.kind !== 'accepted' && a.kind !== 'settled') continue;
      const d = new Date(a.ts);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 14) buckets[13 - diffDays] += 1;
    }
    return buckets;
  })();
  const maxDaily = Math.max(...dailyData, 1);

  // Mapping kind d'activité → (icône, couleur) — on reste sur le set d'icônes
  // déjà utilisé ailleurs dans le dashboard.
  const ACTIVITY_KIND = {
    settled:  { icon: 'wallet',  color: 'var(--good)' },
    accepted: { icon: 'check',   color: 'var(--good)' },
    refused:  { icon: 'close',   color: 'var(--warn)' },
    expired:  { icon: 'clock',   color: 'var(--ink-4)' },
    pending:  { icon: 'email',   color: 'var(--ink-4)' },
  };
  const activityFmt = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  // Configuration tab — données du targeting renvoyées par l'API.
  const tg = data.targeting || {};
  const objectiveValue = data.objectiveLabel || '—';
  const subTypesValue = (tg.subTypes && tg.subTypes.length) ? tg.subTypes.join(', ') : '—';
  const tiersValue = (tg.tierLabels && tg.tierLabels.length) ? tg.tierLabels.join(', ') : '—';
  const keywordsValue = (tg.keywords && tg.keywords.length) ? tg.keywords.join(', ') : '—';
  const kwModeValue = tg.kwFilter ? 'Filtre exclusif' : 'Signal de priorité';
  const agesValue = (tg.ages && tg.ages.length) ? tg.ages.join(', ') : 'Tous';
  const briefValue = data.brief || '—';

  return (
    <div className="col gap-6">
      <div>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={12}/> Toutes les campagnes
        </button>
        <div className="row between" style={{ alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="mono caps muted" style={{ marginBottom: 8 }}>— Campagne · {data.objectiveLabel || 'Campagne'}</div>
            <h3 className="serif" style={{ fontSize: 40, letterSpacing: '-0.015em' }}>
              {data.name} <span className={'chip ' + statusChip} style={{ fontSize: 12, verticalAlign: 'middle', marginLeft: 10 }}>{statusLabel}</span>
            </h3>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Créée le {data.createdAtLabel || '—'}
              {data.endsAtLabel ? <> · diffusion jusqu'au <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{data.endsAtLabel}</span></> : null}
              {avgCostEur > 0 ? <> · coût unitaire moyen {fmt2(avgCostEur)} €</> : null}
            </div>
          </div>
          <div className="row gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onDuplicate?.(data.id)}
              title="Relancer la même campagne avec les mêmes paramètres"
            >
              <Icon name="copy" size={12}/> Dupliquer
            </button>
            {status === 'active' && data.pauseEligible && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPauseOpen(true)}
                title="Mettre la campagne en pause 48 h (une seule fois)"
              >
                <Icon name="pause" size={12}/> Mettre en pause
              </button>
            )}
            {status === 'paused' && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => togglePauseStatus(data.id, 'active')}
                title="Reprendre la campagne maintenant — le temps restant est préservé"
              >
                <Icon name="play" size={12}/> Relancer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Budget consommé',
            fmt2(spentWithCommissionEur) + ' € / ' + fmt2(budgetWithCommissionEur) + ' €',
            (budgetWithCommissionEur > 0 ? Math.round(spentWithCommissionEur / budgetWithCommissionEur * 100) : 0) + '% engagé · commission 10 % incluse',
            'wallet'],
          ['Contacts obtenus',
            String(winCount),
            objectivePlannedContacts > 0 ? `objectif ~${objectivePlannedContacts}` : '—',
            'users'],
          ['Taux d\'acceptation',
            acceptanceRate == null ? '—' : `${acceptanceRate}%`,
            (() => {
              if (acceptanceRate == null) return 'aucune sollicitation envoyée';
              const sent = Number(data.funnel?.sent ?? 0);
              const pending = Number(data.funnel?.pending ?? 0);
              const refused = Number(data.funnel?.refused ?? 0);
              const expired = Number(data.funnel?.expired ?? 0);
              const parts = [`${winCount} / ${sent} sollicité${sent > 1 ? 's' : ''}`];
              const tail = [];
              if (pending > 0) tail.push(`${pending} en attente`);
              if (refused > 0) tail.push(`${refused} refus`);
              if (expired > 0) tail.push(`${expired} expiré${expired > 1 ? 's' : ''}`);
              if (tail.length > 0) parts.push(tail.join(' · '));
              return parts.join(' · ');
            })(),
            'trend'],
          ['Coût moyen / contact',
            fmt2(avgCostEur) + ' €',
            cpcEur > 0 ? `prévu ${fmt2(cpcEur)} €` : '—',
            'bolt'],
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="row between center" style={{ marginBottom: 14 }}>
              <div className="mono caps muted" style={{ fontSize: 10 }}>{k[0]}</div>
              <span style={{ color: 'var(--accent)' }}><Icon name={k[3]} size={14}/></span>
            </div>
            <div className="serif tnum" style={{ fontSize: 28 }}>{k[1]}</div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>{k[2]}</div>
          </div>
        ))}
      </div>

      {/* Duration & prolongation strip */}
      <div className="card" style={{
        padding: 20,
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
        background: status === 'active'
          ? 'color-mix(in oklab, var(--accent) 6%, var(--paper))'
          : 'var(--paper)',
        border: '1px solid ' + (status === 'active'
          ? 'color-mix(in oklab, var(--accent) 22%, var(--line))'
          : 'var(--line)'),
      }}>
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: status === 'active' ? 'var(--accent)' : 'var(--ink-5, #e8e2d5)',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="clock" size={18} stroke={2}/>
          </div>
          <div>
            <div className="mono caps" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 4 }}>Fenêtre de diffusion</div>
            <div style={{ fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
              {status === 'active' && data.endsAtLabel
                ? <>Campagne active — diffusion jusqu'au <strong>{data.endsAtLabel}</strong></>
                : status === 'paused'
                  ? <>Campagne en pause — peut être relancée tant qu'elle n'est pas expirée</>
                  : status === 'completed'
                    ? <>Campagne clôturée le {data.endsAtLabel || '—'}</>
                    : <>Période : du {data.startsAtLabel || '—'} au {data.endsAtLabel || '—'}</>}
            </div>
            {tg.days != null && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                Durée initiale : {tg.days} jour{tg.days > 1 ? 's' : ''}.
              </div>
            )}
          </div>
        </div>
        {(() => {
          if (data?.extensionUsed) {
            return (
              <span className="chip" style={{ fontSize: 11, padding: '6px 12px' }}>
                Prolongée {data.extendedAtLabel ? `le ${data.extendedAtLabel}` : ''}
              </span>
            );
          }
          if (data?.extendEligible) {
            return (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setExtendOpen(true)}
              >
                <Icon name="plus" size={12}/> Prolonger · 10 €
              </button>
            );
          }
          return null;
        })()}
      </div>

      {/* Tabs */}
      <div className="row gap-2">
        {[
          ['overview', 'Vue d\'ensemble'],
          ['contacts', 'Contacts (' + (data.contacts?.length || 0) + ')'],
          ['config',   'Configuration'],
          ['activity', 'Activité'],
          ['billing',  'Facturation'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="chip" style={{
            cursor: 'pointer', padding: '8px 16px', fontSize: 13,
            background: tab === k ? 'var(--ink)' : 'var(--paper)',
            color: tab === k ? 'var(--paper)' : 'var(--ink-3)',
            borderColor: tab === k ? 'var(--ink)' : 'var(--line-2)'
          }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          {/* Daily chart */}
          <div className="card" style={{ padding: 28 }}>
            <div className="row between" style={{ marginBottom: 20 }}>
              <div>
                <div className="serif" style={{ fontSize: 22 }}>Progression quotidienne</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Acceptations + crédits par jour, sur les 14 derniers jours</div>
              </div>
            </div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 160, marginBottom: 12 }}>
              {dailyData.map((v, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: v > 0 ? (v / maxDaily * 100) + '%' : 2,
                  background: v > 0 ? 'var(--accent)' : 'var(--ivory-2)',
                  borderRadius: 4, position: 'relative',
                  opacity: 0.4 + (i / dailyData.length) * 0.6,
                }}>
                  {v > 0 && (
                    <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{v}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="row between mono" style={{ fontSize: 10, color: 'var(--ink-4)', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <span>J−13</span><span>J−10</span><span>J−7</span><span>J−4</span><span>Aujourd'hui</span>
            </div>
          </div>

          {/* Funnel */}
          <div className="card" style={{ padding: 28 }}>
            <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>Entonnoir</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Du matching au crédit</div>
            <div className="col gap-3">
              {funnel.map(([l, v], i) => {
                const pct = funnelMax > 0 ? Math.round(v / funnelMax * 100) : 0;
                return (
                  <div key={i}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span>
                      <span className="mono tnum" style={{ fontSize: 13 }}>{fmt0(v)} · <span style={{ color: 'var(--accent)' }}>{pct}%</span></span>
                    </div>
                    <div style={{ height: 8, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 999, opacity: 0.3 + (1 - i / funnel.length) * 0.7 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Budget breakdown — full width */}
          <div className="card" style={{ padding: 28, gridColumn: '1 / -1' }}>
            <div className="row between" style={{ marginBottom: 20 }}>
              <div>
                <div className="serif" style={{ fontSize: 22 }}>Budget</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {fmt2(spentWithCommissionEur)} € engagés sur un budget de {fmt2(budgetWithCommissionEur)} €
                  <span className="mono" style={{
                    marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 6,
                    background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
                    color: 'var(--accent)', fontWeight: 600,
                  }}>commission 10 % incluse</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>Reste à engager</div>
                <div className="serif tnum" style={{ fontSize: 22, color: 'var(--accent)' }}>{fmt2(remainingWithCommissionEur)} €</div>
              </div>
            </div>
            <Progress value={budgetWithCommissionEur > 0 ? spentWithCommissionEur / budgetWithCommissionEur : 0}/>
            <div className="row between mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8 }}>
              <span>0 €</span><span>{fmt2(budgetWithCommissionEur)} €</span>
            </div>
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)',
              display: 'flex', flexDirection: 'column', gap: 10,
              fontSize: 12, color: 'var(--ink-3)',
            }}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
                <span>Budget campagne : <strong className="mono tnum" style={{ color: 'var(--ink)' }}>{fmt2(budgetEur)} €</strong></span>
                <span>Commission BUUPP max. (10 %) : <strong className="mono tnum" style={{ color: 'var(--ink)' }}>{fmt2(commissionTotalEur)} €</strong></span>
                <span>Commission engagée à ce jour : <strong className="mono tnum" style={{ color: 'var(--accent)' }}>{fmt2(commissionSpentEur)} €</strong></span>
              </div>
              <div className="row" style={{
                gap: 8, padding: '8px 10px', borderRadius: 8,
                background: 'color-mix(in oklab, var(--good) 8%, var(--paper))',
                border: '1px solid color-mix(in oklab, var(--good) 25%, var(--line))',
                color: 'color-mix(in oklab, var(--good) 60%, var(--ink-2))',
                lineHeight: 1.5, alignItems: 'flex-start',
              }}>
                <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ︎</span>
                <span>
                  La commission BUUPP n'est due qu'à l'acceptation d'un prospect.
                  {winCount === 0
                    ? ' Aucun prospect n\'a encore accepté → aucune commission n\'est acquise.'
                    : ' Elle est calculée proportionnellement aux acceptations enregistrées.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="serif" style={{ fontSize: 20 }}>Contacts obtenus</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {(data.contacts?.length || 0)} prospect{(data.contacts?.length || 0) > 1 ? 's' : ''} ayant accepté votre mise en relation
              </div>
            </div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filtrer</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Exporter CSV</button>
            </div>
          </div>
          {(data.contacts?.length || 0) === 0 ? (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Aucun contact obtenu pour le moment via cette campagne.
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>Prospect</th><th>Score</th><th>Palier</th><th>Date</th><th>Statut</th>
              </tr></thead>
              <tbody>
                {data.contacts.map((c) => (
                  <tr key={c.id}>
                    <td><span className="row center gap-3"><Avatar name={c.name} size={26}/>{c.name}</span></td>
                    <td className="mono tnum">{c.score == null ? '—' : c.score}</td>
                    <td><span className="chip" style={{ fontSize: 11 }}>{c.tierLabel}</span></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{activityFmt.format(new Date(c.decidedAt))}</td>
                    <td><span className={'chip ' + (c.statusChip ? 'chip-' + c.statusChip : '')} style={{ fontSize: 11 }}>{c.statusLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 28 }}>
            <div className="serif" style={{ fontSize: 20, marginBottom: 18 }}>Objectif & données</div>
            {[
              ['Objectif principal', objectiveValue],
              ['Sous-types',         subTypesValue],
              ['Paliers de données', tiersValue],
              ['Mots-clés',          keywordsValue],
              ['Mode mot-clé',       (tg.keywords && tg.keywords.length) ? kwModeValue : '—'],
              ['Brief',              briefValue],
            ].map(([l, v], i, arr) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', gap: 16 }}>
                <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '70%' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 28 }}>
            <div className="serif" style={{ fontSize: 20, marginBottom: 18 }}>Ciblage & budget</div>
            {[
              ['Zone géographique',   tg.geoLabel || '—'],
              ["Tranches d'âge",      agesValue],
              ['Vérification min.',   tg.verifLabel || '—'],
              ['Contacts souhaités',  String(objectivePlannedContacts || '—')],
              ['Durée',               tg.days != null ? (tg.days + ' jour' + (tg.days > 1 ? 's' : '')) : '—'],
              ['Mode',                tg.poolLabel || '—'],
              ['Budget campagne',     fmt2(budgetEur) + ' €'],
              ['Commission BUUPP max. (10 %)', fmt2(commissionTotalEur) + ' € · prélevée uniquement sur acceptations'],
              ['Réservé sur le solde', fmt2(budgetWithCommissionEur) + ' €'],
              ['Coût max / contact',  fmt2(cpcEur) + ' €'],
            ].map(([l, v], i, arr) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span className="muted" style={{ fontSize: 12 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>Flux d'activité</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>
            {(data.activity?.length || 0) === 0
              ? "Aucun événement enregistré pour cette campagne."
              : `Les ${data.activity.length} derniers événements de votre campagne.`}
          </div>
          {(data.activity || []).map((a, i, arr) => {
            const meta = ACTIVITY_KIND[a.kind] || ACTIVITY_KIND.pending;
            return (
              <div key={i} className="row" style={{ padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ivory-2)', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={meta.icon} size={14}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{a.label}</div>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>{activityFmt.format(new Date(a.ts))}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'billing' && (
        <div className="card" style={{ padding: 28 }}>
          <div className="row between" style={{ marginBottom: 22, alignItems: 'flex-end' }}>
            <div>
              <div className="serif" style={{ fontSize: 22 }}>Facturation de la campagne</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Détail des débits et contacts facturés</div>
            </div>
            <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Relevé complet</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            {[
              ['Total débité',        fmt2(spentWithCommissionEur) + ' €', 'commission 10 % incluse'],
              ['Contacts facturés',   `${winCount} / ${objectivePlannedContacts || '—'}`, ''],
              ['Moyenne / contact',   fmt2(avgCostEur) + ' €', ''],
            ].map(([l, v, sub], i) => (
              <div key={i} style={{ padding: 16, background: 'var(--ivory-2)', borderRadius: 10 }}>
                <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>{l}</div>
                <div className="serif tnum" style={{ fontSize: 22 }}>{v}</div>
                {sub && (
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>{sub}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--line))',
            marginBottom: 16, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8,
          }}>
            <div>Budget campagne consommé : <strong className="mono tnum" style={{ color: 'var(--ink)' }}>{fmt2(spentEur)} €</strong></div>
            <div>Commission BUUPP acquise (10 %) : <strong className="mono tnum" style={{ color: 'var(--accent)' }}>{fmt2(commissionSpentEur)} €</strong></div>
            <div>Total débité du solde : <strong className="mono tnum" style={{ color: 'var(--ink)' }}>{fmt2(spentWithCommissionEur)} €</strong></div>
          </div>
          <div className="row" style={{
            gap: 8, padding: '10px 12px', borderRadius: 8,
            background: 'color-mix(in oklab, var(--good) 8%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--good) 25%, var(--line))',
            color: 'color-mix(in oklab, var(--good) 60%, var(--ink-2))',
            fontSize: 12, lineHeight: 1.5, alignItems: 'flex-start', marginBottom: 24,
          }}>
            <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ︎</span>
            <span>
              <strong>Aucune commission n'est due si aucun prospect n'accepte.</strong>{' '}
              {winCount === 0
                ? 'Cette campagne n\'a encore aucune acceptation enregistrée — aucune commission BUUPP n\'a été facturée.'
                : `La commission est facturée à hauteur de 10 % du gain de chaque prospect ayant accepté (${winCount} acceptation${winCount > 1 ? 's' : ''} à ce jour).`}
            </span>
          </div>
          {(data.contacts?.length || 0) === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: 16, textAlign: 'center' }}>
              Aucun contact facturé pour le moment.
            </div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>Date</th><th>Contact</th><th>Palier</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th>
              </tr></thead>
              <tbody>
                {data.contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="muted mono" style={{ fontSize: 12 }}>{activityFmt.format(new Date(c.decidedAt))}</td>
                    <td>{c.name}</td>
                    <td><span className="chip" style={{ fontSize: 11 }}>{c.tierLabel}</span></td>
                    <td className="mono tnum" style={{ textAlign: 'right' }}>{fmt2(cpcEur)} €</td>
                    <td><span className={'chip ' + (c.statusChip ? 'chip-' + c.statusChip : '')} style={{ fontSize: 11 }}>{c.statusLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {extendOpen && data && (
        <ExtendCampaignModal
          camp={data}
          onCancel={() => setExtendOpen(false)}
          onConfirm={async () => {
            try {
              const r = await fetch(`/api/pro/campaigns/${campId}/extend`, { method: 'POST' });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) {
                alert("Échec de la prolongation : " + (j?.error || r.status));
                return;
              }
              try { window.dispatchEvent(new Event('pro:wallet-changed')); } catch {}
              setExtendOpen(false);
              setReloadKey(k => k + 1);
            } catch (e) {
              alert("Erreur réseau : " + (e.message || ''));
            }
          }}
        />
      )}
      {pauseOpen && data && (
        <PauseCampaignModal
          camp={data}
          onCancel={() => setPauseOpen(false)}
          onConfirm={async () => {
            const ok = await togglePauseStatus(data.id, 'paused');
            setPauseOpen(false);
            if (!ok) return;
          }}
        />
      )}
    </div>
  );
}

/* Modale de confirmation pour la prolongation one-time d'une campagne.
   Explique : durée ajoutée = durée initiale, action irréversible (10 €
   débités du wallet pro non remboursables), une seule prolongation par
   campagne. */
function ExtendCampaignModal({ camp, onCancel, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);
  const handleConfirm = async () => {
    setSubmitting(true);
    try { await onConfirm(); }
    finally { setSubmitting(false); }
  };
  const durationKey = camp?.targeting?.durationKey;
  const DURATION_LABEL = { '1h': '1 heure', '24h': '24 heures', '48h': '48 heures', '7d': '7 jours' };
  const durationLabel = DURATION_LABEL[durationKey] || 'la durée initiale';
  const fmtFr = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const currentEnd = camp?.endsAt ? fmtFr.format(new Date(camp.endsAt)) : '—';
  const newEnd = (() => {
    if (!camp?.endsAt) return '—';
    const ms = { '1h': 3600e3, '24h': 86400e3, '48h': 172800e3, '7d': 7*86400e3 }[durationKey];
    if (!ms) return '—';
    return fmtFr.format(new Date(new Date(camp.endsAt).getTime() + ms));
  })();
  return (
    <div role="dialog" aria-modal="true" className="extend-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 230,
      overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      background: 'rgba(15, 22, 41, 0.55)', backdropFilter: 'blur(6px)',
      padding: '24px 16px 80px',
    }}>
      <div className="extend-modal-card" style={{
        position: 'relative', maxWidth: 540, width: '100%',
        background: 'var(--paper)', borderRadius: 18,
        padding: 'clamp(20px, 4vw, 32px)',
        boxShadow: '0 30px 80px -20px rgba(15,22,41,.4), 0 0 0 1px var(--line)',
        margin: 'auto 0', borderTop: '4px solid var(--accent)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px', borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--accent) 30%, var(--line))',
            color: 'var(--accent)',
          }}>
            <Icon name="clock" size={26} stroke={2}/>
          </div>
          <div className="serif" style={{ fontSize: 'clamp(20px, 3vw, 24px)', lineHeight: 1.2, marginBottom: 6 }}>
            Prolonger la campagne
          </div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, maxWidth: 460, margin: '0 auto' }}>
            On ajoute <strong style={{ color: 'var(--ink)' }}>{durationLabel}</strong> supplémentaires à
            <strong style={{ color: 'var(--ink)' }}> {camp?.name}</strong> moyennant <strong style={{ color: 'var(--ink)' }}>10 € HT</strong>.
            La durée ajoutée est identique à la durée initiale choisie.
          </div>
        </div>

        <ul style={{
          listStyle: 'none', padding: 0, margin: '0 0 14px',
          background: 'var(--ivory-2)', border: '1px solid var(--line)', borderRadius: 12,
          fontSize: 13, lineHeight: 1.55,
        }}>
          {[
            ['📅', <>Fin actuelle : <strong>{currentEnd}</strong></>],
            ['⏩', <>Nouvelle fin : <strong style={{ color: 'var(--accent)' }}>{newEnd}</strong></>],
            ['🔁', <><strong>Pas de nouvelle campagne</strong> : on prolonge celle-ci, code BUUPP, prospects matchés et brief restent identiques.</>],
            ['⚠️', <>Action irréversible : <strong>une campagne ne peut être prolongée qu'une seule fois</strong>.</>],
            ['💳', <>10 € HT débités immédiatement de votre solde — non remboursables.</>],
          ].map(([icon, text], i, arr) => (
            <li key={i} className="row" style={{
              gap: 12, padding: '10px 14px', alignItems: 'flex-start',
              borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
              <span style={{ color: 'var(--ink-2)' }}>{text}</span>
            </li>
          ))}
        </ul>

        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={submitting}
            style={{ flex: 1, minWidth: 120 }}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
            style={{ flex: 2, minWidth: 200 }}
          >
            {submitting ? 'Prolongation…' : <>Confirmer · 10 € HT <Icon name="arrow" size={12}/></>}
          </button>
        </div>

        <style>{`
          @media (max-width: 540px) {
            .extend-modal-overlay { align-items: stretch !important; padding: 0 !important; }
            .extend-modal-card { border-radius: 0 !important; min-height: 100vh; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ---------- Mes informations (entreprise) ----------
   Reprend la logique et le design de "Mes données" côté prospect : carte unique
   avec en-tête (icône + titre + chip), grille deux colonnes des champs, boutons
   éditer / supprimer par champ + bouton global "Tout supprimer". Modales pour
   l'édition et la confirmation de suppression. Le SIREN est facultatif et fait
   l'objet d'un message de confidentialité dédié. */

const PRO_INFO_FIELDS = [
  { key: 'raisonSociale',  label: 'Raison sociale / Nom de la société', placeholder: 'Atelier Mercier' },
  { key: 'formeJuridique', label: 'Forme juridique',                    placeholder: 'SARL, SAS, EI, Auto-entrepreneur…' },
  { key: 'adresse',        label: 'Adresse du siège social',            placeholder: '12 rue des Artisans' },
  { key: 'ville',          label: 'Ville',                              placeholder: 'Lyon' },
  // Champs facturation : facultatifs au sens "raison sociale + ville"
  // restent les seuls indispensables pour activer la création de
  // campagne, mais ils sont obligatoires pour générer une facture
  // conforme. La modale "Compléter la facture" les ramène au premier
  // plan au moment du téléchargement PDF.
  { key: 'capitalSocialEur', label: 'Capital social',                   placeholder: 'Montant en € (sociétés uniquement)', optional: true, mono: true },
  { key: 'siren',            label: 'SIREN',                            placeholder: '9 chiffres', optional: true, mono: true },
  { key: 'siret',            label: 'SIRET',                            placeholder: '14 chiffres — facultatif · nécessaire pour éditer votre facture', optional: true, mono: true },
  { key: 'rcsVille',         label: "Ville d'immatriculation RCS",      placeholder: 'Pau, Lyon… — facultatif · nécessaire pour éditer votre facture', optional: true },
  { key: 'rmNumber',         label: 'Numéro RM (artisans)',             placeholder: '— facultatif · nécessaire pour éditer votre facture —', optional: true, mono: true },
];

function MesInformations({ info, setInfo, returnAfterInfo, onCancelReturn }) {
  const [editing, setEditing] = useState(null); // { key, label, value }
  const [confirmFieldDelete, setConfirmFieldDelete] = useState(null); // { key, label }
  const [confirmAllDelete, setConfirmAllDelete] = useState(false);

  const filledRequired = PRO_INFO_FIELDS.filter(f => !f.optional && info[f.key]).length;
  const totalRequired = PRO_INFO_FIELDS.filter(f => !f.optional).length;
  const allEmpty = PRO_INFO_FIELDS.every(f => !info[f.key]);
  const isComplete = filledRequired === totalRequired;

  // Section vers laquelle le pro sera ramené automatiquement dès que les
  // deux champs requis (raison sociale + ville) sont renseignés. Voir
  // ProDashboard / useEffect [returnAfterInfo, companyInfo].
  const RETURN_LABELS = { create: 'la création de campagne' };
  const returnLabel = returnAfterInfo ? (RETURN_LABELS[returnAfterInfo] || 'la page précédente') : null;
  const requiredFilled =
    !!info?.raisonSociale?.trim() && !!info?.ville?.trim();

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Mes informations" title="Identité de votre société"
        desc="Renseignez ici les informations de votre entreprise. Elles permettent à BUUPP de vérifier votre activité et apparaissent sur vos factures. Toute modification est immédiatement prise en compte."/>

      {returnAfterInfo && (
        <div className="alert-block" style={{
          padding: 16, borderRadius: 12,
          background: requiredFilled
            ? 'color-mix(in oklab, var(--good) 10%, var(--paper))'
            : 'color-mix(in oklab, var(--accent) 8%, var(--paper))',
          border: '1.5px solid ' + (requiredFilled
            ? 'color-mix(in oklab, var(--good) 35%, var(--line))'
            : 'color-mix(in oklab, var(--accent) 30%, var(--line))'),
          color: 'var(--ink)',
          display: 'flex', gap: 14, alignItems: 'flex-start'
        }}>
          <div style={{
            width: 36, height: 36, minWidth: 36, borderRadius: '50%',
            background: requiredFilled ? 'var(--good)' : 'var(--accent)',
            color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={requiredFilled ? 'check' : 'arrow'} size={16} stroke={2.25}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {requiredFilled
                ? `Profil complet — retour à ${returnLabel}…`
                : `Complétez votre profil pour reprendre ${returnLabel}`}
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {requiredFilled
                ? 'Vous serez automatiquement ramené à votre étape précédente dans un instant.'
                : "Saisissez votre raison sociale et votre ville. Vous serez ramené automatiquement vers votre étape précédente dès que ces champs sont remplis."}
            </div>
          </div>
          {onCancelReturn && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={onCancelReturn}
              style={{ alignSelf: 'flex-start' }}
              title="Rester sur cette page sans redirection automatique"
            >
              Rester ici
            </button>
          )}
        </div>
      )}

      {/* SIREN confidentiality banner */}
      <div className="alert-block" style={{
        padding: '18px 22px', borderRadius: 12,
        background: 'color-mix(in oklab, var(--accent) 7%, var(--paper))',
        border: '1px solid color-mix(in oklab, var(--accent) 28%, var(--line))',
        color: 'var(--ink-2)',
        display: 'flex', gap: 14, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 36, height: 36, minWidth: 36, borderRadius: '50%',
          background: 'var(--accent)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="shield" size={16} stroke={2}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            Votre SIREN reste strictement confidentiel
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Le numéro SIREN <strong>n'est jamais diffusé aux utilisateurs</strong> ni affiché publiquement.
            Il sert uniquement à BUUPP pour <strong>vérifier l'existence légale</strong> de votre société
            auprès des registres officiels. Renseigner ce champ accélère la validation de votre compte
            et renforce la confiance des prospects que vous contactez.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: 'var(--ink-4)', letterSpacing: '.06em' }}>
            Champ facultatif · nécessaire pour éditer votre facture — usage interne BUUPP
          </div>
        </div>
      </div>

      {/* Plan switcher */}
      <PlanSwitcherSection/>

      {/* Completeness summary */}
      <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 28, alignItems: 'center' }}>
        <div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Complétude du profil entreprise</div>
          <div className="serif tnum" style={{ fontSize: 40 }}>
            {filledRequired}<span style={{ fontSize: 20, color: 'var(--ink-4)' }}> / {totalRequired}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {isComplete
              ? 'Toutes les informations obligatoires sont renseignées.'
              : 'Complétez les informations restantes pour finaliser votre profil.'}
          </div>
        </div>
        <div className="col gap-2">
          {PRO_INFO_FIELDS.map(f => {
            const filled = !!info[f.key];
            return (
              <div key={f.key}>
                <div className="row between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span className="muted">{f.label}{f.optional ? ' (facultatif · nécessaire pour éditer votre facture)' : ''}</span>
                  <span className="mono tnum">{filled ? '✓' : '—'}</span>
                </div>
                <div style={{ height: 6, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: filled ? '100%' : '0%',
                    background: f.optional ? 'var(--ink-4)' : 'var(--accent)',
                    transition: 'width .25s'
                  }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card: company info */}
      <div className="card" style={{ padding: 24, opacity: allEmpty ? 0.65 : 1 }}>
        <div className="row between mes-donnees-card-head" style={{ marginBottom: 16, alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div className="row pro-info-card-head" style={{ alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--ivory-2)', color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Icon name="briefcase" size={18}/>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="pro-info-title-row" style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 6
              }}>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1.1 }}>Informations société</div>
                <span className="chip" style={{ alignSelf: 'center' }}>Profil pro</span>
                {allEmpty && <span className="chip chip-warn" style={{ alignSelf: 'center' }}>Vide</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Raison sociale, adresse, ville et SIREN (facultatif · nécessaire pour éditer votre facture).
              </div>
            </div>
          </div>
          <div className="row gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmAllDelete(true)}
              style={{ color: 'var(--danger)' }}
              disabled={allEmpty}
              title={allEmpty ? 'Aucune information à supprimer' : 'Supprimer toutes les informations'}>
              <Icon name="trash" size={12}/> Tout supprimer
            </button>
          </div>
        </div>

        <div className="pro-info-fields-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1,
          background: 'var(--line)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)'
        }}>
          {PRO_INFO_FIELDS.map(f => {
            const val = info[f.key] || '';
            return (
              <div key={f.key} className="pro-info-tile" style={{
                background: 'var(--paper)', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
              }}>
                <div className="pro-info-tile-body" style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 3 }}>
                    {f.label}{f.optional ? ' · facultatif · nécessaire pour éditer votre facture' : ''}
                  </div>
                  <div
                    className={f.mono && val ? 'mono tnum' : ''}
                    style={{
                      fontSize: 14,
                      color: val ? 'var(--ink)' : 'var(--ink-5)',
                      fontStyle: val ? 'normal' : 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}
                  >
                    {val || '— non renseigné —'}
                  </div>
                </div>
                <div className="row gap-1 pro-info-tile-actions">
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                    onClick={() => setEditing({ key: f.key, label: f.label, value: val, mono: f.mono, placeholder: f.placeholder, optional: f.optional })}>
                    <Icon name="edit" size={11}/>
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }}
                    onClick={() => setConfirmFieldDelete({ key: f.key, label: f.label })}
                    disabled={!val}
                    title={val ? 'Supprimer cette donnée' : 'Aucune valeur à supprimer'}>
                    <Icon name="trash" size={11}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {/* Sur mobile, la grille 2 colonnes + label long + boutons d'actions
            poussait les boutons hors écran. Sous 640px, on passe en colonne
            unique et on empile texte / actions verticalement. */}
        <style>{`
          @media (max-width: 640px) {
            .pro-info-fields-grid { grid-template-columns: 1fr !important; }
            .pro-info-tile {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 10px !important;
            }
            .pro-info-tile-actions {
              justify-content: flex-end !important;
            }
            .pro-info-tile-body > div[class~="mono"] {
              white-space: normal !important;
            }
          }
        `}</style>
      </div>

      {/* Consentement RGPD/CNIL au pixel de tracking dans les broadcasts.
          Composant partagé avec le côté prospect (défini dans Prospect.jsx
          → scope global après transpile Babel-standalone). */}
      <EmailTrackingConsentCard/>

      {editing && (
        <ProInfoEditModal edit={editing}
          onSave={(v) => {
            // `onSave` accepte deux formes :
            //  - une string         → save single-field classique
            //  - { replaceFields }  → remplacement multi-champs depuis
            //    le bouton "Remplacer les informations collectées"
            //    affiché en cas de discordance SIRENE.
            if (v && typeof v === 'object' && v.replaceFields) {
              setInfo(prev => ({ ...prev, ...v.replaceFields }));
            } else {
              setInfo(prev => ({ ...prev, [editing.key]: v }));
            }
            setEditing(null);
          }}
          onAutoSave={(v) => {
            // Auto-save debounced : persiste sans fermer la modale.
            // `setInfo` côté ProDashboard PATCHe automatiquement
            // /api/pro/info pour chaque diff.
            setInfo(prev => ({ ...prev, [editing.key]: v }));
          }}
          onClose={() => setEditing(null)}/>
      )}
      {confirmFieldDelete && (
        <ProInfoFieldDeleteModal field={confirmFieldDelete}
          onConfirm={() => { setInfo(prev => ({ ...prev, [confirmFieldDelete.key]: '' })); setConfirmFieldDelete(null); }}
          onClose={() => setConfirmFieldDelete(null)}/>
      )}
      {confirmAllDelete && (
        <ProInfoAllDeleteModal
          onConfirm={() => {
            setInfo({ raisonSociale: '', adresse: '', ville: '', siren: '' });
            setConfirmAllDelete(false);
          }}
          onClose={() => setConfirmAllDelete(false)}/>
      )}
    </div>
  );
}

function PlanSwitcherSection() {
  const [plan, setPlan] = React.useState(null);
  const [specs, setSpecs] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(null); // 'starter' | 'pro' | null
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j) return;
        setPlan(j.plan || 'starter');
        setSpecs(j.specs || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const choose = async (target) => {
    if (target === plan || submitting) return;
    setSubmitting(target);
    setError(null);
    try {
      const r = await fetch('/api/pro/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: target }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || j?.error || 'Erreur');
      }
      setPlan(target);
      // Notifie le wizard ouvert (s'il y en a un) pour qu'il re-synchronise
      // son plan local sans recharger la page.
      try { window.dispatchEvent(new CustomEvent('pro:plan-changed', { detail: { plan: target } })); } catch {}
    } catch (e) {
      setError(e.message || 'Impossible de mettre à jour le plan');
    } finally {
      setSubmitting(null);
    }
  };

  const PLANS = [
    {
      id: 'starter',
      label: 'Starter',
      color: 'var(--ink)',
      maxProspects: specs?.starter?.maxProspects ?? 50,
      maxCampaigns: specs?.starter?.maxCampaigns ?? 2,
      monthlyEur: specs?.starter?.monthlyEur ?? 19,
      features: [
        "Jusqu'à 50 prospects par campagne",
        '2 campagnes par cycle',
        'Ciblage par paliers 1 à 3',
      ],
    },
    {
      id: 'pro',
      label: 'Pro',
      color: 'var(--accent)',
      badge: 'Recommandé',
      maxProspects: specs?.pro?.maxProspects ?? 500,
      maxCampaigns: specs?.pro?.maxCampaigns ?? 10,
      monthlyEur: specs?.pro?.monthlyEur ?? 59,
      features: [
        "Jusqu'à 500 prospects par campagne",
        '10 campagnes par cycle',
        'Tous les paliers 1 à 5',
        'Accès anticipé aux nouvelles fonctionnalités',
      ],
    },
  ];

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 16, gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 20, lineHeight: 1.2 }}>Formule d'abonnement</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
            La formule détermine le nombre de prospects par campagne, le nombre de campagnes incluses dans votre cycle
            et les paliers de données accessibles dans le wizard de création.
          </div>
        </div>
        {plan && (
          <span className="chip" style={{
            alignSelf: 'flex-start',
            background: plan === 'pro' ? 'color-mix(in oklab, var(--accent) 14%, var(--paper))' : 'var(--ivory-2)',
            color: plan === 'pro' ? 'var(--accent)' : 'var(--ink-2)',
            border: '1px solid ' + (plan === 'pro' ? 'color-mix(in oklab, var(--accent) 30%, var(--line))' : 'var(--line-2)'),
          }}>
            Formule actuelle : {plan === 'pro' ? 'Pro' : 'Starter'}
          </span>
        )}
      </div>

      <div className="plan-switcher-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {PLANS.map((p) => {
          const isCurrent = plan === p.id;
          const isLoading = submitting === p.id;
          return (
            <div key={p.id} style={{
              position: 'relative',
              padding: 18, borderRadius: 14,
              border: '1.5px solid ' + (isCurrent ? p.color : 'var(--line-2)'),
              background: isCurrent ? `color-mix(in oklab, ${p.color} 5%, var(--paper))` : 'var(--paper)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {p.badge && (
                <div style={{
                  position: 'absolute', top: -10, right: 12,
                  padding: '3px 10px', borderRadius: 999,
                  background: p.color, color: 'white',
                  fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '.1em',
                }}>{p.badge}</div>
              )}
              <div className="row between" style={{ alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div className="serif" style={{ fontSize: 22, color: p.color }}>{p.label}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  <span className="serif tnum" style={{ fontSize: 20, color: 'var(--ink)' }}>{p.monthlyEur} €</span>
                  <span className="muted"> / {p.maxCampaigns} campagnes</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f, i) => (
                  <li key={i} className="row" style={{ gap: 8, fontSize: 13, lineHeight: 1.4, alignItems: 'flex-start' }}>
                    <span style={{ color: p.color, flexShrink: 0, marginTop: 2 }}>
                      <Icon name="check" size={13} stroke={2.5}/>
                    </span>
                    <span style={{ color: 'var(--ink-2)' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className="btn"
                onClick={() => choose(p.id)}
                disabled={isCurrent || !!submitting}
                style={{
                  marginTop: 4,
                  background: isCurrent ? 'var(--ivory-2)' : (p.id === 'pro' ? p.color : 'var(--ink)'),
                  color: isCurrent ? 'var(--ink-3)' : 'var(--paper)',
                  border: '1.5px solid ' + (isCurrent ? 'var(--line-2)' : (p.id === 'pro' ? p.color : 'var(--ink)')),
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: submitting && !isLoading ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                aria-pressed={isCurrent}
              >
                {isLoading ? 'Mise à jour…' : isCurrent ? '✓ Formule actuelle' : `Passer en ${p.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div role="alert" style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#991B1B',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ProInfoModalShell({ title, children, onClose, width = 460 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,22,41,.5)', zIndex: 100,
        overflowY: 'auto',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
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

/* Petit indicateur d'auto-save affiché sous le champ d'édition.
   Donne au pro le feedback que ses modifications ont déjà été
   persistées sans qu'il ait besoin de cliquer "Enregistrer". */
function ProSaveIndicator({ status }) {
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

function ProInfoEditModal({ edit, onSave, onAutoSave, onClose }) {
  const isSiren = edit.key === 'siren';
  const isSiret = edit.key === 'siret';
  // Champs dont la valeur peut être croisée avec la fiche SIRENE.
  // Quand l'utilisateur les édite, on charge la fiche officielle à partir
  // du SIREN/SIRET déjà enregistré côté Mes informations, et on compare
  // la saisie courante au champ équivalent.
  const SIRENE_CHECKABLE = ['raisonSociale', 'adresse', 'ville', 'codePostal', 'formeJuridique'];
  const isCheckable = SIRENE_CHECKABLE.includes(edit.key);
  // Limites de saisie : 9 chiffres pour SIREN, 14 pour SIRET, libre sinon.
  const maxLen = isSiret ? 14 : isSiren ? 9 : undefined;
  const stripDigits = (s) => s.replace(/\D/g, '').slice(0, maxLen);
  const [val, setVal] = useState(
    isSiren || isSiret ? stripDigits(String(edit.value || '')) : (edit.value || ''),
  );

  // Pour la comparaison "votre saisie vs registre officiel", on récupère
  // l'état courant des Mes informations au moment de l'édition (utile
  // pour SIREN/SIRET qui veulent comparer raison sociale, adresse, etc.,
  // ET pour les champs vérifiables qui ont besoin du SIREN enregistré).
  const [proInfo, setProInfo] = useState(null);
  React.useEffect(() => {
    if (!isSiren && !isSiret && !isCheckable) return;
    let cancelled = false;
    fetch('/api/pro/info', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setProInfo(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isSiren, isSiret, isCheckable]);

  // Vérification SIRENE auto débouncée.
  // - Quand on édite SIREN/SIRET : on requête la valeur saisie (val).
  // - Quand on édite un champ vérifiable : on requête le SIREN/SIRET
  //   déjà enregistré côté pro.
  const [verify, setVerify] = useState({ status: 'idle', data: null });
  const lastQueryRef = React.useRef(null);
  React.useEffect(() => {
    let target = null;
    if (isSiret && /^\d{14}$/.test(val)) target = `siret:${val}`;
    else if (isSiren && /^\d{9}$/.test(val)) target = `siren:${val}`;
    else if (isCheckable && proInfo) {
      const piSiret = (proInfo.siret || '').replace(/\s+/g, '');
      const piSiren = (proInfo.siren || '').replace(/\s+/g, '');
      if (/^\d{14}$/.test(piSiret)) target = `siret:${piSiret}`;
      else if (/^\d{9}$/.test(piSiren)) target = `siren:${piSiren}`;
    }
    if (!target) {
      setVerify({ status: 'idle', data: null });
      lastQueryRef.current = null;
      return;
    }
    if (target === lastQueryRef.current) return;
    lastQueryRef.current = target;
    setVerify({ status: 'loading', data: null });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const [kind, num] = target.split(':');
        const qs = `${kind}=${encodeURIComponent(num)}`;
        const r = await fetch(`/api/pro/info/verify-company?${qs}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setVerify({ status: 'error', data: null }); return; }
        if (!j.found) { setVerify({ status: 'not_found', data: null }); return; }
        setVerify({ status: 'found', data: j });
      } catch {
        if (!cancelled) setVerify({ status: 'error', data: null });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [val, isSiren, isSiret, isCheckable, proInfo]);

  // Diff entre proInfo (raison sociale, adresse…) et la fiche SIRENE
  // — utilisé pour le bandeau multi-champs côté édition SIREN/SIRET.
  const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  const diffs =
    (isSiren || isSiret) && verify.status === 'found' && verify.data && proInfo
      ? [
          ['raisonSociale',  'Raison sociale',   proInfo.raisonSociale,  verify.data.raisonSociale],
          ['adresse',        'Adresse',          proInfo.adresse,        verify.data.adresse],
          ['ville',          'Ville',            proInfo.ville,          verify.data.ville],
          ['codePostal',     'Code postal',      proInfo.codePostal,     verify.data.codePostal],
          ['formeJuridique', 'Forme juridique',  proInfo.formeJuridique, verify.data.formeJuridique],
        ].filter(([, , user, off]) => off && user && norm(user) !== norm(off))
      : [];

  // Diff single-field — actif quand l'utilisateur modifie manuellement un
  // champ vérifiable (raison sociale, adresse…) et que sa saisie diffère
  // de la valeur officielle SIRENE pour ce même champ.
  const officialForCurrent =
    isCheckable && verify.status === 'found' && verify.data
      ? verify.data[edit.key]
      : null;
  const singleFieldDiff =
    isCheckable && officialForCurrent && val && norm(val) !== norm(officialForCurrent)
      ? officialForCurrent
      : null;
  // Acquittement utilisateur : "Non je maintiens mes informations" cache
  // le bandeau pour le reste de la session de la modale. Réinitialisé
  // à chaque changement de la valeur officielle (= nouvel appel
  // SIRENE qui ramène potentiellement une autre référence).
  const [singleFieldDismissed, setSingleFieldDismissed] = useState(false);
  React.useEffect(() => {
    setSingleFieldDismissed(false);
  }, [officialForCurrent]);

  // On bloque l'enregistrement quand le SIREN/SIRET est saisi mais
  // explicitement absent du registre — autoriser sinon (loading,
  // error réseau, longueur incomplète…) pour ne pas frustrer l'usage.
  const blockedByVerification =
    (isSiren || isSiret) && val && verify.status === 'not_found';
  const canSave =
    (edit.optional || val.trim()) && !blockedByVerification;

  // Auto-save : 700 ms après la dernière modif → PATCH sans fermer la
  // modale. Ne s'applique pas quand SIREN/SIRET est explicitement
  // introuvable au registre (l'utilisateur doit corriger avant de
  // persister une valeur invalide).
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  React.useEffect(() => {
    if (!onAutoSave) return;
    if (val === (edit.value || '')) return;
    if (blockedByVerification) return;
    if (!val.trim() && !edit.optional) return;
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      try {
        onAutoSave(val);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, blockedByVerification]);

  return (
    <ProInfoModalShell title={'Modifier : ' + edit.label} onClose={onClose}>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>
        {edit.label}{edit.optional ? ' · facultatif · nécessaire pour éditer votre facture' : ''}
      </div>
      <input
        className={'input' + (edit.mono ? ' mono' : '')}
        value={val}
        onChange={e => setVal(
          (isSiren || isSiret) ? stripDigits(e.target.value) : e.target.value,
        )}
        placeholder={edit.placeholder}
        autoFocus
        inputMode={(isSiren || isSiret) ? 'numeric' : undefined}
        maxLength={maxLen}
        style={{ width: '100%', fontSize: 14, marginBottom: 10 }}
      />
      {(isSiren || isSiret) && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          {isSiret ? '14 chiffres' : '9 chiffres'}. Vérification automatique sur le registre officiel SIRENE / data.gouv.fr.
        </div>
      )}

      {/* Statut vérification SIRENE */}
      {(isSiren || isSiret) && verify.status === 'loading' && (
        <div role="status" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
          color: 'var(--ink-3)', fontSize: 12.5,
        }}>
          Vérification en cours sur le registre officiel…
        </div>
      )}
      {(isSiren || isSiret) && verify.status === 'not_found' && (
        <div role="alert" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1.5px solid #FCA5A5',
          color: '#991B1B', fontSize: 12.5, lineHeight: 1.5,
        }}>
          ❌ <strong>Numéro introuvable</strong> dans le registre officiel SIRENE. Vérifiez votre saisie — l'enregistrement est bloqué tant que le numéro n'est pas valide.
        </div>
      )}
      {(isSiren || isSiret) && verify.status === 'error' && (
        <div role="status" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: '#FEF3C7', border: '1px solid #FCD34D',
          color: '#78350F', fontSize: 12.5,
        }}>
          Vérification temporairement indisponible — vous pouvez quand même enregistrer.
        </div>
      )}
      {(isSiren || isSiret) && verify.status === 'found' && diffs.length === 0 && (
        <div role="status" style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 10,
          background: 'color-mix(in oklab, var(--good) 10%, var(--paper))',
          border: '1.5px solid color-mix(in oklab, var(--good) 35%, var(--line))',
          color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5,
        }}>
          ✅ <strong>Validé</strong> — numéro reconnu dans le registre officiel
          {verify.data?.raisonSociale ? ` (${verify.data.raisonSociale})` : ''}.
        </div>
      )}
      {(isSiren || isSiret) && verify.status === 'found' && diffs.length > 0 && (
        <div role="alert" style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 10,
          background: '#FEF3C7', border: '1.5px solid #FCD34D',
          color: '#78350F', fontSize: 12.5, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#78350F' }}>
            ⚠ Numéro reconnu mais discordances avec vos informations société
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {diffs.map(([key, label, user, official]) => (
              <li key={key} style={{ marginBottom: 2 }}>
                <strong>{label}</strong> — vos infos : « {user || '∅'} » · officiel : « {official} »
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              // Construit le patch des champs concernés et passe la
              // commande au parent en plus du SIREN/SIRET en cours
              // d'édition. Le parent détecte la forme `replaceFields`
              // et fait un PATCH unique sur /api/pro/info.
              const replaceFields = {};
              for (const [key, , , official] of diffs) {
                replaceFields[key] = official || '';
              }
              // On inclut aussi le champ courant pour qu'il soit bien
              // persisté (le parent ne le ferait pas seul si on saute
              // le mode "single value" via onSave).
              replaceFields[edit.key] = val.trim();
              // Si on confirme un SIRET sans SIREN saisi, alignons
              // également le SIREN sur la valeur officielle (les 9
              // premiers chiffres du SIRET correspondent au SIREN).
              if (isSiret && verify.data?.siren) {
                replaceFields.siren = verify.data.siren;
              }
              onSave({ replaceFields });
            }}
            className="btn btn-sm"
            style={{
              marginTop: 10,
              background: '#7C3AED', color: 'white', borderColor: '#7C3AED',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Remplacer les informations collectées
          </button>
          <div style={{ fontSize: 11.5, marginTop: 8, color: '#78350F' }}>
            Le clic remplace en une fois Raison sociale, Adresse, Ville,
            Code postal et Forme juridique par les valeurs officielles SIRENE.
          </div>
        </div>
      )}

      {/* Vérification single-field : raison sociale, adresse, ville,
          code postal ou forme juridique modifiés manuellement et qui
          divergent de la valeur officielle SIRENE pour ce même champ. */}
      {singleFieldDiff && !singleFieldDismissed && (
        <div role="alert" style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 10,
          background: '#FEF3C7', border: '1.5px solid #FCD34D',
          color: '#78350F', fontSize: 12.5, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#78350F' }}>
            ⚠ Cette valeur ne correspond pas au registre officiel SIRENE
          </div>
          <div>
            Officiel : <strong>« {singleFieldDiff} »</strong>
          </div>
          <div className="row gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setVal(singleFieldDiff)}
              className="btn btn-sm"
              style={{
                background: '#7C3AED', color: 'white', borderColor: '#7C3AED',
              }}
            >
              Remplacer par la valeur officielle
            </button>
            <button
              type="button"
              onClick={() => setSingleFieldDismissed(true)}
              className="btn btn-ghost btn-sm"
              style={{ color: '#78350F', borderColor: '#FCD34D' }}
            >
              Non, je maintiens mes informations
            </button>
          </div>
          <div style={{ fontSize: 11.5, marginTop: 8, color: '#78350F' }}>
            Vérification croisée à partir du SIREN/SIRET enregistré dans Mes informations. « Maintenir » ne touche qu'à <strong>{edit.label.toLowerCase()}</strong> — les autres champs restent inchangés.
          </div>
        </div>
      )}

      <ProSaveIndicator status={saveStatus} />
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        <button
          onClick={() => onSave(val.trim())}
          className="btn btn-primary btn-sm"
          disabled={!canSave}
          title={blockedByVerification ? 'Numéro non reconnu dans SIRENE' : undefined}
        >
          Enregistrer
        </button>
      </div>
    </ProInfoModalShell>
  );
}

function ProInfoFieldDeleteModal({ field, onConfirm, onClose }) {
  // raison sociale + ville sont les deux champs affichés dans les annonces
  // de campagne — leur suppression bloque tout lancement de campagne.
  const blocksCampaign = field.key === 'raisonSociale' || field.key === 'ville';
  return (
    <ProInfoModalShell title={'Supprimer : ' + field.label} onClose={onClose}>
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
            {blocksCampaign ? 'Information obligatoire — bloque le lancement de campagne' : 'Information requise pour vos campagnes'}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            En supprimant <strong>{field.label}</strong>, votre profil entreprise devient incomplet.
            Cette information est <strong>nécessaire</strong> pour vérifier votre activité et apparaît
            sur vos factures.
            {blocksCampaign && (
              <>
                <br/><br/>
                Surtout, <strong>{field.label.toLowerCase()}</strong> est{' '}
                <strong>obligatoire</strong> pour permettre aux prospects de connaître l'identité
                de l'entreprise qui souhaite les solliciter. Tant que cette information ne sera
                pas renseignée, <strong>il vous sera impossible de lancer une nouvelle campagne</strong>.
              </>
            )}
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
    </ProInfoModalShell>
  );
}

function ProInfoAllDeleteModal({ onConfirm, onClose }) {
  return (
    <ProInfoModalShell title="Tout supprimer ?" onClose={onClose}>
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
            Profil entreprise vide
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Vous êtes sur le point de supprimer <strong>l'ensemble</strong> des informations
            de votre société (raison sociale, adresse, ville, SIREN). Tant que ces informations
            ne sont pas renseignées à nouveau, BUUPP ne pourra plus vérifier votre activité
            ni générer vos factures.
            <br/><br/>
            En particulier, le <strong>nom de votre société</strong> est{' '}
            <strong>obligatoire</strong> pour être affiché dans l'annonce de toute campagne
            que vous lancerez — sans lui, aucune campagne ne pourra être diffusée auprès
            des prospects.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: '#991B1B', letterSpacing: '.06em' }}>
            Action réversible — vous pourrez tout réécrire depuis cette page
          </div>
        </div>
      </div>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={onConfirm} className="btn btn-sm" style={{ background: '#DC2626', color: 'white' }}>
          <Icon name="trash" size={12}/> Confirmer la suppression
        </button>
      </div>
    </ProInfoModalShell>
  );
}

Object.assign(window, { ProDashboard });
