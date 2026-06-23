// Pro dashboard
var { useState, useEffect } = React;
const PRO_SECTIONS = [
  { id: 'create',       icon: 'plus',      label: 'Créer une campagne', featured: true },
  { id: 'overview',     icon: 'chart',     label: "Vue d'ensemble" },
  { id: 'campagnes',    icon: 'target',    label: 'Campagnes' },
  { id: 'contacts',     icon: 'users',     label: 'Mes prospects' },
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
  // Champ de « Mes informations » vers lequel scroller à l'arrivée (ex. le pro
  // clique « Mes informations » depuis la note adresse du ciblage « autour de
  // moi » → on l'amène directement au bloc adresse/ville, pas en haut). One-shot.
  const [infoScrollField, setInfoScrollField] = useState(null);

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
    region: '',
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
    // Navigation manuelle (sidebar) → on n'hérite pas d'un scroll ciblé posé
    // par un autre écran (ex. note adresse « autour de moi »).
    setInfoScrollField(null);
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
          // Édition de l'adresse (ciblage « autour de moi ») : on N'ARME PAS le
          // retour auto. La raison sociale + la ville étant déjà remplies à ce
          // stade, returnAfterInfo provoquerait un rebond immédiat vers le
          // wizard (cf. useEffect [returnAfterInfo, companyInfo]). Le pro édite
          // son adresse puis revient manuellement — le brouillon restaure l'étape 4.
          onEditAddress={() => { setReturnAfterInfo(null); setInfoScrollField('adresse'); setSec('informations'); }}
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
          scrollToFieldKey={infoScrollField}
          onScrolled={() => setInfoScrollField(null)}
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
  // Modale "Voir tout" — liste paginée de TOUTES les acceptations
  // (la section n'en montre que 4). Fermée par défaut.
  const [allAcceptancesOpen, setAllAcceptancesOpen] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const refresh = () => fetchProOverview().then(j => { if (!cancelled) setData(j); });
    // Le cache module n'est invalidé que par les actions du pro ; or les
    // acceptations arrivent côté PROSPECT (hors de cette session). On force
    // donc un fetch FRAIS à chaque ouverture de « Vue d'ensemble » pour que
    // « Dernières acceptations » et les KPI reflètent les acceptations récentes.
    invalidateProOverview();
    refresh();
    const onChange = () => { invalidateProOverview(); refresh(); };
    window.addEventListener('pro:overview-changed', onChange);
    // Rafraîchit aussi au retour sur l'onglet du navigateur (focus).
    const onFocus = () => { invalidateProOverview(); refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('pro:overview-changed', onChange);
      window.removeEventListener('focus', onFocus);
    };
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
            <CardEmptyState
              compact
              image="/empty-tiers.png"
              alt="Aucun contact pour le moment"
              tint="#F59E0B"
              title="Aucun palier rempli"
              sub="Dès que des prospects accepteront vos campagnes, ils se répartiront ici par palier."
            />
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
          <button
            className="btn btn-ghost btn-sm btn-voir-tout"
            onClick={() => setAllAcceptancesOpen(true)}
            disabled={last.length === 0}
            title={last.length === 0 ? 'Aucune acceptation à afficher' : 'Voir toutes les acceptations'}
          >
            Voir tout <Icon name="arrow" size={12}/>
          </button>
        </div>
        {last.length === 0 ? (
          <CardEmptyState
            image="/empty-contacts.png"
            alt="Aucune acceptation pour le moment"
            tint="#10B981"
            title="Première acceptation à venir"
            sub="Vos plus récentes mises en relation acceptées s'afficheront ici, avec le palier et le coût unitaire."
          />
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Prospect</th><th>Campagne</th><th>Palier</th><th>Fiabilité</th><th>BUUPP Score</th><th>Reçu</th><th style={{textAlign:'right'}}>Coût</th></tr></thead>
              <tbody>
                {last.map((r, i) => (
                  <tr key={i}>
                    <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                    <td>{r.campaign}</td>
                    <td><span className="chip">Palier {r.tier}</span></td>
                    <td>
                      {(() => {
                        // Statut « priorité de traitement » enregistré sur la
                        // fiche du prospect (ProspectDetailsModal). Affiché ici
                        // si défini ; sinon tiret. Mêmes couleurs/icône que le
                        // filtre et la fiche (FIABILITE_OPTS).
                        const po = FIABILITE_OPTS.find(o => o.v === r.priority);
                        if (!po) return <span className="muted">—</span>;
                        return (
                          <span
                            title={`Fiabilité : ${po.label}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 999,
                              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                              color: po.color,
                              background: `color-mix(in oklab, ${po.color} 12%, var(--paper))`,
                              border: `1px solid color-mix(in oklab, ${po.color} 35%, var(--line))`,
                            }}
                          >
                            <Icon name={po.icon} size={11}/> {po.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td><span className="mono tnum">{r.score}</span></td>
                    <td className="muted mono">{formatRelativeFr(r.receivedAt)}</td>
                    <td className="mono tnum" style={{ textAlign: 'right' }}>−{fmt2(r.costCents/100)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {allAcceptancesOpen && (
        <AllAcceptancesModal
          fmt2={fmt2}
          onClose={() => setAllAcceptancesOpen(false)}
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

/* ─── AllAcceptancesModal — "Voir tout" des acceptations ───────────
   Affiche jusqu'à MAX (50) acceptations les plus récentes du pro (la
   section Vue d'ensemble n'en montre que 4). Plafond volontaire : pas
   de pagination au-delà de 50. Données réelles via /api/pro/acceptances
   (l'endpoint borne déjà size à 50). Responsive : table en .tbl-scroll
   (scroll horizontal mobile géré par styles.css). */
const ALL_ACCEPTANCES_MAX = 50;
function AllAcceptancesModal({ fmt2, onClose }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/pro/acceptances?page=1&size=${ALL_ACCEPTANCES_MAX}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => {
        if (cancelled) return;
        // Garde-fou client : même si l'API renvoyait plus, on tronque.
        setRows((j.rows || []).slice(0, ALL_ACCEPTANCES_MAX));
        setTotal(j.total || 0);
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const capped = total > ALL_ACCEPTANCES_MAX;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-acceptances-title"
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
          maxWidth: 820, width: '100%',
          boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
          margin: 'auto 0',
        }}>
        <div className="row between" style={{ marginBottom: 4, alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div id="all-acceptances-title" className="serif" style={{ fontSize: 22, lineHeight: 1.25 }}>
              Toutes les acceptations
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {loading && rows.length === 0
                ? 'Chargement…'
                : capped
                  ? `${ALL_ACCEPTANCES_MAX} plus récentes affichées · ${total} au total`
                  : `${total} acceptation${total > 1 ? 's' : ''} au total`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{
              background: 'transparent', border: 0, color: 'var(--ink-4)',
              fontSize: 20, lineHeight: 1, padding: 4, cursor: 'pointer', flexShrink: 0,
            }}>✕</button>
        </div>

        {error && (
          <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: '3px solid #dc2626', background: '#fef2f2', color: '#991b1b', fontSize: 13 }}>
            Impossible de charger les acceptations : {error}
          </div>
        )}

        <div className="tbl-scroll" style={{ marginTop: 16 }}>
          <table className="tbl">
            <thead><tr><th>Prospect</th><th>Campagne</th><th>Palier</th><th>Fiabilité</th><th>BUUPP Score</th><th>Reçu</th><th style={{textAlign:'right'}}>Coût</th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '28px 12px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Chargement des acceptations…</span>
                </td></tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '28px 12px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Aucune acceptation pour le moment.</span>
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                  <td>{r.campaign}</td>
                  <td><span className="chip">Palier {r.tier}</span></td>
                  <td>
                    {(() => {
                      // Statut priorité de traitement (cf. fiche prospect) ;
                      // tiret si non défini. Mêmes couleurs/icône (FIABILITE_OPTS).
                      const po = FIABILITE_OPTS.find(o => o.v === r.priority);
                      if (!po) return <span className="muted">—</span>;
                      return (
                        <span
                          title={`Fiabilité : ${po.label}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 999,
                            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                            color: po.color,
                            background: `color-mix(in oklab, ${po.color} 12%, var(--paper))`,
                            border: `1px solid color-mix(in oklab, ${po.color} 35%, var(--line))`,
                          }}
                        >
                          <Icon name={po.icon} size={11}/> {po.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td><span className="mono tnum">{r.score}</span></td>
                  <td className="muted mono">{formatRelativeFr(r.receivedAt)}</td>
                  <td className="mono tnum" style={{ textAlign: 'right' }}>−{fmt2(r.costCents/100)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && capped && (
          <div className="muted" style={{ fontSize: 12, marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
            Affichage limité aux {ALL_ACCEPTANCES_MAX} acceptations les plus récentes.
            {' '}Retrouvez l'historique complet dans l'onglet Facturation.
          </div>
        )}
      </div>
    </div>
  );
}

/* Empty-state compact à intégrer DANS une card existante (overview /
   analytics). Même langage visuel que les autres empty states (cercle
   pastel + illustration 3D thiings.co + titre serif + sous-texte) mais
   tailles réduites pour rester dans une card de tableau de bord. */
function CardEmptyState({ image, alt, title, sub, tint, compact }) {
  const ringSize = compact ? 120 : 148;
  const imgSize = compact ? 92 : 116;
  const t = tint || '#7C3AED';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: compact ? '18px 12px' : '24px 16px',
    }}>
      <div style={{
        width: ringSize, height: ringSize, borderRadius: '50%',
        background: 'color-mix(in oklab, ' + t + ' 10%, var(--paper))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <img src={image} alt={alt || ''} width={imgSize} height={imgSize}
          loading="lazy" decoding="async"
          style={{ objectFit: 'contain' }}/>
      </div>
      <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-4)', maxWidth: 320 }}>
        {sub}
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
      ) : totalCount === 0 ? (
        <CardEmptyState
          image="/empty-performance.png"
          alt="Aucune donnée de performance"
          tint="#7C3AED"
          title="Pas encore de courbe à tracer"
          sub="Vos acceptations apparaîtront ici dès qu'une campagne tourne."
        />
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

/* ─── Liste premium des campagnes — repris à l'identique de la maquette
   public/prototype/Campagnes - Liste premium.html (palette par type, tuiles
   de stats, barre dégradée, chip code cuivré). Icônes = tracés SVG exacts. */
function LcIcon({ name }) {
  const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'survey':   return <svg {...s} strokeWidth="1.7"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 3v2h8V3"/></svg>;
    case 'download': return <svg {...s} strokeWidth="1.7"><path d="M12 4v10m0 0l4-4m-4 4l-4-4"/><path d="M5 20h14"/></svg>;
    case 'promo':    return <svg {...s} strokeWidth="1.7"><path d="M21 11.5 12.5 3H4v8.5L12.5 20z"/><circle cx="8.5" cy="7.5" r="1.4"/></svg>;
    case 'event':    return <svg {...s} strokeWidth="1.7"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9.5 14.5l1.8 1.8 3.2-3.2"/></svg>;
    case 'flash':    return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/></svg>;
    case 'budget':   return <svg {...s} strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.2C14 8.3 13 8 12 8c-1.6 0-2.5.9-2.5 2s.9 1.7 2.5 2 2.5.9 2.5 2-1 2-2.5 2c-1 0-2-.3-2.5-1.2"/></svg>;
    case 'touch':    return <svg {...s} strokeWidth="1.8"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-4-2l-2.3-3a1.5 1.5 0 0 1 2.4-1.8L9 15"/></svg>;
    case 'contact':  return <svg {...s} strokeWidth="1.8"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="8" r="4"/><path d="M16 11l1.8 1.8L21 9.5"/></svg>;
    case 'lock':     return <svg {...s} strokeWidth="1.9"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case 'copy':     return <svg {...s} strokeWidth="1.9"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>;
    case 'pause':    return <svg {...s} strokeWidth="2"><path d="M9 5v14M15 5v14"/></svg>;
    case 'play':     return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>;
    case 'edit':     return <svg {...s} strokeWidth="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>;
    case 'arrow':    return <svg {...s} strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'tag':      return <svg {...s} strokeWidth="1.8"><path d="M3 7.5V4h3.5L20 17.5 16.5 21z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>;
    default: return null;
  }
}

// Couleur + icône par type d'objectif (clés = objectiveLabel renvoyé par l'API).
const LC_TYPE_STYLE = {
  'Études & collecte d’avis': { color: 'teal', icon: 'survey' },
  "Études & collecte d'avis":      { color: 'teal', icon: 'survey' },
  'Contenus à télécharger':        { color: 'indigo', icon: 'download' },
  'Promotions & fidélisation':     { color: 'amber', icon: 'promo' },
  'Événementiel & inscription':    { color: 'blue', icon: 'event' },
  'Prise de contact direct':       { color: 'rose', icon: 'contact' },
  'Prise de rendez-vous':          { color: 'teal', icon: 'contact' },
  'Publicité digitale':            { color: 'indigo', icon: 'promo' },
};
function lcStyleFor(c) {
  // Flash deal (durée 1 h) → corail + éclair, quel que soit l'objectif.
  if (c.durationKey === '1h') return { color: 'coral', icon: 'flash' };
  return LC_TYPE_STYLE[c.objectiveLabel] || { color: 'indigo', icon: 'contact' };
}
function lcEur(n) {
  return Number(n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

const LIST_CARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.lc-list{
  --lc-paper:#f4f1ea; --lc-paper-warm:#efeadd; --lc-card:#fffdf8;
  --lc-ink:#161a1d; --lc-ink-2:#3c444b; --lc-ink-3:#757d83; --lc-ink-4:#9aa0a4;
  --lc-line:rgba(22,26,29,0.10); --lc-line-soft:rgba(22,26,29,0.055);
  --lc-indigo:#5a57d6; --lc-indigo-soft:#ecebfb;
  --lc-amber:#b9842a; --lc-amber-soft:#f6ecd6; --lc-amber-xsoft:#faf4e6;
  --lc-teal:#1c8a6e; --lc-teal-soft:#d9efe6;
  --lc-rose:#c14d77; --lc-rose-soft:#f7e2ea;
  --lc-blue:#2f72c4; --lc-blue-soft:#dbe9f8;
  --lc-coral:#d6432f; --lc-coral-soft:#f7e0dd;
  --lc-green:#2e9e5b; --lc-green-soft:#dcf0e3;
  --lc-shadow-sm:0 1px 2px rgba(22,26,29,0.04), 0 3px 12px rgba(22,26,29,0.05);
  --lc-shadow-md:0 2px 6px rgba(22,26,29,0.05), 0 14px 32px rgba(22,26,29,0.08);
  display:flex; flex-direction:column; gap:18px;
  font-family:"Hanken Grotesk", system-ui, sans-serif; color:var(--lc-ink);
}
.lc-serif{ font-family:"Newsreader", Georgia, serif; }
.lc-camp *{ box-sizing:border-box; }
.lc-camp{ position:relative; background:var(--lc-card); border:1px solid var(--lc-line); border-radius:20px; box-shadow:var(--lc-shadow-sm); padding:22px 24px; overflow:hidden; transition:box-shadow .18s; }
.lc-camp:hover{ box-shadow:var(--lc-shadow-md); }
.lc-camp::before{ content:""; position:absolute; top:0; left:0; right:0; height:3px; background:var(--lc-c); }
.lc-glow{ position:absolute; top:-40px; right:-30px; width:180px; height:180px; border-radius:50%; background:var(--lc-c); opacity:0.05; filter:blur(8px); pointer-events:none; }
.lc-c-top{ display:flex; align-items:flex-start; gap:16px; }
.lc-c-ic{ width:50px; height:50px; border-radius:14px; background:var(--lc-c-soft); color:var(--lc-c); display:grid; place-items:center; flex:none; }
.lc-c-ic svg{ width:24px; height:24px; }
.lc-c-head{ flex:1; min-width:0; }
.lc-c-title-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; row-gap:9px; }
.lc-c-name{ font-family:"Newsreader", serif; font-weight:600; font-size:25px; letter-spacing:-0.015em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:360px; }
.lc-status{ display:inline-flex; align-items:center; gap:7px; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:600; }
.lc-status .sd{ width:7px; height:7px; border-radius:50%; }
.lc-status.active{ background:var(--lc-green-soft); color:#1d7a44; }
.lc-status.active .sd{ background:var(--lc-green); box-shadow:0 0 0 3px rgba(46,158,91,0.2); }
.lc-status.done{ background:rgba(22,26,29,0.06); color:var(--lc-ink-3); }
.lc-status.done .sd{ background:var(--lc-ink-4); }
.lc-status.pause{ background:var(--lc-amber-soft); color:#9a6c1f; }
.lc-status.pause .sd{ background:var(--lc-amber); }
.lc-code-chip{ display:inline-flex; align-items:center; gap:9px; padding:6px 8px 6px 12px; border-radius:10px; background:var(--lc-amber-xsoft); border:1px solid rgba(185,132,42,0.28); }
.lc-code-chip .ck{ font-family:"IBM Plex Mono", monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9a6c1f; display:inline-flex; align-items:center; gap:5px; }
.lc-code-chip .ck svg{ width:11px; height:11px; }
.lc-code-chip .cv{ font-family:"IBM Plex Mono", monospace; font-size:13px; font-weight:600; letter-spacing:0.08em; color:#7c5414; }
.lc-code-chip .copy{ width:24px; height:24px; border-radius:7px; background:#fff; border:1px solid rgba(185,132,42,0.3); color:#9a6c1f; display:grid; place-items:center; cursor:pointer; }
.lc-code-chip .copy svg{ width:12px; height:12px; }
.lc-c-meta{ margin-top:8px; font-size:13.5px; color:var(--lc-ink-3); display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.lc-c-meta .dotsep{ width:3px; height:3px; border-radius:50%; background:var(--lc-ink-4); }
.lc-c-meta b{ color:var(--lc-ink-2); font-weight:600; }
.lc-c-tagline{ margin-top:9px; display:inline-flex; align-items:center; gap:8px; font-family:"Newsreader", serif; font-style:italic; font-size:15px; color:var(--lc-c); max-width:100%; }
.lc-c-tagline svg{ width:14px; height:14px; flex:none; }
.lc-c-tagline span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lc-c-actions{ display:flex; gap:8px; flex-wrap:wrap; align-self:flex-start; flex:none; justify-content:flex-end; max-width:420px; }
.lc-act{ display:inline-flex; align-items:center; gap:7px; padding:9px 14px; border-radius:11px; border:1px solid var(--lc-line); background:var(--lc-card); color:var(--lc-ink-2); font-weight:600; font-size:13.5px; cursor:pointer; white-space:nowrap; transition:border-color .15s, background .15s, box-shadow .15s; }
.lc-act svg{ width:14px; height:14px; }
.lc-act:hover{ border-color:rgba(22,26,29,0.22); box-shadow:var(--lc-shadow-sm); }
.lc-act.primary{ background:var(--lc-ink); color:#fff; border-color:var(--lc-ink); }
.lc-act.primary:hover{ box-shadow:0 6px 16px rgba(22,26,29,0.22); }
.lc-c-foot{ margin-top:20px; padding-top:18px; border-top:1px dashed var(--lc-line); display:flex; flex-direction:column; gap:18px; }
.lc-stats-row{ display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
.lc-stat{ display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:13px; background:var(--lc-paper); border:1px solid var(--lc-line-soft); }
.lc-stat .sic{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex:none; }
.lc-stat .sic svg{ width:17px; height:17px; }
.lc-stat .sk{ font-family:"IBM Plex Mono", monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--lc-ink-4); }
.lc-stat .sv{ font-family:"Newsreader", serif; font-weight:600; font-size:21px; line-height:1; margin-top:3px; letter-spacing:-0.01em; }
.lc-stat .sv small{ font-size:13px; color:var(--lc-ink-4); font-weight:500; }
.lc-progress{ min-width:0; }
.lc-progress .pl{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:8px; }
.lc-progress .pt{ font-family:"IBM Plex Mono", monospace; font-size:10.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--lc-ink-3); }
.lc-progress .pv{ font-family:"IBM Plex Mono", monospace; font-size:12.5px; color:var(--lc-ink-2); }
.lc-progress .pv b{ color:var(--lc-ink); }
.lc-track{ height:9px; border-radius:999px; background:var(--lc-paper-warm); overflow:hidden; position:relative; }
.lc-track .fill{ height:100%; border-radius:999px; background:linear-gradient(90deg, var(--lc-c), color-mix(in oklab, var(--lc-c) 60%, #fff)); position:relative; }
.lc-track .fill::after{ content:""; position:absolute; right:0; top:50%; transform:translateY(-50%); width:7px; height:7px; border-radius:50%; background:#fff; box-shadow:0 0 0 2px var(--lc-c); }
.lc-progress .note{ margin-top:7px; font-size:11.5px; color:var(--lc-ink-4); }
@media (max-width: 760px){
  .lc-stats-row{ grid-template-columns:1fr; }
  .lc-c-top{ flex-wrap:wrap; }
  .lc-c-actions{ max-width:none; width:100%; justify-content:flex-start; }
  .lc-c-name{ max-width:100%; }
}
`;

function Campagnes({ onCreate, onDetail, onDuplicate }) {
  const [filter, setFilter] = useState('all');
  const [camps, setCamps] = useState(null); // null = loading
  const [reloadKey, setReloadKey] = useState(0);
  // Modale d'info pause 48h (s'ouvre quand le pro clique sur "Pause"
  // pour une campagne 7d éligible). On stocke la campagne ciblée pour
  // la confirmation ; null = modale fermée.
  const [pausePromptCamp, setPausePromptCamp] = useState(null);
  // Campagne en cours d'édition (popup « Modifier ») ; null = fermée.
  const [editCampId, setEditCampId] = useState(null);

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
      <div className="col gap-3 lc-list">
        <style>{LIST_CARD_CSS}</style>
        {camps === null && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
          </div>
        )}
        {camps !== null && camps.length === 0 && (
          // Empty state aligné sur le pattern déjà utilisé pour la boîte aux
          // lettres (cf. Prospect.jsx) : cercle pastel + illustration 3D
          // thiings.co + titre serif + sous-texte amical. L'image est dans
          // public/empty-campaigns.png.
          <div
            className="card"
            style={{
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 176,
                height: 176,
                borderRadius: '50%',
                background: 'color-mix(in oklab, #F97316 10%, var(--paper))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <img
                src="/empty-campaigns.png"
                alt="Fusée prête à décoller"
                width={140}
                height={140}
                loading="lazy"
                decoding="async"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div
              className="serif"
              style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}
            >
              Prêt à décoller&nbsp;?
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink-4)',
                maxWidth: 320,
                marginBottom: 18,
              }}
            >
              Lancez votre première campagne pour atteindre des prospects qualifiés en quelques minutes.
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
          const statusKey = c.status === 'active' ? 'active' : c.status === 'paused' ? 'pause' : 'done';
          const statusLabel = c.status === 'active' ? 'Active' : c.status === 'paused' ? 'En pause' : 'Terminée';
          const dateStr = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(c.createdAt));
          const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
          const isActive = c.status === 'active';
          const isPaused = c.status === 'paused';
          const showPauseAction = isActive && c.pauseEligible;
          const showResumeAction = isPaused;
          const sty = lcStyleFor(c);
          // Budget effectif = budget + 10 % commission BUUPP (débit wallet intégral).
          const budgetTotal = c.budgetEur * 1.10;
          const spentTotal = c.spentEur * 1.10;
          const pct = budgetTotal > 0 ? Math.min(100, Math.round(spentTotal / budgetTotal * 100)) : 0;
          const reached = Number(c.reachedCount ?? 0);
          const acceptRate = reached > 0 ? Math.round(Number(c.contactsCount ?? 0) / reached * 100) : 0;
          return (
            <div
              key={c.id}
              className="lc-camp"
              style={{ '--lc-c': `var(--lc-${sty.color})`, '--lc-c-soft': `var(--lc-${sty.color}-soft)` }}
            >
              <div className="lc-glow"/>
              <div className="lc-c-top">
                <div className="lc-c-ic" title={c.objectiveLabel}><LcIcon name={sty.icon}/></div>
                <div className="lc-c-head">
                  <div className="lc-c-title-row">
                    <span className="lc-c-name" title={c.name}>{c.name}</span>
                    <span className={'lc-status ' + statusKey}><span className="sd"/>{statusLabel}</span>
                    {c.authCode && (
                      <span className="lc-code-chip" title="À fournir au prospect lors de la prise de contact pour authentifier le service BUUPP.">
                        <span className="ck"><LcIcon name="lock"/>Code buupp</span>
                        <span className="cv">{c.authCode}</span>
                        <span
                          className="copy" role="button" title="Copier le code"
                          onClick={() => { try { navigator.clipboard?.writeText(c.authCode); } catch (e) { void e; } }}
                        ><LcIcon name="copy"/></span>
                      </span>
                    )}
                  </div>
                  <div className="lc-c-meta">
                    {c.objectiveLabel}<span className="dotsep"/>créée le <b>{dateStr}</b><span className="dotsep"/>coût unitaire moyen <b>{fmt2(c.avgCostEur)} €</b>
                  </div>
                  {c.brief && (
                    <div className="lc-c-tagline" title={c.brief}>
                      <LcIcon name="tag"/><span>« {c.brief} »</span>
                    </div>
                  )}
                </div>
                <div className="lc-c-actions">
                  {showPauseAction && (
                    <div className="lc-act" role="button" onClick={() => setPausePromptCamp(c)} title="Mettre la campagne en pause 48 h (une seule fois)"><LcIcon name="pause"/>Pause</div>
                  )}
                  {showResumeAction && (
                    <div className="lc-act" role="button" onClick={() => togglePauseStatus(c.id, 'active')} title="Reprendre maintenant — le temps restant est préservé"><LcIcon name="play"/>Relancer</div>
                  )}
                  {!isDone(c.status) && (
                    <div className="lc-act" role="button" onClick={() => setEditCampId(c.id)} title="Élargir la zone, la tranche d'âge ou le lien Vitrine"><LcIcon name="edit"/>Modifier</div>
                  )}
                  <div className="lc-act" role="button" onClick={() => onDuplicate?.(c.id)} title="Relancer la même campagne avec les mêmes paramètres"><LcIcon name="copy"/>Dupliquer</div>
                  <div className="lc-act primary" role="button" onClick={() => onDetail(c)}>Détails<LcIcon name="arrow"/></div>
                </div>
              </div>
              <div className="lc-c-foot">
                <div className="lc-stats-row">
                  <div className="lc-stat">
                    <span className="sic" style={{ background: `var(--lc-${sty.color}-soft)`, color: `var(--lc-${sty.color})` }}><LcIcon name="budget"/></span>
                    <div><div className="sk">Budget</div><div className="sv">{lcEur(spentTotal)} <small>/ {lcEur(budgetTotal)}</small></div></div>
                  </div>
                  <div className="lc-stat">
                    <span className="sic" style={{ background: 'var(--lc-blue-soft)', color: 'var(--lc-blue)' }}><LcIcon name="touch"/></span>
                    <div><div className="sk">Touchés</div><div className="sv">{reached}</div></div>
                  </div>
                  <div className="lc-stat">
                    <span className="sic" style={{ background: 'var(--lc-green-soft)', color: 'var(--lc-green)' }}><LcIcon name="contact"/></span>
                    <div><div className="sk">Contacts</div><div className="sv">{Number(c.contactsCount ?? 0)} <small>· {acceptRate}%</small></div></div>
                  </div>
                </div>
                <div className="lc-progress">
                  <div className="pl"><span className="pt">Budget consommé</span><span className="pv"><b>{pct}%</b></span></div>
                  <div className="lc-track"><div className="fill" style={{ width: Math.max(pct, 3) + '%' }}/></div>
                  <div className="note">Commission incluse · acquise sur les acceptations · {lcEur(spentTotal)} engagés sur {lcEur(budgetTotal)}</div>
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
      {editCampId && (
        <EditCampaignModal
          campId={editCampId}
          onCancel={() => setEditCampId(null)}
          onSaved={() => {
            setEditCampId(null);
            // Rafraîchit la liste + le reste du dashboard pro en temps réel.
            try { window.dispatchEvent(new Event('pro:overview-changed')); } catch {}
            try { window.dispatchEvent(new CustomEvent('pro:campaign-edited', { detail: { id: editCampId } })); } catch {}
            setReloadKey(k => k + 1);
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

/* Popup « Modifier une campagne en cours ».
   Le pro ne peut qu'ÉLARGIR (jamais restreindre) 3 points, sans relancer
   la campagne ni re-solliciter de prospects :
     1. le lien du site « Vitrine » (si l'option a été souscrite) ;
     2. la zone géographique (rayon plus large / niveau supérieur / national) ;
     3. la tranche d'âge (ajout de tranches uniquement).
   À l'enregistrement → PATCH /api/pro/campaigns/[id] (branche édition) puis
   onSaved() rafraîchit les vues concernées. */
const EDIT_ERR_LABELS = {
  vitrine_not_subscribed: "L'option Vitrine n'a pas été souscrite pour cette campagne.",
  invalid_website: "Lien de site invalide (https requis).",
  age_not_widening: "La tranche d'âge ne peut être qu'élargie, pas restreinte.",
  geo_not_widening: "La zone ne peut être qu'élargie, pas restreinte.",
  geo_invalid: "Élargissement de zone invalide.",
  geo_resolve_failed: "Impossible de résoudre la zone élargie. Réessayez.",
  campaign_closed: "Cette campagne est clôturée : elle n'est plus modifiable.",
  nothing_to_update: "Aucune modification à enregistrer.",
  verif_not_widening: "Le niveau de vérification ne peut être qu'abaissé, pas durci.",
  verif_invalid: "Niveau de vérification invalide.",
  fiabilite_not_widening: "Le seuil de fiabilité ne peut être que baissé, pas relevé.",
  fiabilite_invalid: "Seuil de fiabilité invalide.",
};

// Seuils de fiabilité minimum proposés dans la popup d'édition (du plus large
// au plus strict). Élargir = baisser le seuil → seules les options ≤ courant
// sont sélectionnables.
const EDIT_FIAB_OPTS = [
  { v: 0,  name: 'Toutes',           sub: 'Aucun filtre de fiabilité' },
  { v: 60, name: 'Bonne fiabilité',  sub: '≥ 60 / 100' },
  { v: 80, name: 'Excellente',       sub: '≥ 80 / 100' },
];

/* Icônes SVG — reproduites à l'identique de la maquette
   « Modifier la campagne - Modale.html » (mêmes tracés et épaisseurs). */
function EcmIcon({ name }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'expand': return <svg {...p} strokeWidth="2"><path d="M4 14v6h6M20 10V4h-6M14 10l6-6M10 14l-6 6"/></svg>;
    case 'lock':   return <svg {...p} strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case 'check':  return <svg {...p} strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>;
    case 'plus':   return <svg {...p} strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>;
    case 'x':      return <svg {...p} strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'save':   return <svg {...p} strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>;
    default: return null;
  }
}

/* Échelle géographique présentée dans la maquette : 4 paliers ordonnés.
   `around` (rayon autour de moi) suit la même mécanique d'échelle. */
function buildGeoModel(d) {
  if (!d) return null;
  const geo = d.targeting?.geo || null;
  const radius = d.targeting?.radiusKm ?? null;
  if (geo === 'around') {
    const radii = [10, 30, 50];
    const steps = radii
      .map(r => ({ lab: `${r} km`, sub: 'Autour de moi', kind: 'around', radiusKm: r }))
      .concat([{ lab: 'National', sub: 'France entière', kind: 'national' }]);
    let ci = radii.indexOf(Number(radius));
    if (ci < 0) ci = 0;
    return { steps, currentIndex: ci, curLabel: `${radii[ci]} km` };
  }
  const steps = [
    { lab: 'Ville',      sub: '~20 km',        kind: 'zone', level: 'ville' },
    { lab: 'Département', sub: '~50 km',        kind: 'zone', level: 'dept' },
    { lab: 'Région',     sub: '~150 km',       kind: 'zone', level: 'region' },
    { lab: 'National',   sub: 'France entière', kind: 'national' },
  ];
  const idx = { ville: 0, dept: 1, region: 2, national: 3 }[geo];
  const ci = idx == null ? 3 : idx;
  return { steps, currentIndex: ci, curLabel: steps[ci].lab };
}

function geoPayloadForStep(step) {
  if (!step) return null;
  if (step.kind === 'national') return { mode: 'national' };
  if (step.kind === 'around') return { mode: 'around', radiusKm: step.radiusKm };
  return { mode: 'zone', level: step.level };
}

function EditCampaignModal({ campId, onCancel, onSaved }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  // Champs du formulaire.
  const [site, setSite] = useState('');               // partie après https://
  const [chosenIndex, setChosenIndex] = useState(0);  // palier géo retenu (>= currentIndex)
  const [ages, setAges] = useState(() => new Set());  // tranches sélectionnées (buckets)
  const [lockedAges, setLockedAges] = useState(() => new Set()); // tranches courantes (verrouillées)
  const [verif, setVerif] = useState('p0');           // niveau de vérification retenu (<= courant)
  const [baseVerif, setBaseVerif] = useState('p0');   // niveau courant (plafond)
  const [minFiab, setMinFiab] = useState(0);          // seuil de fiabilité retenu (<= courant)
  const [baseFiab, setBaseFiab] = useState(0);        // seuil courant (plafond)

  const BUCKETS = AGE_RANGES.filter(a => a !== 'Tous');

  useEffect(() => {
    let cancelled = false;
    setData(null); setLoadError(null);
    fetch(`/api/pro/campaigns/${campId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('load_failed')))
      .then(j => {
        if (cancelled) return;
        setData(j);
        setSite((j.websiteUrl || '').replace(/^https?:\/\//i, ''));
        const cur = Array.isArray(j.targeting?.ages) ? j.targeting.ages : [];
        const isAll = cur.length === 0 || cur.includes('Tous') || BUCKETS.every(b => cur.includes(b));
        const initial = new Set(isAll ? BUCKETS : cur.filter(a => a !== 'Tous'));
        setAges(new Set(initial));
        setLockedAges(new Set(initial));
        const gm = buildGeoModel(j);
        setChosenIndex(gm ? gm.currentIndex : 0);
        const curVerif = j.targeting?.verifLevel || 'p0';
        setVerif(curVerif); setBaseVerif(curVerif);
        const curFiab = Number(j.targeting?.minFiabilite ?? 0);
        setMinFiab(curFiab); setBaseFiab(curFiab);
      })
      .catch(e => { if (!cancelled) setLoadError(e.message || 'load_failed'); });
    return () => { cancelled = true; };
  }, [campId]);

  const geoModel = data ? buildGeoModel(data) : null;
  const ci = geoModel ? geoModel.currentIndex : 0;
  const lastIndex = geoModel ? geoModel.steps.length - 1 : 0;
  const hasVitrine = !!data?.websiteUrl;
  const refLabel = data?.name || campId;

  const toggleAge = (b) => {
    if (lockedAges.has(b)) return; // tranche courante non décochable
    setAges(prev => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b); else n.add(b);
      return n;
    });
  };

  // Détection des changements par section (pour ne PATCher que le nécessaire).
  const siteOriginal = (data?.websiteUrl || '').replace(/^https?:\/\//i, '');
  const siteChanged = hasVitrine && site.trim() && site.trim().replace(/^https?:\/\//i, '') !== siteOriginal;
  const agesChanged = BUCKETS.filter(b => ages.has(b)).length > lockedAges.size;
  const geoChanged = !!geoModel && chosenIndex > ci;
  const verifRank = (id) => VERIF_LEVELS.findIndex(v => v.id === id);
  const baseVerifRank = verifRank(baseVerif);
  const verifChanged = verif !== baseVerif;
  const fiabChanged = minFiab !== baseFiab;
  const canSubmit = !submitting && (siteChanged || agesChanged || geoChanged || verifChanged || fiabChanged);

  const geoHelp = geoChanged
    ? `Cible élargie à « ${geoModel.steps[chosenIndex].lab} ». Les zones plus étroites restent couvertes.`
    : (ci >= lastIndex
        ? 'Zone déjà à son maximum — France entière.'
        : 'Sélectionnez une zone plus large pour élargir la diffusion.');

  const submit = async () => {
    const payload = {};
    if (siteChanged) payload.websiteUrl = 'https://' + site.trim().replace(/^https?:\/\//i, '');
    if (agesChanged) payload.ages = BUCKETS.filter(b => ages.has(b));
    if (geoChanged) payload.geo = geoPayloadForStep(geoModel.steps[chosenIndex]);
    if (verifChanged) payload.verifLevel = verif;
    if (fiabChanged) payload.minFiabilite = minFiab;
    if (Object.keys(payload).length === 0) { setErr(EDIT_ERR_LABELS.nothing_to_update); return; }
    setSubmitting(true); setErr(null);
    try {
      const r = await fetch(`/api/pro/campaigns/${campId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(EDIT_ERR_LABELS[j?.error] || ('Échec : ' + (j?.error || r.status)));
        setSubmitting(false);
        return;
      }
      onSaved();
    } catch (e) {
      setErr('Erreur réseau : ' + (e.message || ''));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" className="ecm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
    >
      <div className="ecm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ecm-inner">
          {/* En-tête : référence + titre + fermeture */}
          <div className="ecm-top">
            <div>
              <div className="ecm-ref">Campagne · {refLabel}</div>
              <h2 className="ecm-title ecm-serif">Modifier la campagne</h2>
            </div>
            <button className="ecm-close" type="button" aria-label="Fermer" onClick={() => !submitting && onCancel()}>
              <EcmIcon name="x"/>
            </button>
          </div>

          {/* Note « élargir uniquement » */}
          <div className="ecm-note">
            <span className="ic"><EcmIcon name="expand"/></span>
            <p>Vous pouvez uniquement <b>élargir</b> la cible — jamais la restreindre. Les prospects déjà sollicités ne sont pas affectés.</p>
          </div>

          {!data && !loadError && (
            <div className="ecm-state">Chargement…</div>
          )}
          {loadError && (
            <div className="ecm-state ecm-error">Impossible de charger la campagne.</div>
          )}

          {data && (
            <>
              {/* 1) Lien de votre site (vitrine) */}
              {hasVitrine && (
                <div className="ecm-field">
                  <div className="ecm-flabel"><span className="k">Lien de votre site (vitrine)</span></div>
                  <div className="ecm-url">
                    <span className="pfx">https://</span>
                    <input
                      type="text" value={site}
                      onChange={e => setSite(e.target.value.replace(/^https?:\/\//i, ''))}
                      placeholder="www.exemple.com"
                    />
                  </div>
                </div>
              )}

              {/* 2) Zone géographique — échelle 4 paliers (verrouillé / actuel / ajouté) */}
              {geoModel && (
                <div className="ecm-field">
                  <div className="ecm-flabel">
                    <span className="k">Zone géographique</span>
                    <span className="cur">Actuelle · {geoModel.curLabel}</span>
                  </div>
                  <div className="ecm-geo">
                    {geoModel.steps.map((s, i) => {
                      let cls = 'ecm-geo-step';
                      let tag = null;
                      if (i < ci) cls += ' locked';
                      else if (i === ci) { cls += ' current'; tag = 'Actuelle'; }
                      else if (i <= chosenIndex) { cls += ' added'; if (i === chosenIndex) tag = 'Nouvelle cible'; }
                      return (
                        <button
                          key={i} type="button" className={cls}
                          onClick={() => { if (i <= ci) return; setChosenIndex(chosenIndex === i ? ci : i); }}
                        >
                          {tag && <span className="tag">{tag}</span>}
                          <div className="lab">{s.lab}{i < ci && <span className="lk"><EcmIcon name="lock"/></span>}</div>
                          <div className="sub">{s.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="ecm-geohelp">{geoHelp}</p>
                </div>
              )}

              {/* 3) Tranche d'âge — pills (verrouillé / ajouté / disponible) + légende */}
              <div className="ecm-field">
                <div className="ecm-flabel"><span className="k">Tranche d'âge</span></div>
                <div className="ecm-pills">
                  {BUCKETS.map(b => {
                    const isBase = lockedAges.has(b);
                    const isAdded = !isBase && ages.has(b);
                    let cls = 'ecm-pill';
                    if (isBase) cls += ' base';
                    else if (isAdded) cls += ' added';
                    return (
                      <button
                        key={b} type="button" className={cls}
                        onClick={() => toggleAge(b)}
                        title={isBase ? 'Déjà ciblée — ne peut pas être retirée' : undefined}
                      >
                        <span>{b}</span>
                        {isBase
                          ? <span className="lk"><EcmIcon name="lock"/></span>
                          : (isAdded ? <EcmIcon name="check"/> : <EcmIcon name="plus"/>)}
                      </button>
                    );
                  })}
                  {(() => {
                    // Bouton « Tous » : coche toutes les tranches d'un coup
                    // (élargissement maximal). Actif quand tout est sélectionné.
                    const allSel = BUCKETS.every(b => ages.has(b));
                    return (
                      <button
                        type="button" className={'ecm-pill' + (allSel ? ' added' : '')}
                        onClick={() => setAges(new Set(BUCKETS))}
                        title="Cibler toutes les tranches d'âge"
                      >
                        <span>Tous</span>
                        {allSel ? <EcmIcon name="check"/> : <EcmIcon name="plus"/>}
                      </button>
                    );
                  })()}
                </div>
                <div className="ecm-legend">
                  <span><i className="sw base"/>Déjà ciblée (verrouillée)</span>
                  <span><i className="sw added"/>Ajoutée</span>
                </div>
              </div>

              {/* 4) Niveau de vérification minimum — ABAISSER seulement.
                  Les niveaux plus exigeants que l'actuel sont verrouillés. */}
              <div className="ecm-field">
                <div className="ecm-flabel">
                  <span className="k">Niveau de vérification minimum</span>
                  <span className="cur">Actuel · {VERIF_LEVELS.find(v => v.id === baseVerif)?.name}</span>
                </div>
                <div className="ecm-cards">
                  {VERIF_LEVELS.map((v, i) => {
                    const locked = i > baseVerifRank;     // plus strict que l'actuel
                    const sel = verif === v.id;
                    const isBase = v.id === baseVerif;
                    let cls = 'ecm-card';
                    if (sel) cls += ' sel';
                    if (locked) cls += ' locked';
                    return (
                      <button
                        key={v.id} type="button" className={cls}
                        onClick={() => !locked && setVerif(v.id)}
                        disabled={locked}
                        title={locked ? 'Plus strict que le niveau actuel — non sélectionnable' : undefined}
                      >
                        <span className="cmark">{locked ? <EcmIcon name="lock"/> : (sel ? <EcmIcon name="check"/> : null)}</span>
                        <span className="nm">{v.name}{isBase && <span className="tag">Actuel</span>}</span>
                        <span className="sb">{v.sub}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="ecm-geohelp">Vous pouvez abaisser l'exigence pour élargir la cible, jamais la durcir.</p>
              </div>

              {/* 5) Fiabilité minimum — BAISSER le seuil seulement. */}
              <div className="ecm-field">
                <div className="ecm-flabel">
                  <span className="k">Fiabilité minimum</span>
                  <span className="cur">Actuel · {EDIT_FIAB_OPTS.find(o => o.v === baseFiab)?.name || ('≥ ' + baseFiab)}</span>
                </div>
                <div className="ecm-cards">
                  {EDIT_FIAB_OPTS.map((o) => {
                    const locked = o.v > baseFiab;        // seuil plus haut que l'actuel
                    const sel = minFiab === o.v;
                    const isBase = o.v === baseFiab;
                    let cls = 'ecm-card';
                    if (sel) cls += ' sel';
                    if (locked) cls += ' locked';
                    return (
                      <button
                        key={o.v} type="button" className={cls}
                        onClick={() => !locked && setMinFiab(o.v)}
                        disabled={locked}
                        title={locked ? 'Seuil plus élevé que l\'actuel — non sélectionnable' : undefined}
                      >
                        <span className="cmark">{locked ? <EcmIcon name="lock"/> : (sel ? <EcmIcon name="check"/> : null)}</span>
                        <span className="nm">{o.name}{isBase && <span className="tag">Actuel</span>}</span>
                        <span className="sb">{o.sub}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="ecm-geohelp">Baissez le seuil pour toucher davantage de prospects ; il ne peut pas être relevé.</p>
              </div>

              {err && <div className="ecm-state ecm-error">{err}</div>}
            </>
          )}

          {/* Pied : Annuler / Enregistrer */}
          <div className="ecm-foot">
            <button className="ecm-btn ecm-btn-ghost" type="button" onClick={() => !submitting && onCancel()} disabled={submitting}>Annuler</button>
            <button className="ecm-btn ecm-btn-primary" type="button" onClick={submit} disabled={!canSubmit}>
              <EcmIcon name="save"/>{submitting ? 'Enregistrement…' : 'Enregistrer les changements'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .ecm-overlay{
          --ecm-paper:#f4f1ea; --ecm-paper-warm:#efeadd; --ecm-card:#fffdf8;
          --ecm-ink:#161a1d; --ecm-ink-2:#3c444b; --ecm-ink-3:#757d83; --ecm-ink-4:#9aa0a4;
          --ecm-line:rgba(22,26,29,0.10); --ecm-line-soft:rgba(22,26,29,0.06);
          --ecm-indigo:#5a57d6; --ecm-indigo-d:#4744bf; --ecm-indigo-soft:#ecebfb; --ecm-indigo-xsoft:#f4f3fd;
          --ecm-shadow-pop:0 8px 24px rgba(22,26,29,0.12), 0 30px 70px rgba(22,26,29,0.20);
          position:fixed; inset:0; z-index:220;
          display:flex; align-items:flex-start; justify-content:center;
          overflow-y:auto; padding:44px 24px 64px;
          background:rgba(22,26,29,0.42); backdrop-filter:blur(3px);
          font-family:"Hanken Grotesk", system-ui, sans-serif;
          color:var(--ecm-ink); -webkit-font-smoothing:antialiased;
        }
        .ecm-serif{ font-family:"Newsreader", Georgia, serif; }
        .ecm-overlay *{ box-sizing:border-box; }

        .ecm-modal{
          position:relative; width:100%; max-width:600px; margin:auto 0;
          background:var(--ecm-card); border-radius:22px; overflow:hidden;
          box-shadow:var(--ecm-shadow-pop);
          display:flex; flex-direction:column; max-height:calc(100dvh - 64px);
        }
        .ecm-modal::before{ content:""; position:absolute; top:0; left:0; right:0; height:4px;
          background:linear-gradient(90deg, var(--ecm-indigo-d), var(--ecm-indigo) 50%, #8a88ea); z-index:1; }
        .ecm-inner{ padding:30px 32px 28px; overflow-y:auto; }

        .ecm-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .ecm-ref{ font-family:"IBM Plex Mono", monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ecm-ink-4); }
        .ecm-close{ width:32px; height:32px; border-radius:9px; border:1px solid var(--ecm-line); background:var(--ecm-card); color:var(--ecm-ink-3); display:grid; place-items:center; cursor:pointer; flex:none; }
        .ecm-close svg{ width:15px; height:15px; }
        .ecm-close:hover{ background:var(--ecm-paper); color:var(--ecm-ink); }
        h2.ecm-title{ font-weight:600; font-size:27px; letter-spacing:-0.015em; margin:7px 0 0; }

        .ecm-note{ display:flex; gap:11px; align-items:flex-start; margin-top:16px; padding:13px 15px; border-radius:13px; background:var(--ecm-indigo-xsoft); border:1px solid rgba(90,87,214,0.18); }
        .ecm-note .ic{ width:26px; height:26px; border-radius:8px; background:#fff; border:1px solid rgba(90,87,214,0.26); color:var(--ecm-indigo-d); display:grid; place-items:center; flex:none; }
        .ecm-note .ic svg{ width:14px; height:14px; }
        .ecm-note p{ margin:0; font-size:13px; line-height:1.5; color:var(--ecm-ink-2); }
        .ecm-note b{ color:var(--ecm-indigo-d); font-weight:700; }

        .ecm-field{ margin-top:22px; }
        .ecm-flabel{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .ecm-flabel .k{ font-family:"IBM Plex Mono", monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ecm-ink-3); }
        .ecm-flabel .cur{ margin-left:auto; font-family:"IBM Plex Mono", monospace; font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ecm-indigo-d); background:var(--ecm-indigo-soft); border:1px solid rgba(90,87,214,0.22); padding:3px 9px; border-radius:999px; }

        .ecm-url{ display:flex; align-items:stretch; border:1.5px solid var(--ecm-line); border-radius:13px; overflow:hidden; background:#fff; transition:border-color .15s, box-shadow .15s; }
        .ecm-url:focus-within{ border-color:var(--ecm-indigo); box-shadow:0 0 0 3px rgba(90,87,214,0.14); }
        .ecm-url .pfx{ display:flex; align-items:center; padding:0 15px; background:var(--ecm-paper-warm); color:var(--ecm-ink-3); font-family:"IBM Plex Mono", monospace; font-size:13px; border-right:1px solid var(--ecm-line); }
        .ecm-url input{ flex:1; min-width:0; border:none; outline:none; background:transparent; padding:14px 16px; font-family:inherit; font-size:15px; color:var(--ecm-ink); }
        .ecm-url input::placeholder{ color:var(--ecm-ink-4); }

        .ecm-geo{ display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
        .ecm-geo-step{ position:relative; text-align:left; padding:12px 13px; border-radius:12px; border:1.5px solid var(--ecm-line); background:#fff; cursor:pointer; font-family:inherit; transition:border-color .15s, background .15s, box-shadow .15s; }
        .ecm-geo-step .lab{ font-weight:600; font-size:13.5px; color:var(--ecm-ink); line-height:1.1; display:flex; align-items:center; gap:6px; }
        .ecm-geo-step .sub{ font-family:"IBM Plex Mono", monospace; font-size:10px; color:var(--ecm-ink-4); margin-top:4px; letter-spacing:0.02em; }
        .ecm-geo-step .lk{ display:inline-flex; }
        .ecm-geo-step .lk svg{ width:12px; height:12px; color:var(--ecm-ink-4); }
        .ecm-geo-step:hover:not(.locked):not(.current){ border-color:rgba(90,87,214,0.5); box-shadow:0 4px 12px rgba(90,87,214,0.12); }
        .ecm-geo-step.locked{ background:var(--ecm-paper); border-color:var(--ecm-line-soft); cursor:not-allowed; }
        .ecm-geo-step.locked .lab{ color:var(--ecm-ink-4); }
        .ecm-geo-step.current{ border-color:var(--ecm-ink); background:#fff; cursor:default; }
        .ecm-geo-step.current .lab{ color:var(--ecm-ink); }
        .ecm-geo-step.current .tag{ position:absolute; top:-8px; left:11px; font-family:"IBM Plex Mono", monospace; font-size:8.5px; letter-spacing:0.08em; text-transform:uppercase; background:var(--ecm-ink); color:#fff; padding:2px 6px; border-radius:5px; }
        .ecm-geo-step.added{ border-color:var(--ecm-indigo); background:var(--ecm-indigo-xsoft); box-shadow:0 4px 12px rgba(90,87,214,0.14); }
        .ecm-geo-step.added .lab{ color:var(--ecm-indigo-d); }
        .ecm-geo-step.added .sub{ color:var(--ecm-indigo); }
        .ecm-geo-step.added .tag{ position:absolute; top:-8px; left:11px; font-family:"IBM Plex Mono", monospace; font-size:8.5px; letter-spacing:0.08em; text-transform:uppercase; background:var(--ecm-indigo); color:#fff; padding:2px 6px; border-radius:5px; }
        .ecm-geohelp{ font-size:12px; color:var(--ecm-ink-3); margin:9px 2px 0; line-height:1.4; }

        .ecm-pills{ display:flex; flex-wrap:wrap; gap:8px; }
        .ecm-pill{ display:inline-flex; align-items:center; gap:7px; padding:9px 14px; border-radius:999px; border:1.5px solid var(--ecm-line); background:#fff; font-size:13.5px; font-weight:600; color:var(--ecm-ink-2); cursor:pointer; font-family:inherit; transition:border-color .15s, background .15s, color .15s, box-shadow .15s; }
        .ecm-pill svg{ width:13px; height:13px; }
        .ecm-pill:hover:not(.base){ border-color:rgba(90,87,214,0.5); }
        .ecm-pill.base{ background:var(--ecm-paper); border-color:var(--ecm-line-soft); color:var(--ecm-ink-3); cursor:not-allowed; }
        .ecm-pill.base .lk svg{ color:var(--ecm-ink-4); }
        .ecm-pill.added{ background:var(--ecm-indigo); border-color:var(--ecm-indigo); color:#fff; box-shadow:0 4px 12px rgba(90,87,214,0.22); }

        .ecm-legend{ display:flex; flex-wrap:wrap; gap:16px; margin-top:11px; }
        .ecm-legend span{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; color:var(--ecm-ink-3); }
        .ecm-legend .sw{ width:11px; height:11px; border-radius:4px; }
        .ecm-legend .sw.base{ background:var(--ecm-paper); border:1.5px solid var(--ecm-line-soft); }
        .ecm-legend .sw.added{ background:var(--ecm-indigo); }

        /* Cartes « niveau de vérification » / « fiabilité minimum » — 3 par ligne */
        .ecm-cards{ display:grid; grid-template-columns:repeat(3, 1fr); gap:9px; }
        .ecm-card{ position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left; padding:13px 13px 12px; border-radius:14px; border:1.5px solid var(--ecm-line); background:#fff; cursor:pointer; font-family:inherit; transition:border-color .15s, background .15s, box-shadow .15s; }
        .ecm-card .cmark{ position:absolute; top:11px; right:11px; width:16px; height:16px; display:grid; place-items:center; }
        .ecm-card .cmark svg{ width:15px; height:15px; color:var(--ecm-ink-4); }
        .ecm-card .nm{ font-size:14px; font-weight:700; color:var(--ecm-ink); padding-right:20px; display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
        .ecm-card .tag{ font-family:"IBM Plex Mono", monospace; font-size:9px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ecm-ink-3); background:var(--ecm-paper); border:1px solid var(--ecm-line); padding:2px 6px; border-radius:999px; }
        .ecm-card .sb{ font-size:11.5px; color:var(--ecm-ink-3); line-height:1.35; }
        .ecm-card:hover:not(.locked):not(.sel){ border-color:rgba(90,87,214,0.5); }
        .ecm-card.sel{ border-color:var(--ecm-indigo); background:var(--ecm-indigo-xsoft); box-shadow:0 4px 14px rgba(90,87,214,0.18); }
        .ecm-card.sel .cmark svg{ color:var(--ecm-indigo-d); }
        .ecm-card.locked{ background:var(--ecm-paper); border-color:var(--ecm-line-soft); cursor:not-allowed; opacity:.72; }
        .ecm-card.locked .nm{ color:var(--ecm-ink-3); }

        .ecm-state{ font-size:13px; color:var(--ecm-ink-3); padding:16px 0; text-align:center; }
        .ecm-error{ color:#B91C1C; }

        .ecm-foot{ display:flex; gap:12px; margin-top:28px; padding-top:22px; border-top:1px solid var(--ecm-line); }
        .ecm-btn{ font-family:inherit; cursor:pointer; border-radius:13px; font-weight:600; font-size:15px; padding:15px 22px; transition:transform .12s, box-shadow .15s, background .15s; }
        .ecm-btn:active{ transform:translateY(1px); }
        .ecm-btn-ghost{ background:var(--ecm-card); border:1.5px solid var(--ecm-line); color:var(--ecm-ink-2); }
        .ecm-btn-ghost:hover{ border-color:rgba(22,26,29,0.24); background:var(--ecm-paper); }
        .ecm-btn-primary{ flex:1; background:var(--ecm-ink); border:1px solid var(--ecm-ink); color:#fff; display:inline-flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 8px 20px rgba(22,26,29,0.22); }
        .ecm-btn-primary:hover:not(:disabled){ box-shadow:0 10px 26px rgba(22,26,29,0.30); }
        .ecm-btn-primary svg{ width:16px; height:16px; }
        .ecm-btn:disabled{ opacity:.5; cursor:not-allowed; }

        /* Tablette : modale resserrée, échelle géo conservée en 4 colonnes. */
        @media (max-width: 720px){
          .ecm-inner{ padding:26px 22px 24px; }
        }
        /* Téléphone : plein écran, échelle géo en 2 colonnes, footer compact. */
        @media (max-width: 540px){
          .ecm-overlay{ padding:0; align-items:stretch; }
          .ecm-modal{ max-width:none; border-radius:0; max-height:100dvh; min-height:100dvh; }
          .ecm-inner{ padding:24px 18px 22px; }
          h2.ecm-title{ font-size:23px; }
          .ecm-geo{ grid-template-columns:repeat(2, 1fr); }
          .ecm-cards{ gap:6px; }
          .ecm-card{ padding:10px 9px; border-radius:11px; }
          .ecm-card .nm{ font-size:12px; padding-right:14px; gap:4px; }
          .ecm-card .sb{ font-size:10px; }
          .ecm-card .tag{ font-size:8px; padding:1px 4px; }
          .ecm-card .cmark{ top:8px; right:8px; width:13px; height:13px; }
          .ecm-card .cmark svg{ width:12px; height:12px; }
          .ecm-flabel{ flex-wrap:wrap; }
          .ecm-flabel .cur{ margin-left:0; }
          .ecm-foot{ flex-wrap:wrap; }
          .ecm-btn-ghost{ flex:1; }
          .ecm-btn-primary{ flex:1 1 100%; }
        }
      `}</style>
    </div>
  );
}

/* 6-step wizard — objectif, données, ciblage, budget, mots-clés, récap */
// allowedTiers : paliers accessibles selon le principe de minimisation RGPD.
// Données strictement nécessaires à la finalité de la campagne.
// Couleur premium par objectif (cartes étape 1 — création de campagne).
const OBJ_COLOR = {
  contact: '#5a57d6', rdv: '#1c8a6e', evt: '#2f72c4', dl: '#b9842a',
  survey: '#c14d77', promo: '#d6432f', addigital: '#2e9e5b',
};
// Icône par palier de données (étape 3 — création de campagne).
const TIER_ICON = { 1: 'user', 2: 'mapPin', 3: 'heart', 4: 'briefcase', 5: 'wallet' };
// Icône par zone géographique (étape 4 — ciblage).
const GEO_ICON = { ville: 'home', dept: 'mapPin', region: 'globe', national: 'france' };
// Icône par canal / sous-type (étape 1). Repli sur l'icône de l'objectif.
const CHANNEL_ICON = {
  email: 'email', sms: 'sms', mms: 'sms', postal: 'send', phone: 'phone', wa: 'whatsapp', pushweb: 'globe', pushapp: 'bell', autres: 'sparkle',
  rdvphys: 'mapPin', rdvtel: 'phone', rdvvisio: 'globe', consult: 'user', devis: 'doc', essai: 'sparkle',
  webinar: 'globe', portes: 'home', atelier: 'users', conf: 'mapPin', network: 'users', demo: 'play', launch: 'bolt', tournoi: 'flag',
  wb: 'globe', etude: 'chart', cat: 'grid', guide: 'doc', info: 'info', rapport: 'chart', tpl: 'doc', check: 'check', replay: 'play',
  csat: 'heart', nps: 'trend', poll: 'chart', panel: 'users', test: 'bulb', focus: 'users', interview: 'user', vote: 'check',
  coupon: 'gift', welcome: 'sparkle', flash: 'bolt', contest: 'flag',
  meta: 'facebook', google: 'globe', tiktok: 'tiktok', linkedin: 'linkedin', snap: 'sparkle', x: 'globe',
};

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
    {id:'autres',    name:'Autres',                  desc:'Autre canal de contact — précisez à l’étape Description',  cost:0},
  ]},
  { id:'rdv', name:'Prise de rendez-vous', desc:'6 opérations — physique, visio, devis, essai', icon:'calendar', allowedTiers:[1], sub:[
    {id:'rdvphys',   name:'RDV physique commercial', desc:'Rencontre en face-à-face chez le prospect ou en agence',       cost:2.00},
    {id:'rdvtel',    name:'RDV téléphonique',        desc:'Appel qualifié planifié avec un conseiller ou commercial',     cost:1.00},
    {id:'rdvvisio',  name:'RDV visioconférence',     desc:'Réunion en ligne via Teams, Zoom ou Google Meet',              cost:0.80},
    {id:'consult',   name:'Consultation gratuite',   desc:'Bilan offert en échange de coordonnées (coach, kiné…)',        cost:1.50},
    {id:'devis',     name:'Devis à domicile',        desc:'Visite technique pour établir un chiffrage (BTP, énergie)',    cost:3.00},
    {id:'essai',     name:'Essai produit planifié',  desc:'Test drive, essai cuisine, démo logiciel avec commercial',     cost:2.50},
    {id:'autres',    name:'Autres',                  desc:'Autre format de rendez-vous — précisez à l’étape Description', cost:0},
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
    {id:'autres',    name:'Autres',                  desc:'Autre type d\u2019événement — précisez à l\u2019étape Description',         cost:0},
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
    {id:'autres',    name:'Autres',                  desc:'Autre format de contenu — précisez à l\u2019étape Description',         cost:0},
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
    {id:'autres',    name:'Autres',                  desc:'Autre format d\u2019étude — précisez à l\u2019étape Description',         cost:0},
  ]},
  { id:'promo', name:'Promotions & fidélisation', desc:'4 opérations — coupon, flash, concours', icon:'bolt', allowedTiers:[1,2,3,4,5], sub:[
    {id:'coupon',    name:'Offre de réduction ciblée', desc:'Coupon, code promo ou remise envoyé à un segment',            cost:0.30},
    {id:'welcome',   name:'Offre de bienvenue',        desc:'Avantage exclusif à la première commande ou inscription',     cost:0.60},
    {id:'flash',     name:'Vente flash',               desc:'Promotion à durée limitée pour créer l\u2019urgence',                cost:0.50},
    {id:'contest',   name:'Concours / jeu-concours',   desc:'Animation avec gain à la clé pour créer de l\u2019engagement',       cost:0.80},
    {id:'autres',    name:'Autres',                  desc:'Autre mécanique promo — précisez à l\u2019étape Description',         cost:0},
  ]},
  { id:'addigital', name:'Publicité digitale', desc:'Adresses réseaux sociaux pour ciblage publicitaire', icon:'bolt', allowedTiers:[1,2,3,4,5], sub:[
    {id:'meta',      name:'Audience Meta (Facebook / Instagram)', desc:'Liste d\u2019emails / téléphones hashés pour ciblage publicitaire', cost:0.20},
    {id:'google',    name:'Google Customer Match',     desc:'Audience pour Google Ads, YouTube, Discovery',                cost:0.20},
    {id:'tiktok',    name:'TikTok Ads — Custom Audience', desc:'Liste pour ciblage publicitaire TikTok Ads',               cost:0.20},
    {id:'linkedin',  name:'LinkedIn Matched Audiences',desc:'Audience B2B pour LinkedIn Ads',                              cost:0.30},
    {id:'snap',      name:'Snapchat Ads',              desc:'Audience pour ciblage publicitaire Snap',                     cost:0.20},
    {id:'x',         name:'X (Twitter) Ads',           desc:'Liste pour ciblage publicitaire sur X',                       cost:0.20},
    {id:'autres',    name:'Autres',                  desc:'Autre régie / plateforme — précisez à l\u2019étape Description',         cost:0},
  ]},
];

const TIERS_DATA = [
  {id:1, name:'Identification',            sub:'Email, nom, téléphone, date de naissance',        min:1.00, max:1.00,  pct:20},
  {id:2, name:'Localisation',              sub:'Adresse postale, logement, mobilité',             min:1.00, max:2.00,  pct:40},
  {id:3, name:'Style de vie',              sub:'Habitudes, famille, véhicule, sport',             min:2.00, max:3.50,  pct:58},
  {id:4, name:'Données professionnelles',  sub:'Statut, secteur',                                 min:3.50, max:5.00,  pct:78},
  {id:5, name:'Patrimoine & projets',      sub:'Immobilier, projets',                             min:5.00, max:10.00, pct:100},
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

/* Couleur de catégorie par objectif de campagne — accent latéral + pastille
   dans « Mes prospects ». Palette crème/encre relevée : ambre · indigo · teal ·
   rose, désaturée (« épuré, jamais criard »). Clé = targeting.objectiveId
   (cf. lib/campaigns/mapping.ts). */
const CATEGORY_STYLE = {
  contact:   { accent: '#4F46E5', soft: '#EEF0FF', label: 'Contact',        full: 'Prise de contact direct',     icon: 'email' },
  rdv:       { accent: '#0D9488', soft: '#E6F4F2', label: 'Rendez-vous',    full: 'Prise de rendez-vous',        icon: 'calendar' },
  evt:       { accent: '#D97706', soft: '#FBF1E1', label: 'Événementiel',   full: 'Événementiel & inscription',  icon: 'sparkle' },
  dl:        { accent: '#DB2777', soft: '#FCE8F1', label: 'Téléchargement', full: 'Contenus à télécharger',      icon: 'download' },
  survey:    { accent: '#7C3AED', soft: '#F2ECFD', label: 'Études & avis',  full: 'Études & collecte d\'avis',   icon: 'doc' },
  promo:     { accent: '#E11D48', soft: '#FCE7EC', label: 'Promotions',     full: 'Promotions & fidélisation',   icon: 'gift' },
  addigital: { accent: '#0891B2', soft: '#E4F3F8', label: 'Publicité',      full: 'Publicité digitale',          icon: 'globe' },
};
const categoryStyle = (objectiveId) =>
  CATEGORY_STYLE[objectiveId] || { accent: 'var(--accent)', soft: 'var(--ivory-2)', label: 'Campagne', full: 'Campagne', icon: 'target' };

/* Couleur d'avatar (cercle d'initiales) variée par prospect — teintes vives
   mais douces, encre foncée lisible par-dessus. Hash stable sur le nom. */
const AVATAR_COLORS = ['#A5B4FC', '#6EE7B7', '#FCD34D', '#F9A8D4', '#C4B5FD', '#67E8F9', '#86EFAC', '#FDBA74'];
const avatarColor = (name) => {
  const s = String(name || '?');
  const h = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
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

/* ─── Autocomplete cible géographique (ville / département / région) ───
   Source : geo.api.gouv.fr (officiel, gratuit, CORS autorisé).
   Le champ se ré-initialise quand `geo` change (cf. useEffect dans
   CreateCampaign) parce que la sélection précédente n'a pas de sens à
   l'autre échelle. Le shape de la valeur retournée à `onPick` :

     ville    → { type:'ville',  nom, code, codesPostaux, codeDepartement, codeRegion }
     dept     → { type:'dept',   nom, code, codeRegion }
     region   → { type:'region', nom, code, deptCodes }   (deptCodes résolus
                                                            via /regions/{code}/departements)

   Pour `region`, on fait un 2nd fetch après la sélection pour récupérer
   la liste des départements — utilisée côté backend pour générer le
   filtre de CP (OR des préfixes dept). */
function GeoTargetAutocomplete({ geo, value, onPick }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = React.useRef(null);

  // Reset visible quand la sélection est purgée (geo change).
  useEffect(() => { if (!value) setQuery(''); }, [value]);

  // Debounced search vers l'endpoint adapté au mode.
  // Comportement par défaut : recherche par nom (lettres).
  // Si la saisie est numérique on bascule sur la recherche par code :
  //   - ville  : codePostal (2 à 5 chiffres, ex. "750", "75001")
  //   - dept   : code département (ex. "33", "2A")
  //   - region : code région (1-2 chiffres officiels INSEE)
  // Permet à un pro qui connaît son code postal de retrouver vite sa
  // commune sans devoir taper le nom complet.
  useEffect(() => {
    const q = query.trim();
    if (!geo || geo === 'national' || q.length < 1) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const isNumeric = /^\d+$/.test(q);
    const timer = setTimeout(async () => {
      try {
        let url;
        if (geo === 'ville') {
          if (isNumeric) {
            // Code postal partiel ou complet : l'API filtre les communes
            // dont au moins un codesPostaux commence par `q`.
            url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,codeDepartement,codeRegion&limit=20`;
          } else {
            url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,codeDepartement,codeRegion&boost=population&limit=10`;
          }
        } else if (geo === 'dept') {
          if (isNumeric) {
            url = `https://geo.api.gouv.fr/departements?code=${encodeURIComponent(q)}&fields=nom,code,codeRegion&limit=10`;
          } else {
            url = `https://geo.api.gouv.fr/departements?nom=${encodeURIComponent(q)}&fields=nom,code,codeRegion&limit=10`;
          }
        } else { // region
          if (isNumeric) {
            url = `https://geo.api.gouv.fr/regions?code=${encodeURIComponent(q)}&fields=nom,code&limit=10`;
          } else {
            url = `https://geo.api.gouv.fr/regions?nom=${encodeURIComponent(q)}&fields=nom,code&limit=10`;
          }
        }
        const r = await fetch(url);
        if (!r.ok) { setItems([]); setLoading(false); return; }
        let data = await r.json();
        if (!Array.isArray(data)) data = [];
        // Pour le mode ville en saisie numérique : si l'utilisateur a tapé
        // un code postal partiel, on remonte uniquement les communes dont
        // un CP commence vraiment par la saisie (le `codePostal=` côté
        // API filtre déjà mais on garantit le tri).
        if (geo === 'ville' && isNumeric) {
          data = data.filter(c =>
            Array.isArray(c.codesPostaux) &&
            c.codesPostaux.some(cp => cp.startsWith(q))
          );
        }
        setItems(data);
      } catch (e) {
        console.warn('[geo.api.gouv.fr] error', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query, geo]);

  // Click extérieur ferme la liste.
  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = async (it) => {
    if (geo === 'ville') {
      onPick({
        type: 'ville',
        nom: it.nom,
        code: it.code,
        codesPostaux: Array.isArray(it.codesPostaux) ? it.codesPostaux : [],
        codeDepartement: it.codeDepartement ?? null,
        codeRegion: it.codeRegion ?? null,
      });
      setQuery(`${it.nom}${it.codesPostaux?.[0] ? ` (${it.codesPostaux[0]})` : ''}`);
    } else if (geo === 'dept') {
      onPick({ type: 'dept', nom: it.nom, code: it.code, codeRegion: it.codeRegion ?? null });
      setQuery(`${it.nom} (${it.code})`);
    } else {
      // region — on résout les depts pour pouvoir appliquer le filtre CP
      // côté backend (préfixes OR'd). L'API renvoie la liste complète.
      let deptCodes = [];
      try {
        const r2 = await fetch(`https://geo.api.gouv.fr/regions/${encodeURIComponent(it.code)}/departements?fields=code`);
        if (r2.ok) {
          const dd = await r2.json();
          deptCodes = Array.isArray(dd) ? dd.map(d => String(d.code)) : [];
        }
      } catch (e) {
        console.warn('[geo.api.gouv.fr] regions/depts error', e);
      }
      onPick({ type: 'region', nom: it.nom, code: it.code, deptCodes });
      setQuery(it.nom);
    }
    setOpen(false);
    setHighlight(-1);
  };

  const clear = () => { onPick(null); setQuery(''); setOpen(false); };

  const onKeyDown = (e) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(items.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && highlight >= 0 && highlight < items.length) { e.preventDefault(); pick(items[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const placeholder =
    geo === 'ville' ? 'Tapez le nom d\'une ville ou un code postal (ex. Bordeaux, 33000)' :
    geo === 'dept' ? 'Tapez le nom ou le code d\'un département (ex. Gironde, 33)' :
    geo === 'region' ? 'Tapez le nom ou le code d\'une région (ex. Nouvelle-Aquitaine, 75)' :
    '';

  // Rendu du résumé d'item (clé contextuelle = code dept pour ville/dept,
  // rien pour region puisque l'API en renvoie ~18 max).
  const renderItem = (it) => {
    if (geo === 'ville') {
      const cps = (it.codesPostaux || []).slice(0, 2).join(', ');
      return { left: it.nom, right: cps ? `${cps} · ${it.codeDepartement || ''}` : (it.codeDepartement || '') };
    }
    if (geo === 'dept') return { left: it.nom, right: it.code };
    return { left: it.nom, right: '' };
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 24 }}>
      <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(-1); if (value) onPick(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, fontSize: 14, padding: '10px 12px', minHeight: 44 }}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {value && (
          <button type="button" onClick={clear} className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>
            Effacer
          </button>
        )}
      </div>
      {value && (
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          Sélectionné : <strong style={{ color: 'var(--ink)' }}>{value.nom}</strong>
          {value.type === 'ville' && value.codesPostaux?.length > 0 && (
            <> · CP {value.codesPostaux.slice(0, 3).join(', ')}{value.codesPostaux.length > 3 ? '…' : ''}</>
          )}
          {value.type === 'dept' && <> · code {value.code}</>}
          {value.type === 'region' && <> · {value.deptCodes?.length || 0} départements</>}
        </div>
      )}
      {open && query.trim().length >= 1 && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--paper)', border: '1px solid var(--line-2)',
          borderRadius: 10, boxShadow: '0 12px 30px -12px rgba(15,22,41,.25)',
          maxHeight: 280, overflowY: 'auto', zIndex: 50,
        }}>
          {loading && items.length === 0 && (
            <div className="muted" style={{ padding: '12px 14px', fontSize: 13 }}>Recherche…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="muted" style={{ padding: '12px 14px', fontSize: 13 }}>Aucun résultat.</div>
          )}
          {items.map((it, i) => {
            const r = renderItem(it);
            return (
              <button
                key={`${geo}-${it.code}-${i}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(it)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '12px 14px', textAlign: 'left',
                  background: highlight === i ? 'var(--ivory-2)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
                  minHeight: 44, gap: 12,
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.left}</span>
                {r.right && <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 12, flexShrink: 0 }}>{r.right}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Toast "On a tout gardé" affiché quand le wizard restaure un brouillon
   au retour sur l'onglet (cf. CreateCampaign / restoreDraft). Slide-in
   en haut au centre, illustration thiings.co (bookmark), auto-dismiss
   après 6 s ou via bouton "Continuer". Identique en style aux empty
   states de l'app (cercle pastel + image 3D). */
function DraftRestoredToast({ onDismiss }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  // Toast en flow normal (pas position fixed) — s'insère sous le
  // SectionTitle du wizard. Compact sur desktop (max-width 460 px,
  // centré), wrap sur mobile (≤ 520 px) avec bouton plein-écran sur
  // la 2e ligne pour le tap target.
  return (
    <>
      <div className="wizard-restore-toast" role="status" aria-live="polite">
        <div className="wizard-restore-toast__icon">
          <img
            src="/draft-restored.png"
            alt=""
            className="wizard-restore-toast__img"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="wizard-restore-toast__body">
          <div className="serif wizard-restore-toast__title">
            On a tout gardé&nbsp;!
          </div>
          <div className="wizard-restore-toast__sub">
            Reprenez votre campagne là où vous vous êtes arrêté.
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="btn btn-ghost btn-sm wizard-restore-toast__btn"
          aria-label="Fermer"
        >
          Continuer
        </button>
      </div>
      <style>{`
        .wizard-restore-toast {
          max-width: 460px;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
          background: var(--paper);
          border: 1px solid color-mix(in oklab, var(--accent) 25%, var(--line));
          border-radius: 14px;
          box-shadow: 0 14px 40px -12px rgba(15, 22, 41, 0.18);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: bupp-toast-in .35s cubic-bezier(.18, 1.2, .4, 1);
        }
        .wizard-restore-toast__icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: color-mix(in oklab, var(--accent) 12%, var(--paper));
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .wizard-restore-toast__img {
          width: 34px; height: 34px; object-fit: contain;
        }
        .wizard-restore-toast__body { min-width: 0; flex: 1 1 0%; }
        .wizard-restore-toast__title {
          font-size: 14px; line-height: 1.2; margin-bottom: 2px;
        }
        .wizard-restore-toast__sub {
          font-size: 12px; color: var(--ink-4); line-height: 1.4;
        }
        .wizard-restore-toast__btn {
          flex-shrink: 0; padding: 6px 10px;
        }
        @keyframes bupp-toast-in {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 520px) {
          /* Layout vertical sur mobile : icône au-dessus, texte au
             milieu, bouton dessous, tout centré. Plus lisible et plus
             tappable qu'un wrap horizontal sur petit écran. */
          .wizard-restore-toast {
            max-width: 100%;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 14px 16px;
            gap: 10px;
          }
          .wizard-restore-toast__body {
            flex: 0 1 auto;
            width: 100%;
          }
          .wizard-restore-toast__btn {
            width: 100%;
            justify-content: center;
            text-align: center;
            padding: 8px 14px;
          }
        }
      `}</style>
    </>
  );
}

/* Confirmation du bouton "Tout effacer" dans le header du wizard.
   Réinitialise toutes les étapes (l'utilisateur revient à l'étape 1
   avec les champs vidés). Le plan choisi est PRÉSERVÉ. */
function WizardResetConfirmModal({ onCancel, onConfirm }) {
  return (
    <ProInfoModalShell title="Tout effacer ?" onClose={onCancel}>
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
            Réinitialiser le brouillon
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Toutes les étapes en cours (objectif, ciblage, budget, mots-clés,
            description…) seront <strong>effacées</strong>. Vous repartirez
            de l'étape 1 avec un brouillon vierge.
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 10, color: '#991B1B', letterSpacing: '.06em' }}>
            Le plan déjà choisi (Starter / Pro) reste sélectionné.
          </div>
        </div>
      </div>
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn btn-ghost btn-sm">Annuler</button>
        <button onClick={onConfirm} className="btn btn-sm" style={{ background: '#DC2626', color: 'white' }}>
          <Icon name="trash" size={12}/> Tout effacer
        </button>
      </div>
    </ProInfoModalShell>
  );
}

/* « La Vitrine » — popup d'offre du service lien-du-site, ouvert à l'arrivée
   sur le récap. `free` ⇒ offert (1re campagne du pro), sinon 2 €. Le champ
   est préfixé `https://` en dur ; on ne renvoie que la partie hôte/chemin. */
function VitrineOfferModal({ free, url, onSkip, onConfirm }) {
  const [val, setVal] = useState((url || '').replace(/^https?:\/\//i, ''));
  const clean = val.trim().replace(/^https?:\/\//i, '');
  // Domaine plausible : au moins `xxx.tld` (tld ≥ 2 caractères).
  const valid = /^[^\s./]+\.[^\s/]{2,}/.test(clean);
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="vitrine-title"
      onClick={onSkip}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,22,41,.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--paper)', color: 'var(--ink)', borderRadius: 18, padding: '28px 26px', width: 'min(480px, 100%)', boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)', borderTop: '4px solid var(--accent)', margin: 'auto' }}
      >
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10, textAlign: 'center' }} aria-hidden="true">{free ? '🎁' : '✨'}</div>
        <div id="vitrine-title" className="serif" style={{ fontSize: 23, lineHeight: 1.25, marginBottom: 10, textAlign: 'center' }}>
          {free ? 'Bonne nouvelle — La Vitrine vous est offerte !' : 'Ouvrez La Vitrine de votre campagne'}
        </div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18, textAlign: 'center' }}>
          {free
            ? <>Pour votre <strong>première campagne</strong>, on vous offre <strong>La Vitrine</strong>. Ajoutez le lien de votre site : les prospects découvrent ce que vous proposez, et vous voyez combien ont cliqué. Normalement à 2 €, aujourd'hui <strong>c'est cadeau</strong>.</>
            : <>Affichez le lien de votre site sur l'annonce — les prospects découvrent votre univers, et vous suivez le <strong>nombre de visites</strong>. <strong>+2,00 €</strong>, une fois, pour cette campagne.</>}
        </div>
        <label className="mono caps muted" style={{ fontSize: 10, marginBottom: 6, display: 'block' }}>Adresse de votre site</label>
        <div className="row" style={{ alignItems: 'stretch', border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', background: 'var(--paper)' }}>
          <span className="mono" style={{ padding: '10px 10px', background: 'var(--ivory-2)', color: 'var(--ink-3)', fontSize: 13, display: 'flex', alignItems: 'center', borderRight: '1px solid var(--line-2)' }}>https://</span>
          <input
            type="text"
            value={val}
            onChange={e => setVal(e.target.value.replace(/^https?:\/\//i, ''))}
            onKeyDown={e => { if (e.key === 'Enter' && valid) onConfirm(clean); }}
            placeholder="mon-entreprise.fr"
            autoFocus
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 14, background: 'transparent', color: 'var(--ink)' }}
          />
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>https uniquement · ex. mon-entreprise.fr/offre</div>
        <div className="row" style={{ gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onSkip}>Non merci</button>
          <button
            type="button" className="btn btn-primary"
            style={{ flex: 2, opacity: valid ? 1 : 0.55, cursor: valid ? 'pointer' : 'not-allowed' }}
            disabled={!valid}
            onClick={() => onConfirm(clean)}
          >
            {free ? 'Ajouter ma vitrine (offert)' : 'Ajouter ma vitrine (+2 €)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCampaign({ onDone, companyInfo, onGoInformations, onEditAddress, duplicateSourceId, onRecharge }) {
  const [step, setStep] = useState(1);
  const [launched, setLaunched] = useState(null); // {code} when launched
  const [insufficient, setInsufficient] = useState(null); // {balance, campaignTotal, planFee, needed, missing}
  // Modale de confirmation du bouton "Tout effacer" (header du wizard).
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // Erreur de lancement (autre que solde insuffisant) — affichée dans
  // un modal stylé plutôt qu'un alert() natif. Forme: {title, message}.
  const [launchError, setLaunchError] = useState(null);
  // ─── « La Vitrine » — option lien du site web sur l'annonce ────────
  // `vitrineUrl` = partie saisie APRÈS le préfixe https:// (affiché en dur).
  // `vitrineAdded` = option retenue. `vitrineModalOpen/Seen` pilotent le
  // popup d'offre (ouvert une seule fois à l'arrivée sur le récap).
  // `priorCampaignCount` (null tant que non chargé) décide de la gratuité :
  // 0 campagne antérieure ⇒ offert ; sinon 2 €. Le serveur reste autoritaire.
  const [vitrineUrl, setVitrineUrl] = useState('');
  const [vitrineAdded, setVitrineAdded] = useState(false);
  const [vitrineModalOpen, setVitrineModalOpen] = useState(false);
  const [vitrineModalSeen, setVitrineModalSeen] = useState(false);
  const [priorCampaignCount, setPriorCampaignCount] = useState(null);
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
  // Drapeau « un brouillon de campagne a été restauré au mount » — posé
  // par restoreDraft (cf. plus bas). Le `load()` du plan tourne async et
  // peut résoudre APRÈS restoreDraft : sans ce drapeau, il écraserait
  // `planChosen` en rouvrant la popup quand `cycleCount === 0` (cas de
  // l'utilisateur qui quitte le wizard avant de lancer sa 1re campagne
  // du cycle et qui y revient).
  const draftRestoredRef = React.useRef(false);
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
      // NB : la décision d'ouverture/fermeture de la popup plan est
      // centralisée dans un useEffect dédié (cf. "effet décision popup
      // plan" plus bas). Ici on se contente de poser les data plan
      // (capReached, cycleCount, cycleCap, plan). Cela évite le flash :
      // sans le useEffect, load() — qui résout souvent avant /api/me
      // et avant restoreDraft — ouvrait la popup quelques ms avant que
      // les signaux d'acquittement (userEmail, restoreRan) n'arrivent.
      setCapReached(Boolean(p?.capReached));
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

  // « La Vitrine » — combien de campagnes le pro a-t-il déjà ? 0 ⇒ option
  // offerte (1re campagne), sinon 2 €. Lecture au montage (le serveur
  // recalcule de toute façon le tarif à la création).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/campaigns', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(j => { if (!cancelled) setPriorCampaignCount((j.campaigns || []).length); })
      .catch(() => { if (!cancelled) setPriorCampaignCount(0); });
    return () => { cancelled = true; };
  }, []);

  // Popup d'offre Vitrine : s'ouvre UNE fois, à l'arrivée sur le récap
  // (dernière étape), tant que l'option n'a pas déjà été retenue. On attend
  // que le nombre de campagnes soit connu pour afficher le bon message
  // (offert vs 2 €).
  useEffect(() => {
    if (
      step === WIZ_STEP_RECAP &&
      !vitrineModalSeen &&
      !vitrineAdded &&
      priorCampaignCount !== null
    ) {
      setVitrineModalOpen(true);
      setVitrineModalSeen(true);
    }
  }, [step, vitrineModalSeen, vitrineAdded, priorCampaignCount]);

  // ─── Persistance brouillon de campagne ─────────────────────────
  // Si l'utilisateur est redirigé vers Stripe pour recharger son crédit
  // au moment de valider la campagne, on sauvegarde l'intégralité du
  // wizard dans `window.top.sessionStorage`, puis on restore au retour.
  // Cela évite de devoir refaire tout le wizard. La clé est nettoyée
  // dès la restauration pour ne pas rejouer un brouillon obsolète.
  // Persistance brouillon + acquittement de plan dans localStorage (et
  // non sessionStorage) → survit à la fermeture du navigateur ET à un
  // sign-out / sign-in Clerk. Clé namespacée par email utilisateur pour
  // qu'un autre compte connecté sur le même device ne récupère pas le
  // brouillon. Email résolu via /api/me au mount (cf. useEffect plus bas).
  // Tant que l'email n'est pas connu (`userEmail === null`), on skip les
  // reads/writes pour ne pas corrompre une clé générique. La migration
  // automatique des anciens drafts sessionStorage n'est PAS faite : les
  // utilisateurs en cours retomberont une fois sur étape 1 (acceptable).
  const DRAFT_KEY_PREFIX = 'bupp:campaign-draft:';
  const PLAN_ACK_KEY_PREFIX = 'bupp:plan-acknowledged:';
  const safeTopLocal = () => {
    try { return window.top.localStorage; } catch { return window.localStorage; }
  };
  const [userEmail, setUserEmail] = useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j?.email) setUserEmail(String(j.email).toLowerCase()); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const draftKey = () => userEmail ? (DRAFT_KEY_PREFIX + userEmail) : null;
  const planAckKey = () => userEmail ? (PLAN_ACK_KEY_PREFIX + userEmail) : null;
  const planAlreadyAck = () => {
    const k = planAckKey(); if (!k) return false;
    try { return safeTopLocal().getItem(k) === '1'; } catch { return false; }
  };
  const setPlanAck = () => {
    const k = planAckKey(); if (!k) return;
    try { safeTopLocal().setItem(k, '1'); } catch {}
  };
  const clearPlanAck = () => {
    const k = planAckKey(); if (!k) return;
    try { safeTopLocal().removeItem(k); } catch {}
  };
  const saveDraft = () => {
    const k = draftKey();
    if (!k) return; // userEmail pas encore résolu — on retentera au prochain auto-save tick
    try {
      const draft = {
        version: 2,
        ts: Date.now(),
        step,
        plan,
        selectedObj,
        selectedSubs: Array.from(selectedSubs),
        selectedTiers: Array.from(selectedTiers),
        geo, geoTarget, radiusKm, ages: Array.from(ages),
        verif, contacts, durationKey, poolMode,
        keywords, kwInput, kwFilter,
        startDate, endDate, brief,
      };
      safeTopLocal().setItem(k, JSON.stringify(draft));
    } catch (e) { console.warn('saveDraft failed', e); }
  };
  const clearDraft = () => {
    const k = draftKey();
    if (k) { try { safeTopLocal().removeItem(k); } catch {} }
    // Lancement réussi = nouveau cycle. On efface aussi l'acquittement
    // pour que la popup s'affiche normalement à la prochaine 1re
    // campagne du cycle suivant.
    clearPlanAck();
  };
  // Restaure le brouillon si présent au montage du wizard. Deux scénarios :
  //   1) retour de Stripe (`?continue_campaign=1` dans le `search` parent)
  //      → on force l'étape Récap pour finaliser le paiement, puis on
  //      nettoie le brouillon (one-shot).
  //   2) simple retour sur l'onglet "Créer une campagne" (user a quitté
  //      vers une autre section, voire s'est déconnecté/reconnecté) → on
  //      restore l'étape en cours et on CONSERVE le brouillon. Stocké
  //      en localStorage namespacé par email Clerk → survit aux sign-outs.
  // Le restore tourne UNE SEULE FOIS dès que `userEmail` est résolu via
  // /api/me (cf. useEffect plus haut). Expiration 1 h.
  // `restoreRan` est volontairement un state (pas un ref) : l'effet de
  // décision popup plan (ajouté plus bas) en dépendra pour ne pas
  // ouvrir la popup tant que le restore n'a pas eu lieu.
  const [restoreRan, setRestoreRan] = useState(false);
  // Toast "On a tout gardé, continuez où vous vous êtes arrêté" — affiché
  // une fois quand un brouillon est restauré côté "retour normal" sur
  // l'onglet (pas Stripe : ce flow-là affiche déjà sa propre modale de
  // paiement réussi). Auto-dismiss après ~6 s ou via clic.
  const [showRestoreToast, setShowRestoreToast] = useState(false);
  useEffect(() => {
    if (!userEmail || restoreRan) return;
    // Toujours signaler "restore terminé" (qu'il y ait eu un brouillon
    // ou pas) pour débloquer l'effet de décision popup plan.
    setRestoreRan(true);
    try {
      const raw = safeTopLocal().getItem(draftKey());
      if (!raw) return;
      const d = JSON.parse(raw);
      // Compat brouillons v1 (sans `step`) : on les considère comme
      // venant d'un retour Stripe → force Récap, comportement historique.
      if (!d || (d.version !== 1 && d.version !== 2)) return;
      // Considère le brouillon obsolète après 1 h.
      if (Date.now() - Number(d.ts || 0) > 60 * 60 * 1000) {
        clearDraft();
        return;
      }
      setSelectedObj(d.selectedObj ?? null);
      setSelectedSubs(new Set(d.selectedSubs || []));
      setSelectedTiers(new Set(d.selectedTiers || [1]));
      setGeo(d.geo ?? 'national');
      // Important : setGeo() ré-init geoTarget via useEffect → on doit
      // setter geoTarget APRÈS dans la tick suivant. Ici on l'enrobe d'un
      // micro-task pour que la reset useEffect ne masque pas la valeur
      // restaurée.
      if (d.geoTarget) {
        Promise.resolve().then(() => setGeoTarget(d.geoTarget));
      }
      if (typeof d.radiusKm === 'number') setRadiusKm(d.radiusKm);
      setAges(new Set(d.ages || []));
      setVerif(d.verif ?? 'p0');
      setMinFiab(typeof d.minFiab === 'number' ? d.minFiab : 0);
      setContacts(Number(d.contacts ?? 10));
      setDurationKey(typeof d.durationKey === 'string' ? d.durationKey : '7d');
      setPoolMode(d.poolMode ?? 'standard');
      setKeywords(d.keywords || []);
      setKwInput(d.kwInput || '');
      setKwFilter(Boolean(d.kwFilter));
      setStartDate(d.startDate || isoPlusDays(1));
      setEndDate(d.endDate || isoPlusDays(8));
      setBrief(d.brief || '');
      // Le drapeau bloque l'écrasement asynchrone par l'effet décision
      // popup plan (cf. plus bas) qui n'a pas à rouvrir la popup quand
      // un brouillon vient d'être restauré.
      draftRestoredRef.current = true;

      // Détection du retour Stripe : `continue_campaign=1` est posé par
      // /api/stripe/checkout dans le success_url. Lecture côté parent
      // car l'iframe a son propre search (?v=…).
      let isStripeReturn = false;
      try {
        const parentSearch = (window.top || window).location.search || '';
        isStripeReturn = parentSearch.includes('continue_campaign=1');
      } catch {}

      if (isStripeReturn || d.version === 1) {
        // Saute directement à l'étape Récap pour finaliser le paiement
        // (et nettoie le brouillon : c'est un one-shot).
        setStep(WIZ_TOTAL);
        clearDraft();
      } else {
        // Retour normal sur l'onglet : reprend l'étape sauvegardée.
        const restoredStep = Number(d.step);
        if (Number.isInteger(restoredStep) && restoredStep >= 1 && restoredStep <= WIZ_TOTAL) {
          setStep(restoredStep);
        }
        // Conditions d'affichage du toast — 2 cas seulement :
        //   (a) Nouvelle session de tab : sessionStorage marker absent.
        //       Couvre une nouvelle tab, et le sign-out/sign-in suivi
        //       d'une fermeture/réouverture de la tab.
        //   (b) Brouillon resté en pause ≥ 5 min : draft.ts vieux.
        // Va-et-vient rapide entre onglets (< 5 min, même tab) → pas
        // de toast, l'utilisateur sait ce qu'il vient de quitter.
        const SESSION_MARK_KEY = 'bupp:wizard-session-mounted';
        let isNewSession = false;
        try {
          const sess = (window.top || window).sessionStorage;
          isNewSession = !sess.getItem(SESSION_MARK_KEY);
          sess.setItem(SESSION_MARK_KEY, '1');
        } catch {}
        const draftAgeMs = Date.now() - Number(d.ts || 0);
        const isStale = draftAgeMs > 5 * 60 * 1000;
        if (isNewSession || isStale) {
          // Délai 300 ms : laisse le 1er render se faire — sinon le
          // slide-in de l'animation est invisible.
          setTimeout(() => setShowRestoreToast(true), 300);
        }
        // Ne PAS clear le draft : il doit survivre aux allers-retours.
      }
    } catch (e) { console.warn('restoreDraft failed', e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // Effet décision popup plan — centralise l'ouverture/fermeture pour
  // éviter le flash. Conditions PRÉ-REQUISES :
  //   - userEmail résolu (sinon planAlreadyAck() retourne false à tort)
  //   - restoreRan vrai (sinon draftRestoredRef pas encore renseigné)
  //   - cycleCount résolu (sinon on ne sait pas si 1re du cycle)
  // Tant qu'une de ces conditions manque, on ne touche pas à l'état
  // popup → état initial `planModalOpen=false, planChosen=false`
  // affiché tel quel (pas de popup intempestive).
  React.useEffect(() => {
    if (!userEmail) return;
    if (!restoreRan) return;
    if (cycleCount == null) return;
    if (capReached) {
      // Renouvellement obligatoire : on ignore tout acquittement
      // précédent et on force la popup.
      clearPlanAck();
      setPlanModalOpen(true);
      setPlanChosen(false);
      return;
    }
    if (cycleCount === 0 && !draftRestoredRef.current && !planAlreadyAck()) {
      // 1re campagne du cycle ET ni brouillon en cours ni popup déjà
      // acquittée → ouverture normale.
      setPlanModalOpen(true);
      setPlanChosen(false);
      return;
    }
    // Brouillon en cours OU popup déjà acquittée OU déjà dans le cycle
    // → on respecte l'état choisi.
    setPlanModalOpen(false);
    setPlanChosen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, restoreRan, cycleCount, capReached]);

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
        // Idem draft restore : on diffère la restauration du geoTarget
        // pour qu'elle survive au reset useEffect déclenché par setGeo.
        if (tg.geoTarget && typeof tg.geoTarget === 'object') {
          Promise.resolve().then(() => setGeoTarget(tg.geoTarget));
        }
        if (typeof tg.radiusKm === 'number') setRadiusKm(tg.radiusKm);
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
        // Le plan a déjà été choisi (la campagne d'origine existe).
        // L'effet décision popup plan (plus haut) lira `draftRestoredRef`
        // pour ne pas rouvrir la popup même si `cycleCount === 0`.
        // Si le quota est atteint (capReached), il l'ouvrira quand même
        // (renouvellement obligatoire — au-dessus du Récap).
        draftRestoredRef.current = true;
        setRestoreRan(true); // débloque l'effet décision dès la duplication
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
  // Cas particulier : un pro qui s'inscrit garde par défaut son email Clerk
  // dans `raisonSociale`. On considère donc qu'une raison sociale contenant
  // '@' n'est PAS valide (placeholder résiduel). Le back applique la même
  // règle (/api/pro/campaigns) — c'est un garde-fou défensif, le front l'est
  // pour l'UX (désactive le bouton sans aller-retour réseau).
  const missingCompanyFields = [];
  const rawRaisonForLaunch = (companyInfo?.raisonSociale || '').trim();
  if (!rawRaisonForLaunch || rawRaisonForLaunch.includes('@')) {
    missingCompanyFields.push('raison sociale');
  }
  if (!companyInfo?.ville) missingCompanyFields.push('ville');
  const canLaunch = missingCompanyFields.length === 0;
  // Le ciblage « autour de moi » exige une adresse d'établissement (géocodée
  // côté serveur). On s'appuie sur l'adresse déjà connue dans « Mes
  // informations » pour guider le pro avant l'aller-retour réseau.
  const hasProAddress = !!(companyInfo?.adresse || '').trim();
  const [selectedObj, setSelectedObj] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());
  const [selectedTiers, setSelectedTiers] = useState(new Set([1]));
  // Message transitoire affiché quand le pro tente de décocher le
  // palier 1 (obligatoire — identification = socle de toute mise en
  // relation). Auto-effacé après 4 s.
  const [tier1Notice, setTier1Notice] = useState(false);
  useEffect(() => {
    if (!tier1Notice) return;
    const t = setTimeout(() => setTier1Notice(false), 4000);
    return () => clearTimeout(t);
  }, [tier1Notice]);
  // Popup pédagogique « multi-paliers » : s'affiche une seule fois par
  // campagne, dès que le pro sélectionne un 2ᵉ palier. But : rappeler que
  // le matching est CUMULATIF (le prospect doit avoir renseigné TOUS les
  // paliers demandés). `multiTierNoticeShown` verrouille l'affichage pour
  // la campagne en cours ; il est remis à false par resetWizard et au
  // remontage du wizard (= nouvelle campagne).
  const [multiTierModalOpen, setMultiTierModalOpen] = useState(false);
  const [multiTierNoticeShown, setMultiTierNoticeShown] = useState(false);
  const [geo, setGeo] = useState('national');
  // Cible géo précise (ville/dept/région choisie via l'autocomplete
  // geo.api.gouv.fr). Reset à null quand on bascule `geo` parce que la
  // sélection précédente n'a plus de sens (autre échelle).
  const [geoTarget, setGeoTarget] = useState(null);
  useEffect(() => { setGeoTarget(null); }, [geo]);
  // Rayon (km) du ciblage « autour de moi ». Borné à 10/30/50 ; le serveur
  // re-valide (normalizeRadiusKm) et exige une adresse pro géocodée.
  const [radiusKm, setRadiusKm] = useState(10);
  const [ages, setAges] = useState(new Set());
  const [verif, setVerif] = useState('p0');
  const [minFiab, setMinFiab] = useState(0); // fiabilité minimum (0/60/80)
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
  // Référence sur l'input mot-clé pour pouvoir le focus depuis le bouton
  // "+ Ajouter" quand l'input est vide (cf. étape 6 : on garde le bouton
  // toujours cliquable visuellement plutôt que de le griser).
  const kwInputRef = React.useRef(null);
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

  // Auto-save du brouillon : à chaque modification d'un state du wizard,
  // on persiste l'intégralité du draft dans sessionStorage (top) avec
  // un debounce 500 ms. Permet à l'utilisateur de quitter l'onglet
  // "Créer une campagne" et de retrouver son travail en revenant.
  // Skip tant qu'il n'a rien commencé (étape 1 vierge) pour ne pas
  // créer de brouillon fantôme. Nettoyage : au lancement réussi
  // (cf. clearDraft après setLaunched) et après restore "force récap".
  useEffect(() => {
    const hasContent =
      step > 1 ||
      selectedObj != null ||
      selectedSubs.size > 0 ||
      keywords.length > 0 ||
      brief.length > 0 ||
      geoTarget != null;
    if (!hasContent) return;
    const t = setTimeout(() => saveDraft(), 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, plan, selectedObj, selectedSubs, selectedTiers,
    geo, geoTarget, radiusKm, ages, verif, minFiab, contacts, durationKey, poolMode,
    keywords, kwInput, kwFilter, startDate, endDate, brief,
  ]);

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
      // Le palier 1 (Identification) est TOUJOURS requis : sans lui,
      // impossible d'identifier le prospect ni d'établir une mise en
      // relation. Il est donc forcé dans la sélection quoi qu'il arrive
      // (il est aussi toujours dans allowedTiers — toutes les finalités
      // l'autorisent et planTierCap ≥ 3).
      if (allowedTiers.includes(1)) next.add(1);
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
  const toggleTier = (tid) => {
    // Palier 1 verrouillé : on n'autorise jamais sa désélection. Si le
    // pro clique dessus pour le décocher, on affiche le message
    // d'explication au lieu de le retirer.
    if (tid === 1) {
      setTier1Notice(true);
      return;
    }
    const willAdd = !selectedTiers.has(tid);
    setSelectedTiers(p => { const n = new Set(p); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
    // 1ʳᵉ fois qu'on dépasse 1 palier sur cette campagne → popup explicatif
    // (le palier 1 étant toujours présent, ajouter un palier = ≥ 2 requis).
    if (willAdd && !multiTierNoticeShown && selectedTiers.size + 1 >= 2) {
      setMultiTierNoticeShown(true);
      setMultiTierModalOpen(true);
    }
  };
  // "Tous" agit comme un raccourci "tout cocher" — pas de pré-sélection
  // au démarrage : toutes les pills sont vides (y compris "Tous"). Cliquer
  // "Tous" coche les 6 tranches d'un coup ; re-cliquer dessus tout décoche.
  // Les clics sur les tranches individuelles synchronisent la pill "Tous"
  // (cochée ssi les 6 tranches le sont). Le backend traite "Tous", la
  // liste complète et la liste vide comme un synonyme = aucun filtre
  // (cf. lib/campaigns/mapping.ts → ageRangesToBounds).
  const ALL_AGE_RANGES_NO_TOUS = AGE_RANGES.filter(x => x !== 'Tous');
  const toggleAge = (a) => setAges(p => {
    if (a === 'Tous') {
      const allOn = ALL_AGE_RANGES_NO_TOUS.every(r => p.has(r));
      return allOn ? new Set() : new Set(AGE_RANGES);
    }
    const n = new Set(p);
    n.has(a) ? n.delete(a) : n.add(a);
    // Synchro de la pill "Tous" — cochée ssi toutes les tranches le sont.
    if (ALL_AGE_RANGES_NO_TOUS.every(r => n.has(r))) n.add('Tous');
    else n.delete('Tous');
    return n;
  });
  // Réinitialise complètement le wizard (étape 1, tous les champs vides).
  // Le plan choisi est PRÉSERVÉ (on ne réinflige pas la popup au user
  // qui veut juste repartir d'un ciblage neuf). Déclenché par le bouton
  // "Tout effacer" du header.
  const resetWizard = () => {
    setStep(1);
    setSelectedObj(null);
    setSelectedSubs(new Set());
    setSelectedTiers(new Set([1]));
    setMultiTierModalOpen(false);
    setMultiTierNoticeShown(false);
    setGeo('national');
    setGeoTarget(null);
    setRadiusKm(10);
    setAges(new Set());
    setVerif('p0');
    setMinFiab(0);
    setContacts(10);
    setDurationKey('7d');
    setPoolMode('standard');
    setExcludeCertified(false);
    setConfirmExcludeCertified(false);
    setFounderBonusEnabled(false);
    setKeywords([]);
    setKwInput('');
    setKwFilter(false);
    setStartDate(isoPlusDays(1));
    setEndDate(isoPlusDays(8));
    setBrief('');
    setBriefError(false);
    setTermsAccepted(false);
    setTermsError(false);
  };

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
  // « La Vitrine » : offerte à la 1re campagne du pro (priorCampaignCount === 0),
  // 2 € ensuite. Coût ajouté au total seulement si l'option est retenue.
  const vitrineFree = priorCampaignCount === 0;
  const vitrineFeeEur = vitrineAdded ? (vitrineFree ? 0 : 2) : 0;
  const totalToDebit = Math.round((total + commission + cycleStartFee + vitrineFeeEur) * 100) / 100;
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
        {vitrineAdded && (
          <div className="row between" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Option La Vitrine</span>{' '}
              <span className="mono" style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 6,
                background: vitrineFree ? 'color-mix(in oklab, var(--good) 16%, var(--paper))' : 'color-mix(in oklab, var(--ink) 8%, var(--paper))',
                color: vitrineFree ? 'var(--good)' : 'var(--ink-2)', fontWeight: 600, marginLeft: 4,
              }}>{vitrineFree ? 'Offert · 1ʳᵉ campagne' : 'lien du site'}</span>
            </div>
            <span className="mono tnum" style={{ fontWeight: 600, color: vitrineFree ? 'var(--good)' : 'var(--ink)' }}>{vitrineFree ? 'Offert' : fmtEur(2)}</span>
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
      <SectionTitle
        eyebrow="Nouvelle campagne"
        title={"Étape " + step + " · " + WIZ_STEPS[step-1]}
        action={step >= 2 ? (
          <button
            onClick={() => setConfirmResetOpen(true)}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)' }}
            title="Effacer toutes les étapes et repartir de zéro"
          >
            <Icon name="trash" size={12}/> Tout effacer
          </button>
        ) : undefined}
      />
      {showRestoreToast && (
        <DraftRestoredToast onDismiss={() => setShowRestoreToast(false)} />
      )}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {OBJECTIVES.map(o => {
                const sel = selectedObj === o.id;
                const col = OBJ_COLOR[o.id] || 'var(--accent)';
                return (
                  <button key={o.id} onClick={() => {
                    // Ne ré-initialise les sous-types que si l'objectif change
                    // réellement (un retour sur le même objectif garde la saisie).
                    if (selectedObj !== o.id) { setSelectedObj(o.id); setSelectedSubs(new Set()); }
                  }}
                    style={{ position: 'relative', textAlign: 'left', padding: 20, borderRadius: 14, cursor: 'pointer',
                      border: '1.5px solid ' + (sel ? col : 'var(--line-2)'),
                      background: sel ? `color-mix(in oklab, ${col} 8%, var(--paper))` : 'var(--paper)',
                      transition: 'border-color .15s, background .15s' }}>
                    {sel && (
                      <span style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 999, background: col, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={12}/>
                      </span>
                    )}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `color-mix(in oklab, ${col} 14%, var(--paper))`, color: col,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <Icon name={o.icon} size={20}/>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{o.name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>{o.desc}</div>
                  </button>
                );
              })}
            </div>

            {selectedObj && obj && (() => {
              // Aucun sous-type coché → signalé (sélection obligatoire).
              const noneSelected = selectedSubs.size === 0;
              const danger = '#DC2626';
              const col = OBJ_COLOR[obj.id] || 'var(--accent)';
              return (
                <div>
                  <div style={{ height: 1, background: 'var(--line)', margin: '24px 0 18px' }}/>
                  <div className="row center between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>Précisez les canaux</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Multi-sélection possible.</div>
                    </div>
                    {noneSelected && (
                      <span style={{ fontSize: 11.5, color: danger, fontWeight: 600 }}>Sélectionnez au moins un canal.</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {obj.sub.map(s => {
                      const checked = selectedSubs.has(s.id);
                      const bc = checked ? col : noneSelected ? danger : 'var(--line-2)';
                      return (
                        <button key={s.id} onClick={() => toggleSub(s.id)}
                          style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 12, textAlign: 'left', alignItems: 'flex-start',
                            border: '1.5px solid ' + bc,
                            background: checked ? `color-mix(in oklab, ${col} 7%, var(--paper))` : 'var(--paper)', cursor: 'pointer' }}>
                          <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `color-mix(in oklab, ${col} 14%, var(--paper))`,
                            color: col, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name={CHANNEL_ICON[s.id] || obj.icon} size={16}/>
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="row center between" style={{ gap: 8 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>
                              <span style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0,
                                border: '1.5px solid ' + (checked ? col : 'var(--line-2)'),
                                background: checked ? col : 'transparent', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {checked && <Icon name="check" size={10}/>}
                              </span>
                            </div>
                            <div className="muted" style={{ fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{s.desc}</div>
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
            <style>{`
              .wzd-dur{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:8px; }
              @media (max-width:640px){ .wzd-dur{ grid-template-columns:repeat(2,1fr); } }
            `}</style>
            <div className="wzd-dur">
              {DURATIONS.map((d) => {
                const sel = durationKey === d.id;
                const accent = d.id === '1h' ? '#d6432f' : 'var(--accent)';
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDurationKey(d.id)}
                    style={{
                      position: 'relative', padding: 16, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                      border: '1.5px solid ' + (sel ? accent : 'var(--line-2)'),
                      background: sel ? `color-mix(in oklab, ${accent} 7%, var(--paper))` : 'var(--paper)',
                      transition: 'border-color .12s, background .12s',
                    }}
                  >
                    {d.id === '1h' && (
                      <div className="mono caps" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: accent, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <Icon name="bolt" size={10}/> Flash Deal
                      </div>
                    )}
                    <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: `color-mix(in oklab, ${accent} 14%, var(--paper))`, color: accent, letterSpacing: '.04em',
                      }}>
                        {d.multBadge}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.4, marginTop: 6 }}>{d.sub}</div>
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
                    className="row center wizard-tier-row" style={{ gap: 14, padding: 16, borderRadius: 12, textAlign: 'left',
                      border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--line-2)'),
                      background: checked ? 'color-mix(in oklab, var(--accent) 6%, var(--paper))'
                                : allowed ? 'var(--paper)'
                                : 'color-mix(in oklab, var(--ink) 3%, var(--paper))',
                      opacity: allowed ? 1 : 0.5,
                      cursor: allowed ? 'pointer' : 'not-allowed',
                      position: 'relative'
                    }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                      background: allowed ? 'color-mix(in oklab, var(--accent) 12%, var(--paper))' : 'var(--ivory-2)',
                      color: allowed ? 'var(--accent)' : 'var(--ink-4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={TIER_ICON[t.id] || 'tiers'} size={18}/>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        Palier {t.id} · {t.name}
                        {t.id === 1 && (
                          <span className="mono caps" style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                            padding: '2px 7px', borderRadius: 999,
                            background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
                            color: 'var(--accent)',
                          }}>Requis</span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {allowed ? (
                        <>
                          <div className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                            {t.min === t.max ? `dès ${fmtEur(t.min)}` : `${fmtEur(t.min)} – ${fmtEur(t.max)}`}
                          </div>
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>par contact</div>
                        </>
                      ) : (
                        <span className="mono caps" style={{ fontSize: 10, fontWeight: 600, color: blockedByPlan ? '#B45309' : 'var(--ink-4)', letterSpacing: '.08em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="lock" size={11}/> {blockedByPlan ? 'Plan Pro' : 'Non autorisé'}
                        </span>
                      )}
                    </div>
                    {allowed && (
                      <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                        border: '2px solid ' + (checked ? 'var(--accent)' : 'var(--line-2)'),
                        background: checked ? 'var(--accent)' : 'transparent', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {checked && <Icon name="check" size={11}/>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Message d'explication quand on tente de décocher le
                palier 1 (obligatoire). Transitoire (4 s) — rôle alert. */}
            {tier1Notice && (
              <div role="alert" style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 10,
                background: '#fef3c7', border: '1px solid #fcd34d',
                color: '#92400e', fontSize: 12.5, lineHeight: 1.5,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span aria-hidden="true" style={{ flexShrink: 0 }}>ℹ︎</span>
                <span>
                  Le <strong>palier 1 — Identification</strong> est nécessaire à
                  l'identification du prospect et à toute entrée en relation. Il
                  ne peut pas être décoché ; les autres paliers s'ajoutent
                  par-dessus de façon cumulative.
                </span>
              </div>
            )}

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
            <div className="geo-zones-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: geo === 'national' ? 24 : 12 }}>
              {GEO_ZONES.map(z => {
                const sel = geo === z.id;
                return (
                  <button key={z.id} onClick={() => setGeo(z.id)} style={{ position: 'relative', padding: '16px 12px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                    border: '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                    background: sel ? 'color-mix(in oklab, var(--accent) 8%, var(--paper))' : 'var(--paper)' }}>
                    {sel && (
                      <span style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 999, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={11}/>
                      </span>
                    )}
                    <span style={{ width: 38, height: 38, borderRadius: 10, margin: '0 auto 10px',
                      background: 'color-mix(in oklab, var(--accent) 12%, var(--paper))',
                      color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={GEO_ICON[z.id] || 'mapPin'} size={18}/>
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{z.name}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{z.sub}</div>
                  </button>
                );
              })}
            </div>
            {/* Champ dynamique : nom de ville / dept / région via l'API
                officielle geo.api.gouv.fr. Masqué pour la portée nationale
                (rien à préciser) et pour « autour de moi » (basé sur la
                distance à l'adresse du pro, pas sur une zone administrative). */}
            {geo !== 'national' && geo !== 'around' && (
              <div style={{ marginBottom: 12 }}>
                <div className="label" style={{ marginTop: 6 }}>
                  {geo === 'ville' ? 'Ville ciblée' : geo === 'dept' ? 'Département ciblé' : 'Région ciblée'}
                </div>
                <GeoTargetAutocomplete
                  geo={geo}
                  value={geoTarget}
                  onPick={(v) => setGeoTarget(v)}
                />
              </div>
            )}

            {/* Ciblage de proximité : rayon autour de l'adresse de
                l'établissement. Distinct des portées administratives — basé
                sur la distance réelle (géocodage de l'adresse du pro). */}
            <button
              onClick={() => setGeo('around')}
              style={{ width: '100%', padding: 14, borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                marginBottom: geo === 'around' ? 12 : 24, display: 'flex', alignItems: 'center', gap: 12,
                border: '1px solid ' + (geo === 'around' ? 'var(--accent)' : 'var(--line-2)'),
                background: geo === 'around' ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                boxShadow: geo === 'around' ? '0 0 0 1px var(--accent)' : 'none' }}>
              <span style={{ flexShrink: 0, color: geo === 'around' ? 'var(--accent)' : 'var(--ink-3)' }}>
                <Icon name="mapPin" size={18}/>
              </span>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Autour de moi</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>Prospects situés dans un rayon autour de votre établissement</div>
              </span>
            </button>

            {geo === 'around' && (
              <div style={{ marginBottom: 24 }}>
                <div className="label">Zone d'extension</div>
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  {[10, 30, 50].map(km => (
                    <button key={km} onClick={() => setRadiusKm(km)} style={{ flex: 1, cursor: 'pointer',
                      padding: '10px 0', fontSize: 13, fontWeight: 600, borderRadius: 10, textAlign: 'center',
                      border: '1px solid ' + (radiusKm === km ? 'var(--accent)' : 'var(--line-2)'),
                      background: radiusKm === km ? 'var(--accent)' : 'var(--paper)',
                      color: radiusKm === km ? 'white' : 'var(--ink-3)' }}>
                      {km} km
                    </button>
                  ))}
                </div>
                {/* Le ciblage de proximité nécessite une adresse géocodable.
                    Si elle manque, on alerte et on propose d'aller la saisir. */}
                {hasProAddress ? (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--ivory-2)',
                    border: '1px solid var(--line-2)', display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 1 }}><Icon name="info" size={16}/></span>
                    <div>
                      Le ciblage se base sur l'adresse de votre établissement
                      {companyInfo?.adresse ? <> (<strong>{companyInfo.adresse}</strong>)</> : null}.
                      Vous pouvez la consulter ou la modifier dans{' '}
                      <button onClick={onEditAddress} style={{ background: 'none', border: 'none', padding: 0,
                        color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                        Mes informations
                      </button>.
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FFF7ED',
                    border: '1px solid #FDBA74', color: '#7C2D12', display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, color: '#EA580C', marginTop: 1 }}><Icon name="alert" size={16}/></span>
                    <div>
                      <strong>Adresse requise.</strong> Pour cibler autour de vous, renseignez d'abord
                      l'adresse de votre établissement.
                      <div style={{ marginTop: 8 }}>
                        <button onClick={onEditAddress} className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>
                          Renseigner mon adresse <Icon name="arrow" size={12}/>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Responsive : sur mobile (≤640 px), la grille des portées
                bascule en 2 colonnes pour éviter des boutons écrasés. */}
            <style>{`
              @media (max-width: 640px) {
                .geo-zones-grid { grid-template-columns: repeat(2, 1fr) !important; }
              }
            `}</style>

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

            <style>{`
              .tgt-3{ display:flex; gap:8px; }
              .tgt-card{ display:flex; flex-direction:column; flex:1 1 0; min-width:0; cursor:pointer; text-align:left; border-radius:10px; padding:14px 12px; }
              .tgt-card .tn{ font-size:13.5px; font-weight:600; line-height:1.15; }
              .tgt-card .ts{ font-size:11px; margin-top:4px; line-height:1.35; }
              @media (max-width:560px){
                .tgt-3{ gap:6px; }
                .tgt-card{ padding:10px 8px; border-radius:9px; }
                .tgt-card .tn{ font-size:11.5px; }
                .tgt-card .ts{ font-size:9.5px; margin-top:3px; }
              }
            `}</style>
            <div className="label">Niveau de vérification minimum</div>
            <div className="tgt-3">
              {VERIF_LEVELS.map(v => {
                const sel = verif === v.id;
                return (
                  <button key={v.id} onClick={() => setVerif(v.id)} className="tgt-card" style={{
                    border: '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                    background: sel ? 'color-mix(in oklab, var(--accent) 8%, var(--paper))' : 'var(--paper)',
                  }}>
                    <div className="row center between" style={{ gap: 8 }}>
                      <span className="tn" style={{ color: sel ? 'var(--accent)' : 'var(--ink)' }}>{v.name}</span>
                      <span style={{ width: 16, height: 16, borderRadius: 999,
                        border: '2px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {sel && <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--accent)' }}/>}
                      </span>
                    </div>
                    <div className="ts muted">{v.sub}</div>
                    {v.badge && <span className="chip chip-accent" style={{ fontSize: 10, fontWeight: 600, marginTop: 8, alignSelf: 'flex-start' }}>{v.badge}</span>}
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

            {/* Fiabilité minimum — ne cibler que les prospects suffisamment
                bien notés par les pros (cf. indice de désirabilité). */}
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <div className="label">Fiabilité minimum</div>
              <div className="muted" style={{ fontSize: 12.5, margin: '4px 0 10px' }}>
                Ne sollicitez que les prospects suffisamment bien notés par les professionnels. « Toutes » inclut ceux jamais notés.
              </div>
              <div className="tgt-3">
                {[
                  { v: 0,  label: 'Toutes',          sub: 'Aucun filtre' },
                  { v: 60, label: 'Bonne fiabilité', sub: '≥ 60 / 100' },
                  { v: 80, label: 'Excellente',      sub: '≥ 80 / 100' },
                ].map(o => {
                  const on = minFiab === o.v;
                  return (
                    <button key={o.v} onClick={() => setMinFiab(o.v)} className="tgt-card" style={{
                      background: on ? 'color-mix(in oklab, var(--accent) 10%, var(--paper))' : 'var(--paper)',
                      border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--line-2)'),
                    }}>
                      <span className="tn" style={{ color: on ? 'var(--accent)' : 'var(--ink)' }}>{o.label}</span>
                      <span className="ts mono" style={{ color: 'var(--ink-4)' }}>{o.sub}</span>
                    </button>
                  );
                })}
              </div>
              {minFiab > 0 && (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  Bassin réduit : les prospects jamais notés par un pro sont exclus.
                </div>
              )}
            </div>
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
                    <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: disabled ? 'var(--ivory-2)' : 'color-mix(in oklab, var(--accent) 12%, var(--paper))',
                      color: disabled ? 'var(--ink-4)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={m.id === 'standard' ? 'handshake' : 'users'} size={18}/>
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
                    {!disabled && (
                      <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                        border: '2px solid ' + (sel ? 'var(--accent)' : 'var(--line-2)'),
                        background: sel ? 'var(--accent)' : 'transparent', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <Icon name="check" size={11}/>}
                      </span>
                    )}
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
                    Activer le bonus parrain (étendre à leurs filleuls)
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    Lorsqu'un de vos prospects ciblés est un parrain, <strong>tous ses
                    filleuls reçoivent aussi votre sollicitation</strong> (mail + message),
                    même hors cible — plus de portée. À chaque acceptation d'un filleul,
                    son <strong>parrain touche +50 %</strong> de sa récompense (à votre
                    charge) ; le filleul perçoit la récompense normale. Le quota de la
                    campagne n'est jamais dépassé.
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
                <input
                  ref={kwInputRef}
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }}
                  placeholder="Ex : véhicule, immobilier, retraite…" maxLength={40}
                  className="input" style={{ flex: 1, fontSize: 13 }}/>
                {/* Bouton toujours actif visuellement : si l'input est vide,
                    on focus le champ pour inviter à saisir au lieu de griser
                    le CTA (UX). Ajout effectif uniquement avec une valeur. */}
                <button
                  onClick={() => {
                    if (!kwInput.trim()) { kwInputRef.current?.focus(); return; }
                    addKw();
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}>
                  <Icon name="plus" size={12}/> Ajouter
                </button>
              </div>

              {/* Suggestions rapides : on les affiche TANT qu'il en reste à
                  proposer, même après une première sélection (pour permettre
                  d'en ajouter plusieurs d'un clic). Les mots déjà ajoutés
                  sont filtrés pour éviter le doublon visuel. */}
              {KW_SUGGESTIONS.some(kw => !keywords.includes(kw)) && (
                <div style={{ marginBottom: 14 }}>
                  <div className="mono muted" style={{ fontSize: 10, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.1em' }}>Suggestions rapides</div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {KW_SUGGESTIONS.filter(kw => !keywords.includes(kw)).map(kw => (
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

            {/* « La Vitrine » — gestion depuis le récap. Le popup d'offre
                s'est ouvert à l'arrivée sur cette étape ; ici le pro peut
                ajouter / modifier / retirer l'option. */}
            <div style={{
              borderRadius: 14, padding: 16, marginBottom: 16,
              background: vitrineAdded ? 'color-mix(in oklab, var(--accent) 6%, var(--paper))' : 'var(--ivory-2)',
              border: '1px solid ' + (vitrineAdded ? 'color-mix(in oklab, var(--accent) 24%, var(--line))' : 'var(--line-2)'),
            }}>
              <div className="row between" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="globe" size={16}/></span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>La Vitrine</span>
                    <span className="mono" style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 6,
                      background: vitrineFree ? 'color-mix(in oklab, var(--good) 16%, var(--paper))' : 'color-mix(in oklab, var(--accent) 14%, var(--paper))',
                      color: vitrineFree ? 'var(--good)' : 'var(--accent)', fontWeight: 600,
                    }}>{vitrineFree ? 'Offert · 1ʳᵉ campagne' : '+2,00 €'}</span>
                  </div>
                  {vitrineAdded ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, wordBreak: 'break-all' }}>
                      Lien affiché sur l'annonce : <span style={{ color: 'var(--accent)', fontWeight: 500 }}>https://{vitrineUrl}</span>
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                      Affichez le lien de votre site sur l'annonce — les prospects découvrent ce que vous proposez, et vous suivez le nombre de visites.
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  {vitrineAdded ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVitrineModalOpen(true)}>Modifier</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVitrineAdded(false); setVitrineUrl(''); }}>Retirer</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setVitrineModalOpen(true)}>Ajouter mon site</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--ivory-2)', border: '1px solid var(--line-2)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              {[
                ['Objectif', obj?.name || '—'],
                ['Sous-types', obj ? Array.from(selectedSubs).map(sid => obj.sub.find(s => s.id === sid)?.name).filter(Boolean).join(', ') || '—' : '—'],
                ['Date de lancement', fmtDateLong(startDate)],
                ['Date de fin estimée', fmtDateLong(computedEndDate)],
                ['Durée', `${durationMeta.label} (gains ${durationMeta.multBadge})`],
                ['Paliers de données', Array.from(selectedTiers).map(tid => TIERS_DATA.find(t => t.id === tid)?.name).join(', ') || '—'],
                ['Zone', (() => {
                  if (geo === 'around') return `Autour de moi · ${radiusKm} km`;
                  const base = GEO_ZONES.find(z => z.id === geo)?.name || '—';
                  if (!geoTarget) return base;
                  if (geoTarget.type === 'ville') {
                    const cp = geoTarget.codesPostaux?.[0];
                    return `${base} · ${geoTarget.nom}${cp ? ` (${cp})` : ''}`;
                  }
                  if (geoTarget.type === 'dept') return `${base} · ${geoTarget.nom} (${geoTarget.code})`;
                  if (geoTarget.type === 'region') return `${base} · ${geoTarget.nom}`;
                  return base;
                })()],
                ["Tranches d'âge", ages.size === 0 ? 'Toutes (aucune restriction)' : Array.from(ages).join(', ')],
                ['Vérification', VERIF_LEVELS.find(v => v.id === verif)?.name],
                ['Fiabilité minimum', minFiab === 0 ? 'Toutes (aucun filtre)' : `≥ ${minFiab} / 100`],
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
              {vitrineAdded && (
                <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Option La Vitrine
                    <span className="mono" style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 6,
                      background: vitrineFree ? 'color-mix(in oklab, var(--good) 16%, var(--paper))' : 'color-mix(in oklab, var(--ink) 8%, var(--paper))',
                      color: vitrineFree ? 'var(--good)' : 'var(--ink-2)', fontWeight: 600,
                    }}>{vitrineFree ? 'Offert · 1ʳᵉ campagne · prélevé immédiatement' : 'lien du site · prélevé immédiatement'}</span>
                  </span>
                  <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: vitrineFree ? 'var(--good)' : 'var(--ink)' }}>{vitrineFree ? 'Offert' : fmtEur(2)}</span>
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
                Bonus parrain (à vie)
              </div>
              {founderBonusEnabled ? (
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  Activé — les <strong>filleuls</strong> des parrains ciblés sont
                  sollicités en plus. À <strong>chaque acceptation d'un filleul</strong>,
                  son parrain touche <strong>+50 %</strong> de la récompense du filleul
                  (soit <strong>+{fmtEur(cpc / 2)}</strong>), <strong>à vie</strong>. Les
                  filleuls touchent la récompense normale. Les acceptations restent
                  plafonnées au quota de la campagne.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                  Désactivé pour cette campagne — les filleuls ne seront pas sollicités et
                  aucun bonus parrain ne sera versé.
                </div>
              )}
            </div>


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
                  // + option La Vitrine (2 €, offerte à la 1re campagne).
                  const totalNeeded = total + commission + cycleStartFee + vitrineFeeEur;
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
                        geo, geoTarget, radiusKm, ages: Array.from(ages), verifLevel: verif, minFiabilite: minFiab,
                        contacts,
                        durationKey,
                        startDate, endDate: computedEndDate, brief,
                        costPerContactCents: Math.round(cpc * 100),
                        budgetCents: Math.round(total * 100),
                        keywords, kwFilter, poolMode,
                        excludeCertified,
                        founder_bonus_enabled: founderBonusEnabled,
                        // « La Vitrine » — URL https du site (le serveur
                        // re-valide et recalcule le tarif : offert à la 1re
                        // campagne, 2 € sinon).
                        websiteUrl: vitrineAdded && vitrineUrl.trim()
                          ? 'https://' + vitrineUrl.trim().replace(/^https?:\/\//i, '')
                          : undefined,
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
                    // Lancement OK → on libère le brouillon, sinon le
                    // prochain mount du wizard rouvrirait une campagne
                    // déjà créée.
                    clearDraft();
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
      {confirmResetOpen && (
        <WizardResetConfirmModal
          onCancel={() => setConfirmResetOpen(false)}
          onConfirm={() => { resetWizard(); setConfirmResetOpen(false); }}
        />
      )}
      {multiTierModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="multitier-title"
          onClick={() => setMultiTierModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,22,41,.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)', color: 'var(--ink)', borderRadius: 18,
              padding: '28px 26px', width: 'min(460px, 100%)', textAlign: 'center',
              boxShadow: '0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)',
            }}
          >
            <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }} aria-hidden="true">🎯</div>
            <div id="multitier-title" className="serif" style={{ fontSize: 23, lineHeight: 1.2, marginBottom: 12 }}>
              Mode chasseur de précision activé !
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Vous demandez {selectedTiers.size} paliers de données
              {' ('}
              <strong style={{ color: 'var(--ink)' }}>
                {[...selectedTiers].sort((a, b) => a - b).map((t) => 'palier ' + t).join(', ')}
              </strong>
              {').'}
              <br /><br />
              ⚠️ Seuls les prospects qui ont renseigné <strong style={{ color: 'var(--ink)' }}>tous ces paliers</strong> pourront matcher avec votre campagne. Plus vous demandez de données, plus votre cible est qualifiée… mais plus le cercle se resserre 🔍
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setMultiTierModalOpen(false)}
            >
              OK, j'ai capté 🚀
            </button>
          </div>
        </div>
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
      {vitrineModalOpen && (
        <VitrineOfferModal
          free={vitrineFree}
          url={vitrineUrl}
          onSkip={() => setVitrineModalOpen(false)}
          onConfirm={(host) => {
            setVitrineUrl(host);
            setVitrineAdded(true);
            setVitrineModalOpen(false);
          }}
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
            // Mémorise l'acquittement pour la session : tant que la
            // campagne n'est pas lancée, la popup ne se rouvrira pas
            // au retour sur l'onglet (cf. load() au mount).
            setPlanAck();
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

// Histogramme compact d'une facette : libellé + barre proportionnelle + compte.
// `color` colore la barre (une teinte distincte par groupe de facette, cf. maquette).
function FacetBlock({ title, items, color = 'var(--accent)' }) {
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <div>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10, letterSpacing: '.12em' }}>{title}</div>
      <div className="col" style={{ gap: 9 }}>
        {items.map(i => (
          <div key={i.value} className="row center" style={{ gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.value}</div>
            <div style={{ width: 84, height: 7, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${(i.count / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
            </div>
            <div className="mono" style={{ fontSize: 11.5, width: 22, textAlign: 'right', color: 'var(--ink-2)', fontWeight: 600 }}>{i.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Contacts({ pendingContact, onPendingConsumed }) {
  const [allRows, setAllRows] = React.useState(null); // null = loading
  // Campagnes du pro (toutes), pour afficher les campagnes EN COURS sans
  // acceptation comme cartes vides verrouillées (sinon « Mes prospects » ne
  // montre que les campagnes ayant ≥1 prospect accepté).
  const [proCampaigns, setProCampaigns] = React.useState([]);
  const [reveal, setReveal] = React.useState(null); // { relationId, field, name } | null
  // Modale de composition d'email (envoi serveur via BUUPP). Ouverte
  // quand le pro clique le bouton "email" pour un prospect qui n'a pas
  // encore atteint son quota.
  const [emailCompose, setEmailCompose] = React.useState(null); // row | null
  // Fiche détaillée d'un prospect (catégories payées dans la campagne).
  const [detailsFor, setDetailsFor] = React.useState(null); // row | null
  const [collapsed, setCollapsed] = React.useState(new Set()); // Set<campaignId>
  const [selected, setSelected] = React.useState(new Set()); // Set<relationId>
  const [groupSending, setGroupSending] = React.useState(false);
  // Mise en avant temporaire d'une ligne sélectionnée depuis le champ
  // de recherche du header — surlignage doux qui s'efface tout seul.
  const [highlightId, setHighlightId] = React.useState(null);
  // --- Atelier de segmentation (par campagne) ---
  // Quand une campagne est sélectionnée, on bascule en mode "atelier" :
  // panneau audience (distributions par facette), barre de filtres/recherche
  // serveur, et segments enregistrés. Sinon, comportement historique (toutes
  // les lignes, groupées par campagne avec les 3 filtres locaux).
  const [activeCampaign, setActiveCampaign] = React.useState(null); // { id, name } | null — atelier (Statistiques)
  const [campaignFilter, setCampaignFilter] = React.useState(null); // { id, name } | null — filtre de la liste (chips)
  const [audience, setAudience] = React.useState(null); // { total, availableTiers, facets, savedSegments }
  const [segFilters, setSegFilters] = React.useState({}); // SegmentFilters
  const [broadcastOpen, setBroadcastOpen] = React.useState(false); // modal diffusion segment (SP2)
  const [filteredRows, setFilteredRows] = React.useState(null); // null = atelier inactif
  // Auto-sélection (une seule fois) : si le pro n'a qu'une campagne, on ouvre
  // l'atelier directement — sinon le panneau Audience restait caché derrière un
  // clic non évident. Un clic ultérieur sur « Toutes » est respecté (ref posé).
  const autoSelectedRef = React.useRef(false);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/contacts', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => { if (!cancelled) setAllRows(j.rows || []); })
      .catch(() => { if (!cancelled) setAllRows([]); });
    return () => { cancelled = true; };
  }, []);

  // Liste des campagnes du pro → permet d'afficher les campagnes EN COURS
  // (active/paused) même sans aucune acceptation (carte vide verrouillée).
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/campaigns', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(j => { if (!cancelled) setProCampaigns(j.campaigns || []); })
      .catch(() => { if (!cancelled) setProCampaigns([]); });
    return () => { cancelled = true; };
  }, []);

  // Par défaut, toutes les campagnes s'affichent REPLIÉES dans « Mes contacts »
  // (le pro déplie celle qu'il veut consulter). On initialise `collapsed` avec
  // toutes les clés de campagne dès le premier chargement des lignes — une
  // seule fois (ref), pour ne pas réannuler les dépliages manuels ultérieurs.
  // Si on arrive depuis la recherche du header sur une campagne précise, on la
  // laisse dépliée (cohérent avec l'effet pendingContact ci-dessous).
  const didInitCollapseRef = React.useRef(false);
  React.useEffect(() => {
    if (didInitCollapseRef.current) return;
    if (!Array.isArray(allRows) || allRows.length === 0) return;
    didInitCollapseRef.current = true;
    const keys = new Set(allRows.map(r => r.campaignId || r.campaign || '—'));
    const camp = pendingContact?.payload?.campaignId || pendingContact?.payload?.campaign;
    if (camp) keys.delete(camp);
    setCollapsed(keys);
  }, [allRows, pendingContact]);

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

  // Charge l'audience (distributions par facette) à la sélection d'une campagne.
  React.useEffect(() => {
    if (!activeCampaign) { setAudience(null); return; }
    let cancelled = false;
    fetch(`/api/pro/campaigns/${activeCampaign.id}/audience`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setAudience(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeCampaign]);

  // Refetch la liste filtrée (côté serveur) quand la campagne ou les filtres changent.
  React.useEffect(() => {
    if (!activeCampaign) { setFilteredRows(null); return; }
    let cancelled = false;
    const params = new URLSearchParams({ campaignId: activeCampaign.id });
    if (Object.keys(segFilters).length > 0) params.set('filters', JSON.stringify(segFilters));
    fetch(`/api/pro/contacts?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setFilteredRows(j.rows || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeCampaign, segFilters]);

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
  const [prioFilter, setPrioFilter] = useState(new Set()); // Set<1|2|3> — filtre priorité
  const toggle = (k) => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const togglePrio = (v) => setPrioFilter(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const clear = () => { setActive(new Set()); setPrioFilter(new Set()); };
  const ALL = allRows || [];
  const rows = ALL.filter(r =>
    (active.size === 0 || [...active].every(k => FILTERS[k].test(r))) &&
    (prioFilter.size === 0 || prioFilter.has(r.priority))
  );

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

  // Campagnes EN COURS (active/paused) sans aucune acceptation : on les
  // affiche quand même en « carte vide » verrouillée, pour que le pro voie sa
  // campagne dès le lancement (avant toute acceptation). Les campagnes déjà
  // représentées (≥1 prospect accepté) ne sont pas dupliquées.
  const groupsWithEmpty = React.useMemo(() => {
    // Métadonnées par campagne (brief + date de création) pour distinguer des
    // campagnes de même nom dans la carte.
    const metaById = new Map();
    for (const c of (proCampaigns || [])) {
      if (c?.id) metaById.set(c.id, { brief: c.brief || null, createdAt: c.createdAt || null });
    }
    // Enrichit les groupes ayant des prospects avec brief + date.
    const enriched = groups.map(g => ({
      ...g,
      brief: metaById.get(g.campaignId)?.brief ?? null,
      createdAt: metaById.get(g.campaignId)?.createdAt ?? null,
    }));
    const present = new Set(groups.map(g => g.campaignId));
    const extra = [];
    for (const c of (proCampaigns || [])) {
      if (!c?.id || present.has(c.id)) continue;
      if (c.status !== 'active' && c.status !== 'paused') continue;
      extra.push({
        campaignId: c.id,
        campaign: c.name || '—',
        items: [],
        empty: true,
        locked: true, // en cours → verrouillé (pas de détail)
        campaignObjective: c.objectiveId ?? null,
        brief: c.brief || null,
        createdAt: c.createdAt || null,
      });
    }
    // Campagnes en cours vides d'abord (les plus récentes en tête de liste),
    // puis les groupes ayant des prospects.
    return [...extra, ...enriched];
  }, [groups, proCampaigns]);

  // Liste des campagnes distinctes (à partir de TOUTES les lignes chargées),
  // pour le sélecteur de l'atelier de segmentation. Indépendante des filtres
  // locaux pour rester stable.
  const campaignList = React.useMemo(() => {
    const map = new Map();
    for (const r of ALL) {
      const key = r.campaignId || r.campaign;
      if (!key || map.has(key)) continue;
      map.set(key, { id: key, name: r.campaign || '—', locked: !!r.locked });
    }
    return Array.from(map.values());
  }, [ALL]);

  // Auto-sélection unique de l'unique campagne (cf. autoSelectedRef ci-dessus).
  React.useEffect(() => {
    // On n'auto-ouvre l'atelier que sur une campagne clôturée (déverrouillée) :
    // l'atelier (audience/segmentation) est gated côté serveur.
    if (!autoSelectedRef.current && activeCampaign === null && campaignList.length === 1 && !campaignList[0].locked) {
      autoSelectedRef.current = true;
      setActiveCampaign({ id: campaignList[0].id, name: campaignList[0].name });
    }
  }, [campaignList, activeCampaign]);

  // En mode atelier, la liste rendue provient de `filteredRows` (filtrage
  // serveur) regroupée en une seule campagne — réutilise tout le rendu de
  // groupe existant (tableau, actions par ligne, message groupé) inchangé.
  const displayGroups = React.useMemo(() => {
    if (!activeCampaign) {
      // Les chips de campagne agissent comme un FILTRE de la liste.
      return campaignFilter
        ? groupsWithEmpty.filter(g => g.campaignId === campaignFilter.id)
        : groupsWithEmpty;
    }
    const items = filteredRows || [];
    return [{ campaignId: activeCampaign.id, campaign: activeCampaign.name, items }];
  }, [activeCampaign, campaignFilter, filteredRows, groupsWithEmpty]);

  // Helpers de manipulation des filtres de segment (immutables).
  const setQ = (val) => setSegFilters(f => {
    const n = { ...f };
    if (val) n.q = val; else delete n.q;
    return n;
  });
  const addFacetValue = (key, val) => setSegFilters(f => {
    if (!val) return f;
    const arr = Array.isArray(f[key]) ? f[key] : [];
    if (arr.includes(val)) return f;
    return { ...f, [key]: [...arr, val] };
  });
  const removeFacetValue = (key, val) => setSegFilters(f => {
    const arr = (Array.isArray(f[key]) ? f[key] : []).filter(v => v !== val);
    const n = { ...f };
    if (arr.length > 0) n[key] = arr; else delete n[key];
    return n;
  });
  // Réinitialise une facette catégorielle (option « Tout afficher »).
  const clearFacet = (key) => setSegFilters(f => {
    const n = { ...f }; delete n[key]; return n;
  });
  // Filtre de score en deux tranches complémentaires : ≥ 720 (scoreMin) ou
  // < 720 (scoreMax = 719, car le backend exclut score > scoreMax).
  const setScoreBand = (band) => setSegFilters(f => {
    const n = { ...f }; delete n.scoreMin; delete n.scoreMax;
    if (band === 'gte720') n.scoreMin = 720;
    else if (band === 'lt720') n.scoreMax = 719;
    return n;
  });
  // Style commun des selects de filtre : flèche custom, bien espacée de la
  // bordure droite (paddingRight + chevron SVG positionné à 12px du bord).
  const selectStyle = {
    padding: '8px 34px 8px 12px', borderRadius: 8, border: '1px solid var(--line)',
    background: 'var(--paper)', fontSize: 13, cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  };
  // Couples [clé facette → libellé] pour générer les selects catégoriels DRY.
  const FACET_DEFS = [
    ['region', 'Région'], ['distance', 'Distance du centre'],
    ['logement', 'Logement'], ['statutPro', 'Statut pro'], ['foyer', 'Foyer'],
    ['vehicule', 'Véhicule'], ['animaux', 'Animaux'],
  ];

  // Style des onglets de campagne (pills) : actif = violet clair (cf. maquette).
  const segTabStyle = (on) => ({
    padding: '7px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
    fontWeight: on ? 600 : 500,
    border: on ? '1px solid color-mix(in oklab, var(--accent) 35%, white)' : '1px solid var(--line-2)',
    background: on ? 'var(--accent-soft)' : 'var(--paper)',
    color: on ? 'var(--accent-ink)' : 'var(--ink-4)',
    transition: 'background .15s, color .15s',
  });

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
      <SectionTitle eyebrow="Mes contacts" title="Prospects ayant accepté" desc="Données des prospects accessibles dans l'interface uniquement — watermarking appliqué à chaque fiche." action={
        <button className="btn btn-ghost btn-sm" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled><Icon name="lock" size={12}/> Export CSV indisponible</button>
      }/>

      {/* Sélecteur de campagne — agit comme un FILTRE de la liste (n'affiche que
          la campagne choisie). Masqué en mode atelier (Statistiques). */}
      {campaignList.length > 0 && !activeCampaign && (
        <div className="col gap-2">
          <div className="mono caps muted" style={{ fontSize: 10, letterSpacing: '.08em' }}>
            ▸ Cliquez une campagne pour n'afficher que ses prospects
          </div>
          <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
          <button
            onClick={() => setCampaignFilter(null)}
            style={segTabStyle(campaignFilter === null)}
          >
            Toutes
          </button>
          {campaignList.map(c => {
            const on = campaignFilter?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCampaignFilter({ id: c.id, name: c.name })}
                style={segTabStyle(on)}
              >
                {c.name}
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Bouton retour bien visible (violet clair) — sous le groupe de boutons. */}
      {activeCampaign && (
        <button
          onClick={() => { setActiveCampaign(null); setSegFilters({}); }}
          className="row center"
          style={{
            alignSelf: 'flex-start', gap: 8, padding: '11px 20px', borderRadius: 999,
            background: '#A78BFA', color: '#3B0764', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 12px color-mix(in oklab, #A78BFA 40%, transparent)',
            transition: 'transform .12s, box-shadow .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Icon name="arrowLeft" size={16}/> Retour aux campagnes
        </button>
      )}

      {/* Panneau Audience — distributions par facette de la campagne active. */}
      {audience && (
        <div className="card" style={{ padding: 'clamp(18px, 2.4vw, 26px)', margin: '12px 0' }}>
          <div className="row center" style={{ gap: 10, marginBottom: 20 }}>
            <span className="mono caps" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--ink-4)' }}>Audience</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '3px 11px', borderRadius: 999,
              background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 12, fontWeight: 600,
            }}>
              {audience.total} contact{audience.total === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '26px 32px' }}>
            <FacetBlock title="BUPP Score" color="#10b981" items={audience.facets.score.map(b => ({ value: b.label, count: b.count }))} />
            {audience.facets.region && <FacetBlock title="Région" color="#7c5cff" items={audience.facets.region} />}
            {audience.facets.distance && <FacetBlock title="Distance du centre" color="#3b82f6" items={audience.facets.distance} />}
            {audience.facets.statutPro && <FacetBlock title="Statut pro" color="#f0b429" items={audience.facets.statutPro} />}
            {audience.facets.logement && <FacetBlock title="Logement" color="#7c5cff" items={audience.facets.logement} />}
            {audience.facets.foyer && <FacetBlock title="Foyer" color="#10b981" items={audience.facets.foyer} />}
            {audience.facets.vehicule && <FacetBlock title="Véhicule" color="#3b82f6" items={audience.facets.vehicule} />}
            {audience.facets.animaux && <FacetBlock title="Animaux" color="#f0b429" items={audience.facets.animaux} />}
            <FacetBlock title="Contact" color="#64748b" items={audience.facets.reached} />
          </div>
        </div>
      )}

      {/* Barre de filtres + recherche (atelier actif). */}
      {audience && (
        <div className="card" style={{ padding: 16 }}>
          <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
            <input
              type="text"
              value={segFilters.q || ''}
              onChange={(e) => setQ(e.target.value || undefined)}
              placeholder="Rechercher (métier, ville, projet…)"
              style={{
                flex: '1 1 220px', minWidth: 180, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--paper)', fontSize: 13,
              }}
            />
            <select
              value={segFilters.scoreMin === 720 ? 'gte720' : segFilters.scoreMax === 719 ? 'lt720' : ''}
              onChange={(e) => setScoreBand(e.target.value)}
              style={selectStyle}
            >
              <option value="">Tout score</option>
              <option value="gte720">≥ 720</option>
              <option value="lt720">&lt; 720</option>
            </select>
            {FACET_DEFS.map(([key, label]) => {
              const facet = audience.facets[key];
              if (!facet) return null;
              return (
                <select
                  key={key}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__all__') clearFacet(key);
                    else addFacetValue(key, v);
                    e.target.value = '';
                  }}
                  style={selectStyle}
                >
                  <option value="">{label}</option>
                  <option value="__all__">Tout afficher</option>
                  {facet.map(o => (
                    <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
                  ))}
                </select>
              );
            })}
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const name = window.prompt('Nom du segment ?');
                if (!name) return;
                const r = await fetch('/api/pro/segments', {
                  method: 'POST', headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ campaignId: activeCampaign.id, name, filters: segFilters }),
                });
                if (r.ok) { const j = await r.json(); setAudience(a => a ? { ...a, savedSegments: [j.segment, ...(a.savedSegments || [])] } : a); }
              }}
            >
              <Icon name="download" size={11}/> Enregistrer ce filtre
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setBroadcastOpen(true)}
              title="Envoyer un message à tous les contacts du segment courant"
            >
              <Icon name="email" size={11}/> Diffuser un message
            </button>
            {Object.keys(segFilters).length > 0 && (
              <button className="chip" onClick={() => setSegFilters({})} style={{ cursor: 'pointer' }}>
                <Icon name="rotate" size={11}/> Réinitialiser
              </button>
            )}
          </div>
          {broadcastOpen && activeCampaign && (
            <BroadcastComposerModal
              campaignId={activeCampaign.id}
              campaignName={activeCampaign.name}
              filters={segFilters}
              onClose={() => setBroadcastOpen(false)}
              onSent={() => {}}
            />
          )}

          {/* Valeurs sélectionnées — chips retirables (score + facettes). */}
          {(segFilters.scoreMin != null || segFilters.scoreMax != null ||
            FACET_DEFS.some(([key]) => Array.isArray(segFilters[key]) && segFilters[key].length > 0)) && (
            <div className="row gap-1" style={{ flexWrap: 'wrap', marginTop: 10 }}>
              {(segFilters.scoreMin != null || segFilters.scoreMax != null) && (
                <button
                  className="chip"
                  onClick={() => setScoreBand('')}
                  style={{ cursor: 'pointer' }}
                  title="Retirer le filtre de score"
                >
                  Score : {segFilters.scoreMin != null ? `≥ ${segFilters.scoreMin}` : `< ${segFilters.scoreMax + 1}`} ×
                </button>
              )}
              {FACET_DEFS.flatMap(([key, label]) =>
                (Array.isArray(segFilters[key]) ? segFilters[key] : []).map(val => (
                  <button
                    key={`${key}:${val}`}
                    className="chip"
                    onClick={() => removeFacetValue(key, val)}
                    style={{ cursor: 'pointer' }}
                    title={`Retirer ${label} : ${val}`}
                  >
                    {label} : {val} ×
                  </button>
                ))
              )}
            </div>
          )}

          {/* Segments enregistrés. */}
          {Array.isArray(audience.savedSegments) && audience.savedSegments.length > 0 && (
            <div className="row center gap-1" style={{ flexWrap: 'wrap', marginTop: 12 }}>
              <span className="mono caps muted" style={{ fontSize: 10, marginRight: 4 }}>Segments</span>
              {audience.savedSegments.map(s => (
                <span key={s.id} className="chip row center" style={{ gap: 4 }}>
                  <button
                    onClick={() => setSegFilters(s.filters || {})}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={async () => {
                      const r = await fetch(`/api/pro/segments/${s.id}`, { method: 'DELETE' });
                      if (r.ok) setAudience(a => a ? { ...a, savedSegments: (a.savedSegments || []).filter(x => x.id !== s.id) } : a);
                    }}
                    aria-label={`Supprimer le segment ${s.name}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', opacity: 0.6 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters bar (mode historique — masquée en atelier). */}
      {!activeCampaign && (
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
                background: on ? '#3B82F6' : 'var(--paper)',
                color: on ? 'white' : 'var(--ink)',
                border: '1.5px solid ' + (on ? '#3B82F6' : 'var(--line-2)'),
                boxShadow: on ? '0 0 0 3px color-mix(in oklab, #3B82F6 16%, transparent)' : 'none',
                cursor: 'pointer', transition: 'all .15s'
              }}>
                {on && <span style={{ marginRight: 6 }}>✓</span>}
                {k.toUpperCase()} · {f.label}
              </button>
            );
          })}
          {/* Filtre par priorité de traitement (mêmes icônes/couleurs que la fiche). */}
          <div className="row center gap-2" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span className="mono caps" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--ink-4)' }}>Fiabilité</span>
            {FIABILITE_OPTS.map((o) => {
              const on = prioFilter.has(o.v);
              return (
                <button
                  key={o.v}
                  onClick={() => togglePrio(o.v)}
                  title={`Filtrer : fiabilité ${o.label}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: on ? `color-mix(in oklab, ${o.color} 14%, var(--paper))` : 'var(--paper)',
                    color: o.color,
                    border: '1.5px solid ' + (on ? o.color : 'var(--line-2)'),
                    boxShadow: on ? `0 0 0 3px color-mix(in oklab, ${o.color} 16%, transparent)` : 'none',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <Icon name={o.icon} size={12}/> {o.v} {o.label}
                </button>
              );
            })}
          </div>
          <button onClick={clear} style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
            background: (active.size === 0 && prioFilter.size === 0) ? 'var(--ink)' : 'var(--paper)',
            color: (active.size === 0 && prioFilter.size === 0) ? 'var(--paper)' : 'var(--ink-3)',
            border: '1.5px solid ' + ((active.size === 0 && prioFilter.size === 0) ? 'var(--ink)' : 'var(--line-2)'),
            cursor: 'pointer', transition: 'all .15s'
          }}>
            <Icon name="close" size={11}/> Sans filtre
          </button>
        </div>
      </div>
      )}

      {!activeCampaign && (
      <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
        Les campagnes en cours apparaîtront ici à leur clôture.
      </div>
      )}

      {!activeCampaign && allRows === null && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
        </div>
      )}

      {/* Compteur + état vide de l'atelier (mode campagne active). */}
      {activeCampaign && filteredRows !== null && (
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
          {filteredRows.length} contact{filteredRows.length === 1 ? '' : 's'}
        </div>
      )}
      {activeCampaign && filteredRows !== null && filteredRows.length === 0 && Object.keys(segFilters).length > 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Aucun contact pour ce filtre.</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setSegFilters({})}>
            <Icon name="rotate" size={11}/> Réinitialiser
          </button>
        </div>
      )}

      {!activeCampaign && allRows !== null && rows.length === 0 && allRows.length === 0 && groupsWithEmpty.length === 0 && (
        // Empty state aligné sur le pattern boîte aux lettres /
        // campagnes (cf. Prospect.jsx + Campagnes ci-dessus) : cercle
        // pastel + illustration 3D thiings.co + titre serif + sous-texte.
        <div
          className="card"
          style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 176,
              height: 176,
              borderRadius: '50%',
              background: 'color-mix(in oklab, #10B981 10%, var(--paper))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <img
              src="/empty-contacts.png"
              alt="Poignée de main — en attente de mises en relation"
              width={140}
              height={140}
              loading="lazy"
              decoding="async"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div
            className="serif"
            style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}
          >
            Vos futurs contacts arrivent
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--ink-4)',
              maxWidth: 340,
            }}
          >
            Dès qu'un prospect acceptera une mise en relation, il apparaîtra ici avec ses coordonnées et le contexte de la campagne.
          </div>
        </div>
      )}
      {!activeCampaign && allRows !== null && rows.length === 0 && allRows.length > 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Aucun prospect ne correspond aux filtres activés.
          </div>
        </div>
      )}

      {displayGroups.map((group) => {
        // Campagne en cours (non clôturée) : NON dépliable — on n'affiche
        // jamais le détail (lignes prospects, coordonnées) avant la clôture
        // (séquestre). Seul l'en-tête du groupe est visible.
        const locked = group.locked === true || !!group.items[0]?.locked;
        // Vue d'ensemble (« Toutes ») : campagnes repliées par défaut (cf. effet
        // d'init). En mode atelier (une campagne explicitement ouverte), on force
        // l'affichage déplié. Une campagne verrouillée reste TOUJOURS repliée.
        const isCollapsed = locked || (!activeCampaign && collapsed.has(group.campaignId));
        const emailableIds = group.items.filter(it => it.emailAvailable).map(it => it.relationId);
        const selectedInGroup = emailableIds.filter(id => selected.has(id));
        const allSelected = emailableIds.length > 0 && selectedInGroup.length === emailableIds.length;
        const someSelected = selectedInGroup.length > 0 && !allSelected;
        // Couleur de catégorie (accent latéral + pastille) dérivée de l'objectif
        // de la campagne ; date de clôture et aperçu d'avatars depuis les lignes.
        const cs = categoryStyle(group.items[0]?.campaignObjective ?? group.campaignObjective);
        const closesAt = group.items.find(it => it.campaignClosesAt)?.campaignClosesAt || null;
        const previewAvatars = group.items.slice(0, 3);
        const extraAvatars = group.items.length - previewAvatars.length;
        return (
          <div key={group.campaignId} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${cs.accent}` }}>
            <div
              className="row between"
              style={{
                padding: '16px 18px',
                gap: 14,
                alignItems: 'center',
                flexWrap: 'wrap',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--line)',
              }}
            >
              <button
                onClick={locked ? undefined : () => toggleCollapsed(group.campaignId)}
                disabled={locked}
                className="row center gap-3"
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: locked ? 'default' : 'pointer',
                  textAlign: 'left', minWidth: 0, flex: '1 1 260px',
                }}
                aria-expanded={locked ? undefined : !isCollapsed}
                title={locked ? 'Détails disponibles à la clôture de la campagne' : (isCollapsed ? 'Déplier' : 'Replier')}
              >
                <span style={{
                  display: 'inline-flex', width: 24, height: 24, borderRadius: 6,
                  background: cs.soft, alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: cs.accent,
                  transform: locked ? 'none' : (isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'),
                  transition: 'transform .15s',
                }}>
                  <Icon name={locked ? 'lock' : 'arrow'} size={12}/>
                </span>
                <div style={{ minWidth: 0 }}>
                  {/* Pastille catégorie (eyebrow) — icône selon l'objectif */}
                  <div className="row center gap-2" style={{ marginBottom: 4 }}>
                    <span style={{ display: 'inline-flex', color: cs.accent, flexShrink: 0 }}>
                      <Icon name={cs.icon} size={13}/>
                    </span>
                    <span className="mono caps" style={{ fontSize: 10, letterSpacing: '0.12em', color: cs.accent }}>{cs.label}</span>
                  </div>
                  <div className="serif" style={{ fontSize: 17, lineHeight: 1.2 }}>{group.campaign}</div>
                  {group.brief && (
                    <div className="muted" style={{ fontSize: 12.5, fontStyle: 'italic', marginTop: 3, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      « {group.brief} »
                    </div>
                  )}
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <span>{group.items.length} prospect{group.items.length > 1 ? 's' : ''}</span>
                    {group.createdAt && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                        Créée le {fmtDateLong(group.createdAt)}
                      </span>
                    )}
                    {locked ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: cs.accent }}>
                        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                        <Icon name="clock" size={11}/>
                        {group.empty ? 'En cours — en attente d\'acceptations' : 'En cours — détails à la clôture'}
                      </span>
                    ) : closesAt && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                        <Icon name="calendar" size={11}/>
                        Clôturée le {fmtDateLong(closesAt)}
                      </span>
                    )}
                    {selectedInGroup.length > 0 && (
                      <span><span aria-hidden style={{ opacity: 0.5 }}>·</span> {selectedInGroup.length} sélectionné{selectedInGroup.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </button>
              <div className="row center" style={{ gap: 14, flexWrap: 'wrap' }}>
                {/* Pile d'avatars */}
                {/* Aperçu d'avatars masqué pour une campagne en cours (les
                    avatars trahiraient des identités avant la clôture). */}
                {!locked && (
                <div style={{ display: 'flex', alignItems: 'center' }} title={`${group.items.length} prospect${group.items.length > 1 ? 's' : ''}`}>
                  {previewAvatars.map((it, idx) => (
                    <div key={it.relationId || idx} style={{ marginLeft: idx === 0 ? 0 : -10, border: '3px solid var(--paper)', borderRadius: 999, position: 'relative', zIndex: idx }}>
                      <Avatar name={it.name} size={30} color={avatarColor(it.name)}/>
                    </div>
                  ))}
                  {extraAvatars > 0 && (
                    <div style={{
                      marginLeft: -10, width: 30, height: 30, borderRadius: 999,
                      border: '3px solid var(--paper)', background: 'var(--ink)', color: 'var(--paper)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    }}>+{extraAvatars}</div>
                  )}
                </div>
                )}
                {/* Actions : Déplier · Statistiques · Sélectionner tous · Message groupé.
                    Toute la barre est masquée pour une campagne en cours (non
                    dépliable, aucune action possible avant la clôture). */}
                {!locked && (
                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleCollapsed(group.campaignId)}
                    aria-expanded={!isCollapsed}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                    title={isCollapsed ? 'Déplier la liste des prospects' : 'Replier la liste des prospects'}
                  >
                    <span style={{
                      display: 'inline-flex', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      transition: 'transform .15s',
                    }}>
                      <Icon name="arrow" size={12}/>
                    </span>
                    {isCollapsed ? 'Déplier' : 'Replier'}
                  </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setActiveCampaign({ id: group.campaignId, name: group.campaign }); setSegFilters({}); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                          color: cs.accent, borderColor: cs.accent,
                          background: `color-mix(in oklab, ${cs.accent} 8%, var(--paper))`,
                        }}
                        title="Statistiques de la campagne (audience, filtres, segments)"
                      >
                        <Icon name="chart" size={12}/> Statistiques
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setGroupSelected(group, !allSelected)}
                        disabled={emailableIds.length === 0}
                        style={{ opacity: emailableIds.length === 0 ? 0.4 : 1, whiteSpace: 'nowrap' }}
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
                          display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                        }}
                      >
                        <Icon name="email" size={12}/>
                        Message groupé{selectedInGroup.length > 0 ? ` (${selectedInGroup.length})` : ''}
                      </button>
                </div>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <div className="tbl-scroll tbl-scroll-flush">
                <table className="tbl">
                  <thead><tr>
                    <th style={{ width: 36 }}>
                      {!locked && (
                        <input
                          type="checkbox"
                          aria-label="Tout sélectionner dans cette campagne"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={(e) => setGroupSelected(group, e.target.checked)}
                          disabled={emailableIds.length === 0}
                        />
                      )}
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
                            {!r.locked && (
                              <input
                                type="checkbox"
                                aria-label={`Sélectionner ${r.name}`}
                                checked={isChecked}
                                onChange={() => toggleSelected(r.relationId)}
                                disabled={!r.emailAvailable}
                                title={r.emailAvailable ? '' : "Email non partagé — sélection désactivée"}
                              />
                            )}
                          </td>
                          <td className="row center gap-3"><Avatar name={r.name} size={28} color={avatarColor(r.name)}/><span>{r.name}</span></td>
                          <td className="mono tnum">{r.score}</td>
                          <td><span className="chip">P{r.tier}</span></td>
                          <td className="mono" style={{ fontSize: 12 }}>{r.locked ? <span className="muted" title="Disponible à la clôture">🔒</span> : r.email}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{r.locked ? <span className="muted" title="Disponible à la clôture">🔒</span> : r.telephone}</td>
                          <td className="muted mono" style={{ fontSize: 12 }}>{formatRelativeFr(r.receivedAt)}</td>
                          <td>
                            {r.locked ? <span className="muted">—</span> : (() => {
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
                            <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {r.locked ? (
                                <span className="muted mono" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Icon name="lock" size={11}/> Disponible à la clôture
                                </span>
                              ) : (<>
                              {/* Priorité de traitement enregistrée sur la fiche
                                  (ProspectDetailsModal) : badge icône + numéro +
                                  libellé, mêmes couleurs que le filtre/la fiche.
                                  Affiché entre l'évaluation et « Voir détails ». */}
                              {(() => {
                                const po = FIABILITE_OPTS.find(o => o.v === r.priority);
                                if (!po) return null;
                                return (
                                  <span
                                    title={`Fiabilité : ${po.label}`}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '4px 9px', borderRadius: 999,
                                      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                                      color: po.color,
                                      background: `color-mix(in oklab, ${po.color} 12%, var(--paper))`,
                                      border: `1px solid color-mix(in oklab, ${po.color} 35%, var(--line))`,
                                    }}
                                  >
                                    <Icon name={po.icon} size={11}/> {po.v} · {po.label}
                                  </span>
                                );
                              })()}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setDetailsFor({ row: r, siblings: group.items })}
                                title="Voir les catégories de données payées dans la campagne"
                                style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                              >
                                <Icon name="copy" size={12}/> Voir détails
                              </button>
                              <ContactActionButtons row={r} onIntent={(intent) => {
                              // Tout clic sur une icône de contact (téléphone,
                              // mail, SMS, WhatsApp) est logué en base :
                              // audit admin « Contacts (clics) » + déclencheur du
                              // rappel anti-abus au pro (≥3 clics/24h sur un même
                              // prospect). Fire-and-forget, non bloquant.
                              fetch(`/api/pro/contacts/${r.relationId}/contact-click`, {
                                method: 'POST',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({ channel: intent }),
                              }).catch(() => {});
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
                              </>)}
                            </div>
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
      <div className="card" style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', borderLeft: '4px solid #B91C1C' }}>
        <div className="row center gap-3">
          <span style={{ color: '#B91C1C', display: 'inline-flex' }}><Icon name="shield" size={16}/></span>
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: '#B91C1C' }}>Politique d'usage.</strong> <span style={{ color: 'rgba(185,28,28,.75)' }}>Les données des prospects sont watermarquées individuellement. Toute utilisation hors périmètre de la campagne déclenchera une enquête automatique et peut entraîner la résiliation du compte.</span>
          </div>
        </div>
      </div>

      {detailsFor && (
        <ProspectDetailsModal
          row={detailsFor.row}
          siblings={detailsFor.siblings}
          onNavigate={(nr) => setDetailsFor({ row: nr, siblings: detailsFor.siblings })}
          onPriorityChange={(relationId, priority) => {
            setAllRows((prev) => (prev || []).map((r) => r.relationId === relationId ? { ...r, priority } : r));
          }}
          onClose={() => setDetailsFor(null)}
        />
      )}

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

// Masquage VISUEL du téléphone affiché au pro. L'appel / SMS / WhatsApp
// continue d'utiliser le numéro complet (réel) : seul l'AFFICHAGE est masqué.
// Format aligné sur la liste « Mes contacts » : « 06 •• •• •• 78 ».
function maskPhoneDisplay(p) {
  if (!p) return p;
  const digits = String(p).replace(/\D/g, '');
  if (digits.length < 4) return p;
  return `${digits.slice(0, 2)} •• •• •• ${digits.slice(-2)}`;
}

// Métadonnées par "intent" — chaque bouton d'action déclenche un reveal
// puis ouvre une URL externe (tel, mailto, sms, wa.me).
const REVEAL_INTENTS = {
  call:     { field: 'telephone', icon: 'phone',    title: 'Contacter',                  cta: 'Appeler maintenant',           build: v => `tel:${v.replace(/[^\d+]/g, '')}`,                                                          valuePresentation: 'mono' },
  email:    { field: 'email',     icon: 'email',    title: 'Écrire à',                   cta: 'Ouvrir mon mail',              build: v => `mailto:${encodeURIComponent(v)}`,                                                          valuePresentation: 'mono' },
  sms:      { field: 'telephone', icon: 'sms',      title: 'Envoyer un SMS à',           cta: 'Ouvrir mes SMS',               build: v => `sms:${v.replace(/[^\d+]/g, '')}`,                                                          valuePresentation: 'mono' },
  whatsapp: { field: 'telephone', icon: 'whatsapp', title: 'WhatsApp avec',              cta: 'Ouvrir WhatsApp',              build: v => `https://wa.me/${v.replace(/\D/g, '')}`,                                                    valuePresentation: 'mono' },
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

/* Fiche détaillée d'un prospect : toutes les catégories de données
   payées par le pro dans la campagne (localisation, style de vie,
   pro, patrimoine…). Récupérées via GET /api/pro/contacts/<id>/details
   — l'e-mail reste l'alias watermarqué, jamais le vrai.
   Portail vers <body> (échappe au conteneur scrollable du tableau) +
   pattern scroll-safe (overflow auto, align flex-start, margin auto)
   pour rester lisible sur mobile / petit écran. */
// Métadonnées d'affichage par palier (icône + couleur + n°) — alignées sur la
// maquette de la fiche détaillée.
const TIER_META = {
  identity:     { n: 1, color: '#4F46E5', icon: 'user' },
  localisation: { n: 2, color: '#0D9488', icon: 'mapPin' },
  vie:          { n: 3, color: '#D97706', icon: 'heart' },
  pro:          { n: 4, color: '#1F2937', icon: 'briefcase' },
  patrimoine:   { n: 5, color: '#DB2777', icon: 'home' },
};
// Fiabilité (ex-« Priorité de traitement ») : note donnée par le pro au
// prospect. Chaque niveau a son icône. Sémantique « fiable » : Haute = vert
// (prospect fiable), Basse = rouge. La valeur DB reste relations.pro_priority.
const FIABILITE_OPTS = [
  { v: 1, label: 'Haute',   color: '#16A34A', icon: 'shieldCheck' },
  { v: 2, label: 'Moyenne', color: '#D97706', icon: 'shield' },
  { v: 3, label: 'Basse',   color: '#DC2626', icon: 'gauge' },
];
const fiabiliteLabel = (v) => (FIABILITE_OPTS.find(o => o.v === v)?.label) || null;

function ProspectDetailsModal({ row, siblings, onNavigate, onPriorityChange, onClose }) {
  const [status, setStatus] = React.useState('loading'); // loading | ok | error
  const [tiers, setTiers] = React.useState([]);
  const [ref, setRef] = React.useState(null);
  // Priorité : `picked` = sélection courante (non encore enregistrée),
  // `saved` = dernière valeur persistée (sert au bandeau bas + filtres).
  const [picked, setPicked] = React.useState(row.priority ?? null);
  const [saved, setSaved] = React.useState(row.priority ?? null);
  const [saving, setSaving] = React.useState(false);
  // Agrégat de fiabilité cross-pro : { '1': n, '2': n, '3': n } = nb de pros
  // distincts par niveau (badge sur la fiche).
  const [fiabAgg, setFiabAgg] = React.useState(null);

  // Navigation entre fiches d'une même campagne (Précédent / Suivant).
  const list = Array.isArray(siblings) ? siblings : [row];
  const idx = Math.max(0, list.findIndex(s => s.relationId === row.relationId));
  const total = list.length;
  const goPrev = () => { if (idx > 0 && onNavigate) onNavigate(list[idx - 1]); };
  const goNext = () => { if (idx < total - 1 && onNavigate) onNavigate(list[idx + 1]); };

  const cs = categoryStyle(row.campaignObjective);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, idx, total]);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPicked(row.priority ?? null);
    setSaved(row.priority ?? null);
    fetch(`/api/pro/contacts/${encodeURIComponent(row.relationId)}/details`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setTiers(Array.isArray(j?.tiers) ? j.tiers : []);
        setRef(j?.ref ?? null);
        setFiabAgg(j?.fiabiliteAgg ?? null);
        if (typeof j?.priority !== 'undefined') {
          setPicked(j.priority ?? null);
          setSaved(j.priority ?? null);
        }
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [row.relationId]);

  async function savePriority() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pro/contacts/${encodeURIComponent(row.relationId)}/priority`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priority: picked }),
      });
      if (!res.ok) { alert("Impossible d'enregistrer la fiabilité. Réessayez."); return; }
      setSaved(picked);
      if (onPriorityChange) onPriorityChange(row.relationId, picked);
    } catch {
      alert("Impossible d'enregistrer la fiabilité. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const num = String(idx + 1).padStart(2, '0');
  const modalNode = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', zIndex: 1000, padding: '24px 16px 48px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-details-title"
        style={{ width: '100%', maxWidth: 560, padding: 0, margin: 'auto 0', overflow: 'hidden' }}
      >
        {/* En-tête */}
        <div style={{ padding: '20px 22px', background: 'var(--ivory-2)', borderBottom: '1px solid var(--line)' }}>
          <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div className="row center gap-3" style={{ minWidth: 0 }}>
              <Avatar name={row.name} size={42} color={avatarColor(row.name)}/>
              <div style={{ minWidth: 0 }}>
                <h3 id="prospect-details-title" className="serif" style={{ fontSize: 19, lineHeight: 1.2, margin: 0, color: 'var(--ink)', wordBreak: 'break-word' }}>
                  Fiche de {row.name}
                </h3>
                <div style={{ fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>
                  <span className="muted">Catégories payées dans </span>
                  <strong style={{ color: cs.accent }}>« {cs.full} »</strong>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer" style={{ flexShrink: 0 }}>
              <Icon name="close" size={12}/>
            </button>
          </div>
          {/* Badge fiche + pagination */}
          <div className="row between" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
            <div className="row center gap-2" style={{ minWidth: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--ink)', color: 'var(--paper)', fontSize: 10, fontWeight: 600, letterSpacing: '.06em' }}>
                <Icon name="doc" size={11}/> FICHE
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', wordBreak: 'break-all' }}>
                N° {num}{ref ? ` · ${ref}` : ''}
              </span>
            </div>
            <div className="row center gap-2">
              <button onClick={goPrev} disabled={idx <= 0} className="btn btn-ghost btn-sm" style={{ opacity: idx <= 0 ? 0.4 : 1, cursor: idx <= 0 ? 'not-allowed' : 'pointer' }}>
                <Icon name="arrowLeft" size={12}/> Précédent
              </button>
              <span className="mono tnum" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                <strong>{num}</strong> <span className="muted">/ {total}</span>
              </span>
              <button onClick={goNext} disabled={idx >= total - 1} className="btn btn-ghost btn-sm" style={{ opacity: idx >= total - 1 ? 0.4 : 1, cursor: idx >= total - 1 ? 'not-allowed' : 'pointer' }}>
                Suivant <Icon name="arrowRight" size={12}/>
              </button>
            </div>
          </div>
        </div>

        {/* Corps scrollable */}
        <div style={{ padding: '18px 22px', maxHeight: '64vh', overflowY: 'auto' }}>
          {/* Priorité de traitement */}
          <div style={{
            background: 'color-mix(in oklab, #7C3AED 6%, var(--paper))',
            border: '1px solid color-mix(in oklab, #7C3AED 18%, var(--line))',
            borderRadius: 14, padding: 16, marginBottom: 16,
          }}>
            <div className="row center gap-3" style={{ marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 9, background: 'var(--paper)', border: '1px solid var(--line)', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                <Icon name="flag" size={16}/>
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Fiabilité</div>
                <div className="muted" style={{ fontSize: 12 }}>Notez la fiabilité de ce prospect : elle alimente son indice de désirabilité et vous sert à filtrer vos contacts.</div>
              </div>
            </div>
            {(() => {
              // Badge cross-pro : icône + compteur par niveau (nb de pros
              // distincts). Ex. « 3 » sur Haute = 3 pros ont noté Haute.
              const agg = fiabAgg || {};
              const items = FIABILITE_OPTS
                .map((o) => ({ o, n: Number(agg[String(o.v)] || 0) }))
                .filter((x) => x.n > 0);
              if (items.length === 0) return null;
              return (
                <div className="row center gap-2" style={{ flexWrap: 'wrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <span className="mono caps" style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--ink-4)' }}>Noté par d'autres pros</span>
                  {items.map(({ o, n }) => (
                    <span
                      key={o.v}
                      title={`${n} professionnel${n > 1 ? 's' : ''} ont noté la fiabilité « ${o.label} »`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 7px 4px 9px', borderRadius: 999, color: o.color,
                        background: `color-mix(in oklab, ${o.color} 12%, var(--paper))`,
                        border: `1px solid color-mix(in oklab, ${o.color} 35%, var(--line))`,
                        fontSize: 11.5, fontWeight: 600,
                      }}
                    >
                      <Icon name={o.icon} size={12}/> {o.label}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999,
                        background: o.color, color: '#fff', fontSize: 10.5, fontWeight: 700,
                      }}>{n}</span>
                    </span>
                  ))}
                </div>
              );
            })()}
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {FIABILITE_OPTS.map((o) => {
                const on = picked === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => setPicked(on ? null : o.v)}
                    style={{
                      flex: '1 1 90px', minWidth: 90, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                      background: on ? `color-mix(in oklab, ${o.color} 12%, var(--paper))` : 'var(--paper)',
                      border: '1.5px solid ' + (on ? o.color : 'var(--line-2)'),
                      transition: 'all .12s',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: o.color, fontWeight: 700, fontSize: 14 }}>
                      <Icon name={o.icon} size={13}/> {o.v}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{o.label}</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={savePriority}
              disabled={saving || picked === saved}
              className="btn"
              style={{
                marginTop: 12, background: 'var(--ink)', color: 'var(--paper)',
                padding: '9px 16px', borderRadius: 8, fontWeight: 500, fontSize: 13, border: 0,
                cursor: (saving || picked === saved) ? 'default' : 'pointer',
                opacity: (saving || picked === saved) ? 0.55 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="doc" size={12}/> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          {status === 'loading' && (
            <div className="muted" style={{ fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
              Chargement des informations…
            </div>
          )}
          {status === 'error' && (
            <div role="alert" style={{
              padding: '10px 14px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fca5a5',
              color: '#991b1b', fontSize: 12.5, lineHeight: 1.5,
            }}>
              Impossible de charger les détails de ce prospect pour le moment.
              Réessayez dans un instant.
            </div>
          )}
          {status === 'ok' && tiers.length === 0 && (
            <div className="muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              Aucune catégorie de données disponible pour cette campagne.
            </div>
          )}
          {status === 'ok' && tiers.length > 0 && (
            <div className="col gap-3">
              {tiers.map((t) => {
                const m = TIER_META[t.key] || { n: '', color: 'var(--accent)', icon: 'doc' };
                return (
                  <div key={t.key} style={{ border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
                    <div className="row between" style={{ padding: '10px 14px', background: 'var(--ivory-2)', borderBottom: '1px solid var(--line-2)', alignItems: 'center', gap: 10 }}>
                      <div className="row center gap-2" style={{ minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 7, background: m.color, color: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name={m.icon} size={14}/>
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                      </div>
                      <span className="mono caps" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '.1em', textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
                        PALIER<br/>{m.n}
                      </span>
                    </div>
                    <div>
                      {(t.items || []).map((it, i) => (
                        <div
                          key={i}
                          className="row between"
                          style={{
                            padding: '10px 14px', gap: 12, alignItems: 'flex-start',
                            borderBottom: i < t.items.length - 1 ? '1px solid var(--line)' : 'none',
                          }}
                        >
                          <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>{it.label}</span>
                          <span style={{
                            fontSize: 13, fontWeight: 500, textAlign: 'right',
                            color: it.value ? 'var(--ink)' : 'var(--ink-4)',
                            fontStyle: it.value ? 'normal' : 'italic',
                            wordBreak: 'break-word', minWidth: 0,
                          }}>
                            {it.value
                              ? (it.label === 'Téléphone' ? maskPhoneDisplay(it.value) : it.value)
                              : '— non renseigné —'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="row" style={{
                gap: 8, padding: '10px 12px', borderRadius: 8,
                background: 'color-mix(in oklab, #4F46E5 6%, var(--paper))',
                border: '1px solid color-mix(in oklab, #4F46E5 18%, var(--line))', fontSize: 11.5,
                color: 'var(--ink-3)', lineHeight: 1.5, alignItems: 'flex-start',
              }}>
                <span aria-hidden="true" style={{ flexShrink: 0, color: '#4F46E5' }}><Icon name="info" size={14}/></span>
                <span>
                  L'e-mail est un alias sécurisé watermarqué : tout message y est
                  routé vers le prospect, et toute fuite reste imputable. Accès
                  journalisé conformément à notre politique RGPD.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bandeau bas */}
        <div className="row between" style={{ padding: '12px 22px', borderTop: '1px solid var(--line)', background: 'var(--paper)', alignItems: 'center', gap: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {saved
              ? <>Fiabilité <strong style={{ color: FIABILITE_OPTS.find(o => o.v === saved)?.color }}>{fiabiliteLabel(saved)}</strong></>
              : 'Fiabilité non notée — enregistrez pour filtrer.'}
          </span>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Fermer</button>
        </div>
      </div>
    </div>
  );

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
              {field === 'telephone' ? maskPhoneDisplay(value) : value}
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

/* ─── BroadcastComposerModal — diffusion médiée à un segment (SP2) ──────
   Le pro compose un message ; BUUPP l'envoie par email à tous les prospects
   du segment (filtres courants). Le pro ne voit jamais les adresses. Quota
   1/campagne : les prospects déjà sollicités sont ignorés. */
function BroadcastComposerModal({ campaignId, campaignName, filters, onClose, onSent }) {
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [result, setResult] = React.useState(null);

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
      const r = await fetch('/api/pro/segments/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaignId, filters, subject: subj, body: bod }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j) { setResult(j); if (onSent) onSent(); return; }
      const codeMap = {
        campaign_not_closed: "La campagne n'est pas encore clôturée.",
        forbidden: 'Action non autorisée sur cette campagne.',
        subject_too_long: "L'objet est trop long (200 caractères max).",
        body_too_long: 'Le message est trop long (10 000 caractères max).',
        pro_email_missing: 'Votre email est introuvable.',
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
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 560, padding: 26 }}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 20 }}>Diffuser un message au segment</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer" disabled={sending}>
            <Icon name="close" size={12}/>
          </button>
        </div>

        {result ? (
          <div>
            <div style={{
              padding: '12px 14px', borderRadius: 8, marginBottom: 14,
              background: 'color-mix(in oklab, var(--good, #15803d) 8%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--good, #15803d) 30%, var(--line))',
              fontSize: 13, lineHeight: 1.5, color: 'var(--ink-3)',
            }}>
              <strong style={{ color: 'var(--ink)' }}>Diffusion lancée.</strong>{' '}
              {result.sent} message{result.sent === 1 ? '' : 's'} en cours d'envoi
              sur {result.total} contact{result.total === 1 ? '' : 's'} du segment.
              {result.skippedQuota > 0 && <> {result.skippedQuota} déjà sollicité{result.skippedQuota === 1 ? '' : 's'} (quota).</>}
              {result.skippedNoEmail > 0 && <> {result.skippedNoEmail} sans email partagé.</>}
              {result.skippedCap > 0 && <> {result.skippedCap} au-delà du plafond ({/* */}500) — affinez le segment pour les inclure.</>}
            </div>
            <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="btn btn-primary btn-sm">Fermer</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 14,
              background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--accent) 24%, var(--line))',
              fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)',
            }}>
              <strong style={{ color: 'var(--ink)' }}>Diffusion médiée par BUUPP.</strong>{' '}
              Votre message part depuis nos serveurs vers tous les contacts du segment
              actuel, avec votre adresse en <em>Reply-To</em>. Les adresses des prospects
              restent cachées. Quota&nbsp;: 1 email par campagne — les prospects déjà
              sollicités sont automatiquement ignorés.
            </div>

            <label className="label" style={{ marginBottom: 4, display: 'block' }}>Objet</label>
            <input
              type="text" className="input" value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 200))}
              maxLength={200}
              placeholder="Ex. : Une offre pensée pour vous"
              style={{ width: '100%', fontSize: 14, padding: '10px 12px', marginBottom: 14 }}
              disabled={sending} autoFocus/>

            <label className="label" style={{ marginBottom: 4, display: 'block' }}>
              Message
              <span className="mono muted" style={{ float: 'right', fontSize: 11 }}>{body.length} / 10000</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 10000))}
              rows={9} maxLength={10000}
              placeholder={`Bonjour,\n\nMerci d'avoir accepté ma sollicitation. Je reviens vers vous pour…`}
              style={{
                width: '100%', padding: 10, borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--paper)',
                fontFamily: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 6,
              }}
              disabled={sending}/>

            <div className="muted" style={{ fontSize: 11, marginBottom: 14, lineHeight: 1.45 }}>
              Votre message sera intégré dans un email aux couleurs BUUPP, en mentionnant
              la campagne {campaignName ? <><em>«&nbsp;{campaignName}&nbsp;»</em></> : 'concernée'}.
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
              <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={sending}>Annuler</button>
              <button onClick={submit} className="btn btn-primary btn-sm"
                disabled={sending || !subject.trim() || !body.trim()}>
                {sending ? 'Diffusion…' : 'Diffuser via BUUPP'}
              </button>
            </div>
          </>
        )}
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
  // Taux de lecture des messages pro→prospect (pixel d'ouverture, gaté par
  // le consentement CNIL du prospect). rate=null ⇒ aucun envoi traçable.
  const msgOpens = data?.messageOpens || { sent: 0, trackable: 0, opened: 0, rate: null };

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

      {/* Lecture des messages — combien des prospects acceptés ont ouvert
          les messages envoyés via BUUPP. Suivi par pixel d'ouverture,
          posé uniquement avec le consentement CNIL du prospect : le taux
          se calcule donc sur les seuls envois traçables (pas sur le total),
          pour ne pas afficher un chiffre trompeur. */}
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Lecture des messages</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          Part des prospects acceptés qui ont ouvert les messages que vous leur avez envoyés via BUUPP
        </div>
        {msgOpens.rate === null ? (
          <CardEmptyState
            image="/empty-geo.png"
            alt="Aucun message suivi"
            tint="#6D5BFF"
            title={msgOpens.sent === 0 ? "Aucun message envoyé" : "Aucun message suivi pour l'instant"}
            sub={msgOpens.sent === 0
              ? "Dès que vous écrirez à vos prospects acceptés (onglet Contacts ou diffusion de segment), leur taux de lecture s'affichera ici."
              : `${msgOpens.sent} message${msgOpens.sent > 1 ? 's' : ''} envoyé${msgOpens.sent > 1 ? 's' : ''}, mais aucun n'est traçable : le suivi d'ouverture n'est activé que pour les prospects ayant explicitement consenti.`}
          />
        ) : (
          <div className="row" style={{ alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div className="serif tnum" style={{ fontSize: 56, lineHeight: 1, color: 'var(--accent)' }}>
              {msgOpens.rate}%
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <div style={{ height: 8, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: Math.min(100, msgOpens.rate) + '%', background: 'var(--accent)', borderRadius: 999 }}/>
              </div>
              <div style={{ fontSize: 14 }}>
                <strong className="tnum">{msgOpens.opened}</strong> ouverture{msgOpens.opened > 1 ? 's' : ''} sur{' '}
                <strong className="tnum">{msgOpens.trackable}</strong> message{msgOpens.trackable > 1 ? 's' : ''} suivi{msgOpens.trackable > 1 ? 's' : ''}
              </div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                {msgOpens.sent} envoyé{msgOpens.sent > 1 ? 's' : ''} au total
                {msgOpens.sent > msgOpens.trackable
                  ? ` · ${msgOpens.sent - msgOpens.trackable} sans suivi (consentement non donné)`
                  : ''}
              </div>
            </div>
          </div>
        )}
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
        {geo.length === 0 ? (
          <CardEmptyState
            image="/empty-geo.png"
            alt="Aucune ville disponible"
            tint="#0EA5E9"
            title="La carte est encore vide"
            sub="Les villes de vos prospects acceptés s'afficheront ici dès vos premières mises en relation."
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}>
            {geo.map((r, i) => (
              <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
                <div className="serif" style={{ fontSize: 18 }}>{r.ville}</div>
                <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{r.pct}%</div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{r.contacts} contact{r.contacts > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        )}
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
        {sex.every(s => Number(s.pct) === 0) ? (
          <CardEmptyState
            image="/empty-sex.png"
            alt="Aucun profil pour le moment"
            tint="#EC4899"
            title="Pas encore de profils à comparer"
            sub="La répartition femmes / hommes / autre apparaîtra ici dès vos premières acceptations."
          />
        ) : (
          <>
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
          </>
        )}
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
  // undefined = chargement, null = aucune carte, objet = carte Stripe.
  const [payCard, setPayCard] = useState(undefined);
  const [cardSetupLoading, setCardSetupLoading] = useState(false);
  const startCardSetup = () => {
    if (cardSetupLoading) return;
    setCardSetupLoading(true);
    fetch('/api/stripe/setup', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.url) { window.top.location.href = j.url; }
        else { setCardSetupLoading(false); alert("Impossible d'ouvrir l'enregistrement de carte. Réessayez."); }
      })
      .catch(() => { setCardSetupLoading(false); alert("Erreur réseau. Réessayez."); });
  };
  // Déclenche le téléchargement d'un PDF servi en `Content-Disposition:
  // attachment`. On évite `window.open('_blank')` : appelé APRÈS l'await
  // du PATCH /api/pro/info, il a perdu l'activation utilisateur du clic
  // et le navigateur le bloque comme une popup (rien ne se passe). Un
  // <a> cliqué programmatiquement n'est, lui, pas soumis au bloqueur de
  // popups et hérite du nom de fichier du header serveur.
  const downloadAttachment = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  // État du modal "Compléter la facture" : la facture qu'on s'apprête
  // à télécharger. La modale pré-remplit les mentions légales lues
  // depuis /api/pro/info, et persiste les modifs avant de déclencher
  // l'ouverture du PDF.
  const [pdfPrompt, setPdfPrompt] = useState(null);
  // État du bouton "Tout télécharger" : true = modale de mentions
  // légales ouverte en mode bulk. À la confirmation, on ouvre le PDF
  // combiné (/api/pro/invoices/download-all).
  const [bulkPrompt, setBulkPrompt] = useState(false);
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
    fetch('/api/pro/wallet/payment-method', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { card: null })
      .then(j => { if (!cancelled) setPayCard(j.card ?? null); })
      .catch(() => { if (!cancelled) setPayCard(null); });
    const onChange = () => {
      refresh();
      fetch('/api/pro/wallet/payment-method', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { card: null })
        .then(j => { if (!cancelled) setPayCard(j.card ?? null); })
        .catch(() => { if (!cancelled) setPayCard(null); });
    };
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div className="card" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Illustration thiings.co (couronne) — symbolise l'abonnement
              actif. Taille compacte (44 px dans un cercle 56) pour ne
              pas déséquilibrer la grille 1/2 largeur. */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'color-mix(in oklab, #F59E0B 12%, var(--paper))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <img
              src="/empty-plan.png"
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>Abonnement actuel</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>{planInfo ? planInfo.label : '…'}</div>
            {(planInfo && Number.isFinite(Number(planInfo.cycleCount)) && Number.isFinite(Number(planInfo.cap))) ? (
              <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {Number(planInfo.cycleCount)}/{Number(planInfo.cap)} utilisées
                </span>
                <span className="muted"> · </span>
                <span style={{ color: 'var(--good)', fontWeight: 600 }}>
                  {Math.max(0, Number(planInfo.cap) - Number(planInfo.cycleCount))} restante{Math.max(0, Number(planInfo.cap) - Number(planInfo.cycleCount)) > 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>—</div>
            )}
          </div>
        </div>
        {payCard === null ? (
          // Empty state aligné sur le pattern campagnes / contacts :
          // cercle pastel + illustration 3D thiings.co + texte + CTA.
          // Layout compact pour rester dans la cellule de grille (1/2 largeur).
          <div
            className="card"
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10, alignSelf: 'flex-start' }}>
              Carte enregistrée
            </div>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: 'color-mix(in oklab, #6366F1 10%, var(--paper))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <img
                src="/empty-card.png"
                alt="Aucune carte bancaire enregistrée"
                width={76}
                height={76}
                loading="lazy"
                decoding="async"
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Aucune carte enregistrée</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 12, maxWidth: 280, lineHeight: 1.5 }}>
              Ajoutez votre carte pour recharger votre wallet et lancer vos campagnes.
            </div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={cardSetupLoading}
              onClick={startCardSetup}
            >
              {cardSetupLoading ? '…' : 'Enregistrer une carte'}
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>Carte enregistrée</div>
            <div className="serif" style={{ fontSize: 24 }}>
              {payCard === undefined
                ? '…'
                : `${payCard.brand ? payCard.brand.charAt(0).toUpperCase() + payCard.brand.slice(1) : 'Carte'} ••${payCard.last4 ?? '????'}`}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {(payCard && payCard.expMonth && payCard.expYear)
                ? `Expire ${String(payCard.expMonth).padStart(2, '0')}/${payCard.expYear}`
                : '—'}
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 18 }}>
          <div className="serif" style={{ fontSize: 22 }}>Historique des factures</div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-telecharger"
            onClick={() => setBulkPrompt(true)}
            disabled={!invoices || invoices.length === 0}
            title={
              invoices && invoices.length
                ? 'Télécharger toutes les factures (un seul PDF)'
                : 'Aucune facture à télécharger'
            }
          >
            <Icon name="download" size={12}/> Tout télécharger
          </button>
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
            downloadAttachment(url);
            setPdfPrompt(null);
          }}
        />
      )}
      {bulkPrompt && (
        <InvoiceFieldsModal
          bulk
          invoiceCount={invoices ? invoices.length : 0}
          onClose={() => setBulkPrompt(false)}
          onConfirmed={() => {
            // Mentions légales enregistrées : on ouvre le PDF combiné de
            // toutes les factures dans un nouvel onglet.
            downloadAttachment('/api/pro/invoices/download-all');
            setBulkPrompt(false);
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
function InvoiceFieldsModal({ invoice, onClose, onConfirmed, bulk = false, invoiceCount = 0 }) {
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
    numeroTva: '',
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
          numeroTva: j.numeroTva ?? '',
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
  // Blocage symétrique à ProInfoEditModal : on refuse de générer la
  // facture si le SIREN/SIRET saisi n'a pas été validé positivement par
  // SIRENE (sans ce garde-fou, on persiste un faux numéro côté
  // /api/pro/info au prochain submit). On accepte 'error' (API
  // data.gouv.fr down) pour ne pas bloquer en cas de panne.
  const sirenInput = form.siren.trim();
  const siretInput = form.siret.trim();
  const sirenLengthOk = sirenInput.length === 0 || /^\d{9}$/.test(sirenInput);
  const siretLengthOk = siretInput.length === 0 || /^\d{14}$/.test(siretInput);
  const blockedByVerification =
    (sirenInput || siretInput) && (
      !sirenLengthOk ||
      !siretLengthOk ||
      (verify.status !== 'found' && verify.status !== 'error')
    );
  const canSubmit =
    !loading &&
    missing.length === 0 &&
    hasIdentifier &&
    hasRegistration &&
    !blockedByVerification;

  // Affichage différé du bandeau "non enregistré" pour saisie partielle :
  // 1,5 s d'inactivité avant d'afficher, reset à chaque frappe. Évite le
  // clignotement à chaque chiffre tapé dans SIREN ou SIRET.
  const [showPartialWarning, setShowPartialWarning] = useState(false);
  React.useEffect(() => {
    const sirenPartial = sirenInput.length > 0 && !sirenLengthOk;
    const siretPartial = siretInput.length > 0 && !siretLengthOk;
    if (!sirenPartial && !siretPartial) {
      setShowPartialWarning(false);
      return;
    }
    setShowPartialWarning(false);
    const t = setTimeout(() => setShowPartialWarning(true), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sirenInput, siretInput, sirenLengthOk, siretLengthOk]);

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
          numeroTva: form.numeroTva.trim() || null,
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
            <div className="mono caps muted" style={{ fontSize: 11, marginBottom: 6 }}>{bulk ? '— Téléchargement des factures' : '— Génération facture'}</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
              Compléter les mentions légales
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ color: 'var(--ink-4)', padding: 4, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8, marginBottom: 18 }}>
          {bulk ? (
            <>Vérifiez (et complétez si nécessaire) les informations qui apparaîtront sur {invoiceCount > 1 ? <>vos <strong>{invoiceCount} factures</strong></> : <>votre facture</>}. Elles seront automatiquement enregistrées dans <strong>Mes informations</strong> pour les prochaines factures.</>
          ) : (
            <>Vérifiez (et complétez si nécessaire) les informations qui apparaîtront sur votre facture <strong>{invoice.number}</strong>. Elles seront automatiquement enregistrées dans <strong>Mes informations</strong> pour les prochaines factures.</>
          )}
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

            {/* Saisie partielle d'un des deux numéros : message d'erreur
                affiché après ~1,5 s d'inactivité (cf. showPartialWarning),
                pour laisser à l'utilisateur le temps de finir sa saisie. */}
            {showPartialWarning && ((sirenInput.length > 0 && !sirenLengthOk) || (siretInput.length > 0 && !siretLengthOk)) ? (
              <div role="alert" style={{
                marginTop: 4, padding: '10px 12px', borderRadius: 8,
                background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                color: '#991B1B', fontSize: 12.5, lineHeight: 1.5,
              }}>
                ❌ <strong>Numéro non enregistré</strong> —
                {sirenInput.length > 0 && !sirenLengthOk && (
                  <> SIREN doit comporter <strong>9 chiffres</strong> ({sirenInput.length} saisi{sirenInput.length > 1 ? 's' : ''}).</>
                )}
                {siretInput.length > 0 && !siretLengthOk && (
                  <> SIRET doit comporter <strong>14 chiffres</strong> ({siretInput.length} saisi{siretInput.length > 1 ? 's' : ''}).</>
                )}
                {' '}Tant que le numéro n'est pas complet et reconnu par SIRENE, la facture ne pourra pas être générée.
              </div>
            ) : null}
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
                ❌ <strong>Numéro non enregistré</strong> — introuvable dans le registre officiel SIRENE. Vérifiez la saisie : tant que le numéro n'est pas reconnu, la facture ne pourra pas être générée.
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
            <div className="row gap-3 wrap">
              <div style={{ flex: '1 1 220px' }}>
                <div className="label">N° TVA intracommunautaire</div>
                <input className="input mono" {...fld('numeroTva')} placeholder="FR.. (si assujetti à la TVA)" />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Requis pour la facturation électronique (à partir de 2026) si vous êtes assujetti à la TVA. Laissez vide en franchise en base.
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
          <button
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={!canSubmit || saving}
            title={
              blockedByVerification
                ? verify.status === 'loading'
                  ? 'Vérification SIRENE en cours…'
                  : verify.status === 'not_found'
                  ? 'Numéro non enregistré : introuvable dans SIRENE'
                  : 'Numéro SIREN/SIRET incomplet (9 ou 14 chiffres)'
                : undefined
            }
          >
            {saving ? 'Enregistrement…' : (bulk ? 'Enregistrer & tout télécharger' : 'Enregistrer & télécharger le PDF')}
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
  // Filtres « Contacts obtenus ». `cDraft` = saisie dans le panneau ;
  // `cApplied` = filtres réellement envoyés à l'API (déclenche le
  // re-fetch). Défauts = comportement historique (aucun param).
  const [cFilterOpen, setCFilterOpen] = useState(false);
  const [cDraft, setCDraft] = useState({ status: 'all', scoreMin: '', period: 'all' });
  const [cApplied, setCApplied] = useState({ status: 'all', scoreMin: '', period: 'all' });
  const cFilterActive =
    cApplied.status !== 'all' || cApplied.scoreMin !== '' || cApplied.period !== 'all';
  // Téléchargement du relevé PDF de la campagne (onglet Facturation).
  const [statementLoading, setStatementLoading] = useState(false);

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

  // Télécharge le relevé PDF complet de la campagne. On passe par un blob
  // (plutôt qu'une nav directe) pour rester dans l'iframe du prototype et
  // gérer proprement les erreurs (401/404/500 → message au lieu d'un PDF
  // cassé). Le gating séquestre est appliqué côté API.
  const downloadStatement = async () => {
    if (!campId || statementLoading) return;
    setStatementLoading(true);
    try {
      const r = await fetch(`/api/pro/campaigns/${campId}/statement`, { cache: 'no-store' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Impossible de générer le relevé : " + (j?.error || r.status));
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers.get('content-disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : 'releve-campagne.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erreur réseau : " + (e.message || ''));
    } finally {
      setStatementLoading(false);
    }
  };

  // Fetch du détail (campaign + funnel + contacts + activity) à l'arrivée
  // sur la page et à chaque changement d'id de campagne.
  useEffect(() => {
    if (!campId) return;
    let cancelled = false;
    setData(null);
    setLoadError(null);
    const qs = new URLSearchParams();
    if (cApplied.status !== 'all') qs.set('cstatus', cApplied.status);
    if (cApplied.scoreMin !== '' && Number.isFinite(Number(cApplied.scoreMin))) {
      qs.set('cscoremin', String(Math.max(0, Math.floor(Number(cApplied.scoreMin)))));
    }
    if (cApplied.period !== 'all') qs.set('cperiod', cApplied.period);
    const q = qs.toString();
    fetch(`/api/pro/campaigns/${campId}${q ? `?${q}` : ''}`, { cache: 'no-store' })
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
  }, [campId, reloadKey, cApplied]);

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
            {data.brief && (
              <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.5, maxWidth: 640 }}>
                « {data.brief} »
              </div>
            )}
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
              // Segments du sous-titre. Le nombre de refus est mis en rouge
              // (var(--danger)) pour attirer l'œil du pro → on retourne du
              // JSX (le rendu {k[2]} accepte string OU node).
              const segs = [`${winCount} / ${sent} sollicité${sent > 1 ? 's' : ''}`];
              if (pending > 0) segs.push(`${pending} en attente`);
              if (refused > 0) segs.push(
                <span key="refus" style={{ color: 'var(--danger)' }}>{refused} refus</span>
              );
              if (expired > 0) segs.push(`${expired} expiré${expired > 1 ? 's' : ''}`);
              const out = [];
              segs.forEach((s, i) => {
                if (i > 0) out.push(<span key={'sep' + i}> · </span>);
                out.push(s);
              });
              return <>{out}</>;
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
          // Le badge reflète le nombre d'acceptations (winCount), pas la
          // liste détaillée : celle-ci est masquée (=[]) tant que la campagne
          // n'est pas clôturée (gating séquestre, cf. proCanSeeContacts). Le
          // compteur n'est pas une donnée personnelle → cohérent avec le KPI
          // « Contacts obtenus » et la carte verrouillée « X acceptés ».
          ['contacts', 'Contacts (' + winCount + ')'],
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

          {/* La Vitrine — lien du site + compteur de clics (option payante) */}
          {data.websiteUrl && (
            <div className="card" style={{ padding: 28, gridColumn: '1 / -1' }}>
              <div className="row between" style={{ marginBottom: 18, alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="serif" style={{ fontSize: 22 }}>La Vitrine</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    Lien de votre site affiché sur l'annonce vue par les prospects
                  </div>
                </div>
                <span className="chip" style={{ fontSize: 11, background: 'var(--ivory-2)', color: 'var(--ink-3)' }}>
                  {Number(data.websiteAddonPaidCents ?? 0) > 0
                    ? 'Option : ' + fmt2(Number(data.websiteAddonPaidCents) / 100) + ' €'
                    : 'Offert · 1ʳᵉ campagne'}
                </span>
              </div>
              <a
                href={data.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="row" style={{ gap: 8, alignItems: 'center', color: 'var(--accent)', textDecoration: 'none', fontSize: 14, fontWeight: 500, minWidth: 0, wordBreak: 'break-all' }}
              >
                <Icon name="globe" size={16}/> {data.websiteUrl} <Icon name="ext" size={12}/>
              </a>
              {/* Deux indicateurs distincts : (1) le nombre de visites du site
                  — qui n'implique PAS une acceptation — et (2) le rapport
                  clics / acceptés. Les visites sont des prospects distincts
                  (1 clic max par prospect). */}
              {(() => {
                const clicks = Number(data.websiteClickCount ?? 0);
                const accepted = Number(winCount ?? 0);
                const ratioLabel = accepted > 0 ? Math.round((clicks / accepted) * 100) + ' %' : '—';
                const tile = { background: 'var(--ivory-2)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--line)' };
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                    <div style={tile}>
                      <div className="muted mono caps" style={{ fontSize: 10 }}>Visites du site</div>
                      <div className="serif tnum" style={{ fontSize: 26, color: 'var(--accent)', marginTop: 2 }}>{fmt0(clicks)}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>prospect{clicks === 1 ? '' : 's'} ayant cliqué (≠ accepté)</div>
                    </div>
                    <div style={tile}>
                      <div className="muted mono caps" style={{ fontSize: 10 }}>Prospects acceptés</div>
                      <div className="serif tnum" style={{ fontSize: 26, marginTop: 2 }}>{fmt0(accepted)}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>ont accepté la sollicitation</div>
                    </div>
                    <div style={tile}>
                      <div className="muted mono caps" style={{ fontSize: 10 }}>Clics / acceptés</div>
                      <div className="serif tnum" style={{ fontSize: 26, marginTop: 2 }}>{ratioLabel}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{fmt0(clicks)} clic{clicks === 1 ? '' : 's'} pour {fmt0(accepted)} accepté{accepted === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

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
        data.contactsLocked ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div className="serif" style={{ fontSize: 16 }}>
              <Icon name="lock" size={15}/> Données des prospects disponibles à la clôture
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {data.lockedUntil
                ? 'Déblocage le ' + new Date(data.lockedUntil).toLocaleDateString('fr-FR')
                : 'Déblocage à la clôture de la campagne'}
            </div>
            <div className="row center gap-4" style={{ marginTop: 12 }}>
              <span><strong>{data.funnel?.accepted ?? 0}</strong> acceptés</span>
              <span><strong>{data.funnel?.refused ?? 0}</strong> refusés</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div className="serif" style={{ fontSize: 20 }}>Contacts obtenus</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {(data.contacts?.length || 0)} prospect{(data.contacts?.length || 0) > 1 ? 's' : ''} ayant accepté votre mise en relation
                </div>
              </div>
              <div className="row gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCFilterOpen(o => !o)}
                  style={cFilterActive ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                >
                  <Icon name="filter" size={12}/> Filtrer{cFilterActive ? ' •' : ''}
                </button>
              </div>
            </div>
            {cFilterOpen && (
              <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: 'var(--ivory)' }}>
                <label className="col" style={{ gap: 4 }}>
                  <span className="mono caps muted" style={{ fontSize: 10 }}>Statut</span>
                  <select className="input" value={cDraft.status}
                    onChange={e => setCDraft(d => ({ ...d, status: e.target.value }))}>
                    <option value="all">Tous</option>
                    <option value="accepted">En séquestre</option>
                    <option value="settled">Crédité</option>
                  </select>
                </label>
                <label className="col" style={{ gap: 4 }}>
                  <span className="mono caps muted" style={{ fontSize: 10 }}>Score min.</span>
                  <input className="input mono" type="number" min="0" inputMode="numeric"
                    value={cDraft.scoreMin} placeholder="—"
                    onChange={e => setCDraft(d => ({ ...d, scoreMin: e.target.value }))}
                    style={{ width: 110 }}/>
                </label>
                <label className="col" style={{ gap: 4 }}>
                  <span className="mono caps muted" style={{ fontSize: 10 }}>Période</span>
                  <select className="input" value={cDraft.period}
                    onChange={e => setCDraft(d => ({ ...d, period: e.target.value }))}>
                  <option value="all">Tout</option>
                  <option value="7d">7 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="90d">90 jours</option>
                </select>
              </label>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setCApplied(cDraft); }}>
                Appliquer
              </button>
              <button className="btn btn-ghost btn-sm"
                onClick={() => {
                  const reset = { status: 'all', scoreMin: '', period: 'all' };
                  setCDraft(reset); setCApplied(reset);
                }}>
                Réinitialiser
              </button>
            </div>
          )}
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
        )
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
            <button
              className="btn btn-ghost btn-sm"
              onClick={downloadStatement}
              disabled={statementLoading}
              style={statementLoading ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              <Icon name="download" size={12}/> {statementLoading ? 'Génération…' : 'Relevé complet'}
            </button>
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
  // Les trois champs ci-dessous sont édités via un même flow d'autocomplétion
  // (CityPostalAutocomplete) : sélectionner une ville renseigne aussi le
  // code postal et la région. Cf. ProInfoEditModal (flag `cityPostal: true`).
  { key: 'ville',          label: 'Ville',                              placeholder: 'Lyon',                                      cityPostal: true },
  { key: 'codePostal',     label: 'Code postal',                        placeholder: '5 chiffres — rempli avec la ville',          cityPostal: true, mono: true },
  { key: 'region',         label: 'Région',                             placeholder: 'Auto-renseignée à la sélection de la ville', cityPostal: true },
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

// Icône + couleur par champ (en-tête de chaque ligne d'« Informations société »).
const PRO_INFO_ICON = {
  raisonSociale:    { icon: 'briefcase', color: '#4F46E5' },
  formeJuridique:   { icon: 'doc',       color: '#7C3AED' },
  adresse:          { icon: 'mapPin',    color: '#0D9488' },
  ville:            { icon: 'mapPin',    color: '#0D9488' },
  codePostal:       { icon: 'mapPin',    color: '#0891B2' },
  region:           { icon: 'france',    color: '#0891B2' },
  capitalSocialEur: { icon: 'money',     color: '#16A34A' },
  siren:            { icon: 'shield',    color: '#D97706' },
  siret:            { icon: 'shield',    color: '#D97706' },
  rcsVille:         { icon: 'doc',       color: '#DB2777' },
  rmNumber:         { icon: 'doc',       color: '#E11D48' },
};

function MesInformations({ info, setInfo, returnAfterInfo, onCancelReturn, scrollToFieldKey, onScrolled }) {
  const [editing, setEditing] = useState(null); // { key, label, value }
  const [confirmFieldDelete, setConfirmFieldDelete] = useState(null); // { key, label }
  const [confirmAllDelete, setConfirmAllDelete] = useState(false);

  // Scroll ciblé : quand on arrive sur l'onglet via un lien pointant un champ
  // précis (ex. « Mes informations » de la note adresse du ciblage « autour de
  // moi »), on amène la ligne concernée au centre + flash bref, au lieu de
  // laisser le pro en haut de page. One-shot : `onScrolled` purge l'intent côté
  // parent pour qu'un retour ultérieur via la sidebar ne re-scrolle pas.
  const scrollTargetRef = React.useRef(null);
  useEffect(() => {
    if (!scrollToFieldKey) return;
    const el = scrollTargetRef.current;
    const t = setTimeout(() => {
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        catch { el.scrollIntoView(); }
        const prevBg = el.style.background;
        el.style.transition = 'background-color .4s ease';
        el.style.background = 'color-mix(in oklab, var(--accent) 12%, var(--paper))';
        setTimeout(() => { el.style.background = prevBg || 'var(--paper)'; }, 1600);
      }
      onScrolled && onScrolled();
    }, 140); // laisse le layout de l'onglet se monter avant de mesurer
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToFieldKey]);

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

      {/* Completeness summary — jauge circulaire + checklist (coches vertes) */}
      <div className="card pro-info-completeness" style={{ padding: 24, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 124, height: 124, justifySelf: 'center' }}>
          {(() => {
            const pct = totalRequired ? filledRequired / totalRequired : 0;
            const R = 54, C = 2 * Math.PI * R, off = C * (1 - pct);
            return (
              <svg width="124" height="124" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="62" cy="62" r={R} stroke="var(--ivory-2)" strokeWidth="10" fill="none"/>
                <circle cx="62" cy="62" r={R} stroke="var(--accent)" strokeWidth="10" fill="none"
                  strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset .5s ease' }}/>
              </svg>
            );
          })()}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="serif tnum" style={{ fontSize: 32, lineHeight: 1, color: 'var(--ink)' }}>{filledRequired}</div>
            <div className="mono muted" style={{ fontSize: 10, marginTop: 3, letterSpacing: '.08em' }}>/ {totalRequired}</div>
          </div>
        </div>
        <div>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 12 }}>Complétude du profil entreprise</div>
          <div className="col gap-2">
            {PRO_INFO_FIELDS.filter(f => !f.optional).map(f => {
              const filled = !!info[f.key];
              return (
                <div key={f.key} className="row center gap-2" style={{ fontSize: 13 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: filled ? '#16A34A' : 'var(--ivory-2)',
                    color: filled ? '#fff' : 'var(--ink-4)',
                  }}>
                    {filled ? <Icon name="check" size={12} stroke={2.5}/> : <Icon name="dot" size={7}/>}
                  </span>
                  <span style={{ color: filled ? 'var(--ink)' : 'var(--ink-3)' }}>{f.label}</span>
                </div>
              );
            })}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            {isComplete
              ? 'Toutes les informations obligatoires sont renseignées.'
              : 'Complétez les informations restantes pour finaliser votre profil.'}
          </div>
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
              <div key={f.key} className="pro-info-tile"
                ref={f.key === scrollToFieldKey ? scrollTargetRef : null}
                style={{
                background: 'var(--paper)', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                {(() => {
                  const m = PRO_INFO_ICON[f.key] || { icon: 'briefcase', color: 'var(--accent)' };
                  return (
                    <span className="pro-info-tile-icon" style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `color-mix(in oklab, ${m.color} 15%, var(--paper))`,
                      color: m.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={m.icon} size={15}/>
                    </span>
                  );
                })()}
                <div className="pro-info-tile-body" style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 3 }}>
                    {f.label}{f.optional ? ' · facultatif' : ''}
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
                    title="Modifier"
                    onClick={() => setEditing({ key: f.key, label: f.label, value: val, mono: f.mono, placeholder: f.placeholder, optional: f.optional })}>
                    <Icon name="edit" size={11}/>
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                    onClick={() => { if (val && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(val); }}
                    disabled={!val}
                    title={val ? 'Copier' : 'Aucune valeur à copier'}>
                    <Icon name="copy" size={11}/>
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
            .pro-info-completeness { grid-template-columns: 1fr !important; justify-items: center; gap: 18px !important; }
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
          onConfirm={() => {
            setInfo(prev => {
              const next = { ...prev, [confirmFieldDelete.key]: '' };
              // Ville / Code postal / Région sont édités via le même flow
              // d'autocomplétion : effacer l'un revient à effacer le groupe
              // pour ne pas laisser de combinaison incohérente en BDD.
              const f = PRO_INFO_FIELDS.find(x => x.key === confirmFieldDelete.key);
              if (f?.cityPostal) {
                next.ville = '';
                next.codePostal = '';
                next.region = '';
              }
              return next;
            });
            setConfirmFieldDelete(null);
          }}
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
                <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'right' }}>
                  <div>
                    <span className="serif tnum" style={{ fontSize: 20, color: 'var(--ink)' }}>{p.monthlyEur} €</span>
                    <span className="muted"> / {p.maxCampaigns} campagnes</span>
                  </div>
                  {/* Transparence prix (parité page d'accueil) : coût
                      d'acquisition prospect à part (bleu accent), puis
                      commission BUUPP sur le budget de campagne (vert). */}
                  <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12, marginTop: 2 }}>hors coût d'acquisition prospect</div>
                  <div style={{ color: '#16A34A', fontWeight: 600, fontSize: 12, marginTop: 1 }}>+10% commission buupp / budget de campagne</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f, i) => (
                  <li key={i} className="row" style={{ gap: 9, fontSize: 13, lineHeight: 1.4, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: `color-mix(in oklab, ${p.color} 16%, var(--paper))`,
                      color: p.color, marginTop: 1,
                    }}>
                      <Icon name="check" size={12} stroke={2.5}/>
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
                  background: isCurrent ? 'color-mix(in oklab, #16A34A 12%, var(--paper))' : (p.id === 'pro' ? p.color : 'var(--ink)'),
                  color: isCurrent ? '#16A34A' : 'var(--paper)',
                  border: '1.5px solid ' + (isCurrent ? '#16A34A' : (p.id === 'pro' ? p.color : 'var(--ink)')),
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: submitting && !isLoading ? 0.5 : 1,
                  fontWeight: 600,
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

/* Sous-modale dédiée à l'édition groupée Ville + Code postal + Région
   via CityPostalAutocomplete (geo.api.gouv.fr). Une sélection patche
   atomiquement les trois champs en passant `{ replaceFields }` au
   callback parent — déjà supporté par MesInformations.onSave.
   CityPostalAutocomplete est défini côté Prospect.jsx mais hoisté au
   scope global après transpile Babel-standalone (pattern identique à
   EmailTrackingConsentCard). */
function CityPostalEditCard({ edit, onSave, onClose }) {
  const [pair, setPair] = useState(null); // { ville, codePostal, region }
  // Affiche les valeurs courantes (ville/CP/région) pour rappel — utile
  // quand on rouvre la modale pour ajuster la sélection.
  const currentSummary = (edit.value || '').trim();
  return (
    <ProInfoModalShell title={'Modifier : ' + edit.label} onClose={onClose}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.55 }}>
        Tapez les premières lettres de votre ville ou son code postal puis
        sélectionnez-la dans la liste — <strong>Ville</strong>,{' '}
        <strong>Code postal</strong> et <strong>Région</strong> seront
        renseignés automatiquement.
      </div>
      <CityPostalAutocomplete
        value={currentSummary}
        onPick={(item) => setPair(item)}
        autoFocus
      />
      {pair && (
        <div className="row gap-2" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip">{pair.ville}</span>
          <span className="chip mono">{pair.codePostal}</span>
          {pair.region && <span className="chip">{pair.region}</span>}
          <span className="muted" style={{ fontSize: 12 }}>Sélection prête à enregistrer.</span>
        </div>
      )}
      <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
        <button
          onClick={() => pair && onSave({
            replaceFields: {
              ville: pair.ville,
              codePostal: pair.codePostal,
              region: pair.region || '',
            },
          })}
          disabled={!pair}
          className="btn btn-primary btn-sm"
        >
          Enregistrer
        </button>
      </div>
    </ProInfoModalShell>
  );
}

function ProInfoEditModal({ edit, onSave, onAutoSave, onClose }) {
  // Flow groupé ville + code postal + région via autocomplétion
  // geo.api.gouv.fr. Tous les hooks ci-dessous (vérif SIRENE, auto-save…)
  // sont inutiles pour ce flow ; on délègue à CityPostalEditCard qui
  // gère son propre cycle de vie. Early-return safe : l'instance de la
  // modale est démontée/remontée à chaque ouverture (`editing` parent).
  if (edit.cityPostal) {
    return <CityPostalEditCard edit={edit} onSave={onSave} onClose={onClose} />;
  }

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

  // On bloque l'enregistrement tant que le SIREN/SIRET saisi n'a pas été
  // validé positivement par SIRENE. La vérif est asynchrone (debounce
  // 350 ms + appel data.gouv.fr) ; sans ce garde-fou, l'auto-save 700 ms
  // pouvait fire avant la réponse 'not_found' et persister un faux
  // numéro en base. On exige donc 'found' (ou 'error' = API indispo —
  // tolérance pour ne pas frustrer en cas de panne data.gouv.fr).
  // S'applique symétriquement à SIREN et à SIRET (même code path).
  const sirenSiretWithValue = (isSiren || isSiret) && !!val.trim();
  const blockedByVerification =
    sirenSiretWithValue &&
    verify.status !== 'found' &&
    verify.status !== 'error';
  const canSave =
    (edit.optional || val.trim()) && !blockedByVerification;

  // Affichage différé du message d'erreur pour saisie partielle : on
  // attend 1,5 s d'inactivité pour ne pas faire clignoter l'alerte
  // rouge à chaque chiffre tapé. Reset immédiat dès que val change ;
  // également immédiat si val devient vide ou atteint la longueur cible.
  const [showPartialWarning, setShowPartialWarning] = useState(false);
  React.useEffect(() => {
    if (!(isSiren || isSiret)) return;
    if (val.length === 0 || val.length === maxLen) {
      setShowPartialWarning(false);
      return;
    }
    setShowPartialWarning(false);
    const t = setTimeout(() => setShowPartialWarning(true), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val, isSiren, isSiret, maxLen]);

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
      {/* Saisie partielle : longueur insuffisante → on signale que le numéro
          ne sera pas sauvegardé. Le bandeau apparaît avec ~1,5 s de délai
          (cf. showPartialWarning) pour laisser à l'utilisateur le temps de
          finir sa saisie sans faire clignoter le message à chaque chiffre. */}
      {(isSiren || isSiret) && val.length > 0 && val.length < maxLen && showPartialWarning && (
        <div role="alert" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1.5px solid #FCA5A5',
          color: '#991B1B', fontSize: 12.5, lineHeight: 1.5,
        }}>
          ❌ <strong>Numéro non enregistré</strong> — un {isSiret ? 'SIRET' : 'SIREN'} valide doit comporter <strong>{maxLen} chiffres</strong> ({val.length}{val.length === 1 ? ' chiffre' : ' chiffres'} saisi{val.length > 1 ? 's' : ''} pour l'instant). Tant que le numéro n'est pas complet et reconnu par SIRENE, il ne sera pas sauvegardé.
        </div>
      )}
      {(isSiren || isSiret) && val.length === maxLen && verify.status === 'loading' && (
        <div role="status" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: 'var(--ivory-2)', border: '1px solid var(--line-2)',
          color: 'var(--ink-3)', fontSize: 12.5,
        }}>
          Vérification en cours sur le registre officiel…
        </div>
      )}
      {(isSiren || isSiret) && val.length === maxLen && verify.status === 'not_found' && (
        <div role="alert" style={{
          marginBottom: 14, padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1.5px solid #FCA5A5',
          color: '#991B1B', fontSize: 12.5, lineHeight: 1.5,
        }}>
          ❌ <strong>Numéro non enregistré</strong> — introuvable dans le registre officiel SIRENE. Vérifiez votre saisie : tant que le numéro n'est pas reconnu, il ne sera pas sauvegardé.
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
          title={
            blockedByVerification
              ? verify.status === 'loading'
                ? 'Vérification SIRENE en cours…'
                : verify.status === 'not_found'
                ? 'Numéro non enregistré : introuvable dans SIRENE'
                : 'Numéro incomplet — saisissez ' + (isSiret ? '14' : '9') + ' chiffres'
              : undefined
          }
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
