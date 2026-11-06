// Tests & Études — onglets prospect (ProspectStudiesPanel) et pro (ProStudiesPanel).
// Chargé avant Prospect.jsx / Pro.jsx (cf. shell.html). Les composants partagés
// (SectionTitle, Icon, DashShell…) sont résolus au rendu, pas au chargement.
// Spec : docs/superpowers/specs/2026-11-06-tests-etudes-design.md

const studiesEur = (c) => (Number(c || 0) / 100).toFixed(2).replace('.', ',') + ' €';
const studiesDate = (s) => s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Interrupteur du module (app_config.studies_enabled) pour afficher ou non l'onglet. */
function useStudiesEnabled() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    fetch('/api/studies/enabled', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { enabled: false })
      .then(d => { if (alive) setOn(!!d.enabled); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return on;
}

const STUDY_BADGE_STYLE = {
  open: ['var(--accent-soft, #EEF2FF)', 'var(--accent, #4F46E5)'],
  remaining: ['#FEF3C7', '#B45309'],
  validated: ['#DCFCE7', '#15803D'],
  full: ['#E0E7FF', '#3730A3'],
  canceled: ['#FEE2E2', '#B91C1C'],
  closed: ['#F1F5F9', '#475569'],
  draft: ['#F1F5F9', '#475569'],
};
function StudyBadge({ badge }) {
  if (!badge) return null;
  const [bg, fg] = STUDY_BADGE_STYLE[badge.key] || STUDY_BADGE_STYLE.closed;
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg, whiteSpace: 'nowrap' }}>{badge.label}</span>;
}

function StudyGauge({ joined, min, max }) {
  const pct = Math.min(100, (joined / Math.max(1, max)) * 100);
  return (
    <div>
      <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--ivory-2, #F1EDE2)' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: joined >= min ? '#15803D' : 'var(--accent)' }}/>
        <div style={{ position: 'absolute', left: (min / Math.max(1, max)) * 100 + '%', top: -3, width: 2, height: 14, background: 'var(--ink)' }}/>
      </div>
      <div className="row between muted" style={{ fontSize: 12, marginTop: 4 }}>
        <span><strong style={{ color: 'var(--ink)' }}>{joined}</strong> inscrit{joined > 1 ? 's' : ''}</span>
        <span>seuil {min} · max {max}</span>
      </div>
    </div>
  );
}

const PART_STATUS = {
  joined: ['Inscrit — en attente du seuil', ''],
  confirmed: ['À réaliser', 'warn'],
  done: ['Terminée — validation en attente', ''],
  approved: ['Validée et payée', 'good'],
  rejected: ['Refusée — contestable 7 jours', 'warn'],
  disputed: ['Contestation en cours', ''],
  rejected_final: ['Refusée', ''],
  not_done: ['Non réalisée', ''],
};
const REJECT_LABELS = {
  code_missing: 'Code non reçu',
  code_invalid: 'Code invalide ou déjà utilisé',
  incomplete: 'Tâche incomplète',
  fraud: 'Participation en double / frauduleuse',
  other: 'Autre',
};

async function studiesPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
}

/* ═════════════════════════ PROSPECT ═════════════════════════ */

function ProspectStudiesPanel() {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  const [notes, setNotes] = React.useState({});
  const [flash, setFlash] = React.useState(null);

  const load = React.useCallback(() => {
    return fetch('/api/prospect/studies', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    if (data && data.unreadCount > 0) {
      fetch('/api/prospect/studies', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ markRead: true }) }).catch(() => {});
    }
  }, [data && data.unreadCount]);

  const act = async (campaignId, path, body, okText) => {
    setBusy(campaignId + path);
    const r = await studiesPost(`/api/studies/${campaignId}/${path}`, body);
    setBusy(null);
    setFlash(r.ok ? { ok: true, text: okText } : { ok: false, text: 'Action impossible pour le moment (' + (r.data.error || r.status) + ').' });
    load();
  };
  const toggleDigest = async (v) => {
    setData(d => ({ ...d, emailDigest: v }));
    await fetch('/api/prospect/studies', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailDigest: v }) });
  };
  const openPublic = (id) => { window.top.location.href = id ? `/tests-etudes/${id}` : '/tests-etudes'; };

  if (!data) return <div className="muted">Chargement…</div>;
  const newOnes = (data.notifications || []).filter(n => n.kind === 'published' && n.campaignStatus === 'published');

  return (
    <div className="col gap-6">
      <SectionTitle
        eyebrow="Tests & Études"
        title="Donnez votre avis, soyez rémunéré"
        desc="Sondages, tests de sites ou d'applis, visites en magasin. Une campagne n'est lancée que si assez de participants s'inscrivent ; vous êtes payé dans votre portefeuille une fois la tâche validée. Seuls votre prénom et un alias e-mail sont transmis au professionnel."
        action={<button className="btn btn-primary" onClick={() => openPublic(null)}>Voir toutes les campagnes <Icon name="arrow" size={14}/></button>}
      />

      {flash && (
        <div style={{ padding: 12, borderRadius: 10, background: flash.ok ? '#DCFCE7' : '#FEE2E2', color: flash.ok ? '#14532D' : '#7F1D1D', fontSize: 14 }}>{flash.text}</div>
      )}

      {newOnes.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Nouvelles campagnes près de chez vous</div>
          <div className="col gap-2">
            {newOnes.slice(0, 6).map(n => (
              <button key={n.id} className="row between" onClick={() => openPublic(n.campaign_id)}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: n.read_at ? 'transparent' : 'var(--accent-soft, #EEF2FF)', cursor: 'pointer' }}>
                <span>{n.title}</span>
                <strong>{studiesEur(n.rewardCents)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="col gap-3">
        <div className="mono caps muted" style={{ fontSize: 10 }}>— Mes participations</div>
        {(data.participations || []).length === 0 && (
          <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>Vous ne participez à aucune campagne pour le moment.</div>
        )}
        {(data.participations || []).map(p => {
          const c = p.campaign || {};
          const [label, chip] = PART_STATUS[p.status] || [p.status, ''];
          const note = notes[p.id] || '';
          return (
            <div key={p.id} className="card" style={{ padding: 20 }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div className="mono caps muted" style={{ fontSize: 10 }}>{c.typeLabel} · {c.proName}</div>
                  <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {studiesEur(c.rewardCents)} · réalisation avant le {studiesDate(c.completionDeadline)}
                  </div>
                </div>
                <span className={'chip ' + (chip ? 'chip-' + chip : '')} style={{ borderRadius: 999, padding: '3px 10px', fontSize: 11 }}>{label}</span>
              </div>

              {p.code && (
                <div className="row center gap-3" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Votre code à transmettre au professionnel :</span>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.15em' }}>{p.code}</span>
                </div>
              )}
              {c.externalUrl && (
                <a className="btn btn-sm btn-ghost" style={{ marginTop: 12 }} href={c.externalUrl} target="_blank" rel="noopener noreferrer">Ouvrir le lien du professionnel ↗</a>
              )}
              {c.address && <div style={{ marginTop: 10, fontSize: 14 }}>Adresse : {c.address}</div>}
              {p.status === 'rejected' && (
                <div style={{ marginTop: 10, fontSize: 13 }}>Motif : {REJECT_LABELS[p.reject_reason] || '—'}{p.reject_note ? ' — ' + p.reject_note : ''}</div>
              )}

              <div className="row gap-2" style={{ marginTop: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {p.status === 'joined' && (
                  <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => act(c.id, 'withdraw', {}, 'Vous vous êtes retiré de la campagne.')}>Me retirer</button>
                )}
                {p.status === 'confirmed' && (
                  <>
                    <textarea className="input" rows={2} maxLength={500} placeholder="Commentaire facultatif" value={note}
                      onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))} style={{ flex: '1 1 260px' }}/>
                    <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act(c.id, 'done', { comment: note }, 'Merci ! Le professionnel a 7 jours pour valider.')}>J'ai terminé</button>
                  </>
                )}
                {p.status === 'rejected' && (
                  <>
                    <textarea className="input" rows={2} maxLength={1000} placeholder="Expliquez pourquoi vous contestez (10 caractères min.)" value={note}
                      onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))} style={{ flex: '1 1 260px' }}/>
                    <button className="btn btn-sm btn-primary" disabled={!!busy || note.trim().length < 10} onClick={() => act(c.id, 'dispute', { note }, 'Contestation envoyée : BUUPP va trancher.')}>Contester</button>
                  </>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => openPublic(c.id)}>Voir la fiche</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <label className="row gap-3" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!data.emailDigest} onChange={e => toggleDigest(e.target.checked)} style={{ marginTop: 3 }}/>
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            <strong>Recevoir un e-mail récapitulatif</strong> des nouvelles campagnes près de chez moi (au plus 1 par jour, désabonnement en un clic).
          </span>
        </label>
      </div>
    </div>
  );
}

/* ═════════════════════════ PRO ═════════════════════════ */

const STUDY_ERRORS = {
  type_invalid: 'Choisissez un type de campagne.',
  title_invalid: 'Le titre doit faire entre 3 et 120 caractères.',
  description_invalid: 'La description doit faire entre 20 et 4000 caractères.',
  duration_invalid: 'Durée estimée invalide (1 à 600 minutes).',
  url_invalid: 'Lien invalide.',
  url_not_https: 'Le lien doit commencer par https://',
  reward_too_low: 'Rémunération minimale : 1 € par participant.',
  reward_too_high: 'Rémunération maximale : 1 000 €.',
  max_too_high: '500 participants maximum.',
  min_too_low: '5 participants minimum.',
  min_gt_max: 'Le minimum doit être inférieur ou égal au maximum.',
  scope_invalid: 'Choisissez un périmètre.',
  visit_requires_department: 'Une visite ou un rendez-vous est limité à un département.',
  department_required: 'Indiquez le département ciblé.',
  department_invalid: 'Département invalide (ex. 64, 2A, 974).',
  signup_deadline_invalid: "La fin des inscriptions doit être entre J+2 et J+60.",
  completion_deadline_invalid: "La fin de réalisation doit être au moins 3 jours (et au plus 60 jours) après la fin des inscriptions.",
  fraud_terms_required: "Vous devez accepter l'engagement anti-fraude.",
  raison_sociale_required: 'Renseignez votre raison sociale dans « Mes informations » avant de publier.',
  insufficient_funds: 'Solde disponible insuffisant.',
};

function studyCommissionCents(reward) {
  if (reward <= 0) return 0;
  return Math.max(30, Math.floor((reward * 1000 + 5000) / 10000));
}

const isoDay = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

function ProStudiesPanel() {
  const [view, setView] = React.useState({ kind: 'list' });
  if (view.kind === 'create') return <ProStudyCreate onDone={(id, notice) => setView(id ? { kind: 'detail', id, notice } : { kind: 'list' })}/>;
  if (view.kind === 'detail') return <ProStudyDetail id={view.id} notice={view.notice} onBack={() => setView({ kind: 'list' })}/>;
  return <ProStudyList onCreate={() => setView({ kind: 'create' })} onOpen={(id) => setView({ kind: 'detail', id })}/>;
}

function ProStudyList({ onCreate, onOpen }) {
  const [items, setItems] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/pro/studies', { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }).then(d => setItems(d.items || [])).catch(() => setItems([]));
  }, []);
  return (
    <div className="col gap-6">
      <SectionTitle
        eyebrow="Tests & Études"
        title="Obtenez des retours sur vos produits"
        desc="Sondage, test de votre site ou appli, visite en magasin : vous décrivez votre besoin, fixez un minimum et un maximum de participants. Tout ou rien : sans seuil atteint, rien n'est débité. Vous ne payez que les participations validées (rémunération + commission BUUPP de 10 %, min. 0,30 €)."
        action={<button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={14}/> Nouvelle campagne</button>}
      />
      {items === null ? <div className="muted">Chargement…</div> : items.length === 0 ? (
        <div className="card muted" style={{ padding: 28, textAlign: 'center' }}>Aucune campagne Tests & Études pour le moment.</div>
      ) : (
        <div className="col gap-3">
          {items.map(i => (
            <button key={i.id} className="card" onClick={() => onOpen(i.id)} style={{ padding: 20, textAlign: 'left', cursor: 'pointer' }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="mono caps muted" style={{ fontSize: 10 }}>{i.typeLabel} · {i.scope === 'national' ? 'France entière' : 'Département ' + i.department}</div>
                  <div className="serif" style={{ fontSize: 22, marginTop: 4 }}>{i.title}</div>
                </div>
                <div className="row gap-2 center">
                  {i.toReviewCount > 0 && <span className="chip chip-warn" style={{ borderRadius: 999, padding: '3px 10px', fontSize: 11 }}>{i.toReviewCount} à examiner</span>}
                  <StudyBadge badge={i.badge}/>
                </div>
              </div>
              <div style={{ marginTop: 14 }}><StudyGauge joined={i.joinedCount} min={i.min} max={i.max}/></div>
              <div className="row between muted" style={{ fontSize: 12, marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                <span>{studiesEur(i.rewardCents)} / participant · coût validé {studiesEur(i.unitCostCents)}</span>
                <span>Réservé {studiesEur(i.budgetReservedCents)} · Dépensé {studiesEur(i.spentCents)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Défini hors du formulaire : un composant recréé à chaque rendu ferait
// perdre le focus des champs à chaque frappe.
function StudyField({ label, children, hint }) {
  return (
    <label className="col gap-1" style={{ fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
    </label>
  );
}

function ProStudyCreate({ onDone }) {
  const now = Date.now();
  const [f, setF] = React.useState({
    type: 'survey', title: '', description: '', estimatedMinutes: 10, externalUrl: '', address: '',
    rewardEur: '2', minParticipants: 20, maxParticipants: 100, scope: 'national', department: '',
    signupDeadline: isoDay(now + 10 * 864e5), completionDeadline: isoDay(now + 20 * 864e5),
  });
  const [terms, setTerms] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e && e.target ? e.target.value : e }));

  const rewardCents = Math.round(Number(String(f.rewardEur).replace(',', '.')) * 100) || 0;
  const unit = rewardCents + studyCommissionCents(rewardCents);
  const budget = unit * (Number(f.maxParticipants) || 0);
  const isVisit = f.type === 'visit';

  const submit = async (publish) => {
    setBusy(true); setError(null);
    const body = {
      type: f.type, title: f.title, description: f.description, estimatedMinutes: Number(f.estimatedMinutes),
      externalUrl: f.externalUrl || null, address: f.address || null, rewardCents,
      minParticipants: Number(f.minParticipants), maxParticipants: Number(f.maxParticipants),
      scope: isVisit ? 'department' : f.scope, department: f.department || null,
      // Fin de journée (heure de Paris approx.) pour les deux échéances.
      signupDeadline: new Date(f.signupDeadline + 'T23:59:00').toISOString(),
      completionDeadline: new Date(f.completionDeadline + 'T23:59:00').toISOString(),
      fraudTermsAccepted: terms, publish,
    };
    const r = await studiesPost('/api/pro/studies', body);
    setBusy(false);
    if (r.ok) { onDone(r.data.id); return; }
    if (r.data.error === 'insufficient_funds') {
      // Le brouillon est déjà créé : on bascule sur sa fiche (un nouveau clic
      // « Publier » ici créerait un second brouillon).
      onDone(r.data.id, `Solde disponible insuffisant : il manque ${studiesEur(r.data.missingCents)}. La campagne est enregistrée en brouillon ; rechargez votre portefeuille (onglet Facturation) puis publiez-la ici.`);
      return;
    }
    setError(STUDY_ERRORS[r.data.error] || 'Erreur : ' + (r.data.error || r.status));
  };

  const L = StudyField;
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 };

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Tests & Études" title="Nouvelle campagne"
        desc="Décrivez votre besoin. La tâche se déroule chez vous (questionnaire en ligne, site, appli, magasin) : chaque participant vous transmet son code personnel BUUPP pour prouver sa participation."
        action={<button className="btn btn-ghost" onClick={() => onDone(null)}>← Retour</button>}/>

      <div className="card col gap-4" style={{ padding: 24 }}>
        <div style={grid}>
          <L label="Type">
            <select className="input" value={f.type} onChange={set('type')}>
              <option value="survey">Sondage en ligne (via votre lien)</option>
              <option value="product_test">Test et avis sur un site ou une appli</option>
              <option value="visit">Visite en magasin ou rendez-vous d'échange</option>
            </select>
          </L>
          <L label="Durée estimée (minutes)"><input className="input" type="number" min={1} max={600} value={f.estimatedMinutes} onChange={set('estimatedMinutes')}/></L>
        </div>
        <L label="Titre"><input className="input" maxLength={120} value={f.title} onChange={set('title')} placeholder="ex. Votre avis sur notre nouvelle appli de réservation"/></L>
        <L label="Description du besoin" hint="Ce que vous attendez, les étapes, où saisir le code BUUPP. N'exigez aucun paiement ni donnée personnelle.">
          <textarea className="input" rows={6} maxLength={4000} value={f.description} onChange={set('description')}/>
        </L>
        <div style={grid}>
          <L label={isVisit ? 'Lien (facultatif)' : 'Lien de votre questionnaire / site / appli'} hint="https:// — visible uniquement des participants confirmés.">
            <input className="input" value={f.externalUrl} onChange={set('externalUrl')} placeholder="https://"/>
          </L>
          {isVisit && <L label="Adresse ou modalités du rendez-vous" hint="Visible uniquement des participants confirmés."><input className="input" maxLength={300} value={f.address} onChange={set('address')}/></L>}
        </div>
      </div>

      <div className="card col gap-4" style={{ padding: 24 }}>
        <div style={grid}>
          <L label="Rémunération par participant (€)" hint="1 € minimum"><input className="input" inputMode="decimal" value={f.rewardEur} onChange={set('rewardEur')}/></L>
          <L label="Participants minimum" hint="Seuil : en dessous, la campagne est annulée sans frais"><input className="input" type="number" min={5} max={500} value={f.minParticipants} onChange={set('minParticipants')}/></L>
          <L label="Participants maximum" hint="500 maximum"><input className="input" type="number" min={5} max={500} value={f.maxParticipants} onChange={set('maxParticipants')}/></L>
        </div>
        <div style={grid}>
          <L label="Périmètre">
            <select className="input" value={isVisit ? 'department' : f.scope} disabled={isVisit} onChange={set('scope')}>
              <option value="national">France entière</option>
              <option value="department">Un département</option>
            </select>
          </L>
          {(isVisit || f.scope === 'department') && <L label="Département" hint="ex. 64, 2A, 974"><input className="input" maxLength={3} value={f.department} onChange={set('department')}/></L>}
          <L label="Fin des inscriptions" hint="Entre J+2 et J+60"><input className="input" type="date" value={f.signupDeadline} onChange={set('signupDeadline')}/></L>
          <L label="Fin de réalisation" hint="Au moins 3 jours après la fin des inscriptions"><input className="input" type="date" value={f.completionDeadline} onChange={set('completionDeadline')}/></L>
        </div>
      </div>

      <div className="card col gap-3" style={{ padding: 24 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>Coût par participation validée</span>
          <strong>{studiesEur(unit)} <span className="muted" style={{ fontWeight: 400 }}>({studiesEur(rewardCents)} + {studiesEur(unit - rewardCents)} de commission)</span></strong>
        </div>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>Budget maximum réservé à la publication</span>
          <strong className="serif" style={{ fontSize: 24 }}>{studiesEur(budget)}</strong>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Ce montant est bloqué sur votre portefeuille, pas débité. Seules les participations validées sont débitées ; le reste est libéré à la clôture. Si le seuil n'est pas atteint, tout est libéré, sans frais.
        </p>
        <div style={{ padding: 14, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 13, lineHeight: 1.55 }}>
          <label className="row gap-3" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginTop: 3 }}/>
            <span>
              <strong>Engagement anti-fraude.</strong> Je certifie que cette campagne n'est ni frauduleuse ni trompeuse, qu'elle ne demande aux participants
              aucun paiement ni donnée personnelle au-delà de ce qu'exige la tâche, et qu'elle ne porte pas sur un produit de santé, cosmétique,
              complément alimentaire ou un test avec livraison de produit. Toute infraction entraîne la suspension de la campagne et la fermeture
              du compte (CGV). Si je publie les retours obtenus, je reprends la mention « Participation rémunérée via BUUPP ».
            </span>
          </label>
        </div>
        {error && <div style={{ padding: 12, borderRadius: 10, background: '#FEE2E2', color: '#7F1D1D', fontSize: 14 }}>{error}</div>}
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy || !terms} onClick={() => submit(true)}>Publier la campagne</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => submit(false)}>Enregistrer en brouillon</button>
        </div>
      </div>
    </div>
  );
}

function ProStudyDetail({ id, onBack, notice }) {
  const [d, setD] = React.useState(null);
  const [sel, setSel] = React.useState({});
  const [reason, setReason] = React.useState('code_missing');
  const [note, setNote] = React.useState('');
  const [msg, setMsg] = React.useState(notice ? { ok: false, text: notice } : null);
  const [busy, setBusy] = React.useState(false);
  const [terms, setTerms] = React.useState(false);

  const load = React.useCallback(() =>
    fetch(`/api/pro/studies/${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}), [id]);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 30000); // jauge « temps réel »
    return () => clearInterval(t);
  }, [load]);

  if (!d) return <div className="muted">Chargement…</div>;
  const s = d.study;
  const ids = Object.keys(sel).filter(k => sel[k]);

  const run = async (body, okText) => {
    setBusy(true); setMsg(null);
    const r = await studiesPost(`/api/pro/studies/${id}/participations`, { ids, ...body });
    setBusy(false);
    const skipped = (r.data.skipped || []).length;
    setMsg(r.ok ? { ok: true, text: okText + (skipped ? ` (${skipped} ignorée${skipped > 1 ? 's' : ''} : statut non éligible)` : '') } : { ok: false, text: 'Erreur : ' + (r.data.error || r.status) });
    setSel({}); load();
  };
  const campaignAction = async (action) => {
    const wasDraft = d && d.study && d.study.status === 'draft';
    setBusy(true); setMsg(null);
    const r = await studiesPost(`/api/pro/studies/${id}`, { action, fraudTermsAccepted: terms });
    setBusy(false);
    if (r.ok) setMsg({ ok: true, text: action === 'publish' ? 'Campagne publiée.' : wasDraft ? 'Brouillon supprimé.' : 'Campagne annulée, budget libéré.' });
    else if (r.data.error === 'insufficient_funds') setMsg({ ok: false, text: `Solde disponible insuffisant : il manque ${studiesEur(r.data.missingCents)}.` });
    else setMsg({ ok: false, text: STUDY_ERRORS[r.data.error] || 'Erreur : ' + (r.data.error || r.status) });
    load();
  };

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow={s.typeLabel} title={s.title}
        desc={`${s.scope === 'national' ? 'France entière' : 'Département ' + s.department} · inscriptions jusqu'au ${studiesDate(s.signupDeadline)} · réalisation jusqu'au ${studiesDate(s.completionDeadline)}`}
        action={<button className="btn btn-ghost" onClick={onBack}>← Mes campagnes</button>}/>

      {msg && <div style={{ padding: 12, borderRadius: 10, background: msg.ok ? '#DCFCE7' : '#FEE2E2', color: msg.ok ? '#14532D' : '#7F1D1D', fontSize: 14 }}>{msg.text}</div>}

      <div className="card col gap-4" style={{ padding: 24 }}>
        <div className="row between"><StudyBadge badge={s.badge}/><span className="muted" style={{ fontSize: 13 }}>{Math.max(0, s.max - s.joinedCount)} place(s) restante(s)</span></div>
        <StudyGauge joined={s.joinedCount} min={s.min} max={s.max}/>
        <div className="row between muted" style={{ fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
          <span>{studiesEur(s.rewardCents)} / participant · coût validé {studiesEur(s.unitCostCents)}</span>
          <span>Réservé {studiesEur(s.budgetReservedCents)} · Débité {studiesEur(s.spentCents)}</span>
        </div>
        {s.status === 'draft' && (
          <div className="col gap-2">
            <label className="row gap-2" style={{ fontSize: 13, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginTop: 3 }}/>
              <span>J'accepte l'engagement anti-fraude (campagne ni frauduleuse ni trompeuse, aucun paiement ni donnée personnelle exigés, aucun produit interdit).</span>
            </label>
            <div className="row gap-2">
              <button className="btn btn-primary" disabled={busy || !terms} onClick={() => campaignAction('publish')}>Publier ({studiesEur(s.unitCostCents * s.max)} réservés)</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => campaignAction('cancel')}>Supprimer le brouillon</button>
            </div>
          </div>
        )}
        {s.status === 'published' && (
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => campaignAction('cancel')}>Annuler la campagne (sans frais)</button>
        )}
        {s.status === 'canceled' && <div className="muted" style={{ fontSize: 13 }}>Campagne annulée{s.cancelReason === 'threshold_not_met' ? ' : seuil non atteint' : ''}. Aucun débit hors participations déjà validées.</div>}
      </div>

      {d.participants.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="mono caps muted" style={{ fontSize: 10 }}>— Participants ({d.participants.length})</div>
            <span className="muted" style={{ fontSize: 12 }}>Sans réponse 7 jours après « terminé », la participation est validée automatiquement.</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-4)' }}>
                  <th style={{ padding: 8 }}></th><th style={{ padding: 8 }}>Prénom</th><th style={{ padding: 8 }}>Alias e-mail</th>
                  <th style={{ padding: 8 }}>Code</th><th style={{ padding: 8 }}>Statut</th><th style={{ padding: 8 }}>Commentaire</th><th style={{ padding: 8 }}>Revue avant</th>
                </tr>
              </thead>
              <tbody>
                {d.participants.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: 8 }}>
                      <input type="checkbox" checked={!!sel[p.id]} disabled={['approved', 'rejected_final', 'disputed', 'rejected'].includes(p.status)}
                        onChange={e => setSel(x => ({ ...x, [p.id]: e.target.checked }))}/>
                    </td>
                    <td style={{ padding: 8 }}>{p.prenom || '—'}</td>
                    <td style={{ padding: 8 }} className="mono">
                      {p.alias ? <button className="btn btn-sm btn-ghost" onClick={() => navigator.clipboard && navigator.clipboard.writeText(p.alias)} title="Copier">{p.alias}</button> : '—'}
                    </td>
                    <td style={{ padding: 8 }} className="mono"><strong>{p.code || '—'}</strong></td>
                    <td style={{ padding: 8 }}>{(PART_STATUS[p.status] || [p.status])[0]}</td>
                    <td style={{ padding: 8, maxWidth: 240 }}>{p.doneComment || ''}</td>
                    <td style={{ padding: 8 }}>{p.reviewDueAt ? studiesDate(p.reviewDueAt) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row gap-2" style={{ marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>{ids.length} sélectionnée(s)</span>
            <button className="btn btn-sm btn-primary" disabled={busy || !ids.length} onClick={() => run({ action: 'approve' }, 'Participation(s) validée(s) et payée(s).')}>Valider</button>
            <select className="input" style={{ width: 'auto' }} value={reason} onChange={e => setReason(e.target.value)}>
              {Object.entries(REJECT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {reason === 'other' && <input className="input" style={{ width: 220 }} maxLength={300} placeholder="Précisez" value={note} onChange={e => setNote(e.target.value)}/>}
            <button className="btn btn-sm btn-ghost" disabled={busy || !ids.length} onClick={() => run({ action: 'reject', reason, note }, 'Participation(s) refusée(s).')}>Refuser</button>
          </div>
        </div>
      )}
    </div>
  );
}
