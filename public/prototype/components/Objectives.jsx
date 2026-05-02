// Dedicated objective pages + Recharge credit modal
var { useState } = React;

function Modal({ title, subtitle, onClose, children, width = 560 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14, 14, 18, 0.55)',
      backdropFilter: 'blur(6px)', zIndex: 9998,
      overflowY: 'auto',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 24px 110px',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 28, background: 'var(--paper)',
        margin: 'auto 0',
      }}>
        <div className="row between" style={{ marginBottom: 20, alignItems: 'flex-start' }}>
          <div>
            <div className="serif" style={{ fontSize: 26, letterSpacing: '-0.01em' }}>{title}</div>
            {subtitle && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--line-2)', background: 'var(--paper)', cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ObjectivePage({ kind, onBack, onContinue }) {
  const cfg = {
    contact: {
      eyebrow: 'Prise de contact',
      title: 'Ouvrez la conversation.',
      desc: "Envoyez un message personnalisé aux prospects qui acceptent. Email ou téléphone, au choix du prospect.",
      icon: 'email',
      tone: 'var(--accent)',
    },
    rdv: {
      eyebrow: 'Prise de rendez-vous',
      title: 'Remplissez votre agenda.',
      desc: "Le prospect réserve directement un créneau libre dans votre planning. Synchronisé avec Google, Outlook ou Cal.com.",
      icon: 'calendar',
      tone: 'var(--accent)',
    },
    evt: {
      eyebrow: 'Inscription événement',
      title: "Attirez la bonne audience.",
      desc: "Portes ouvertes, webinaire, démonstration, salon : chaque inscription est confirmée et rappelée automatiquement.",
      icon: 'flag',
      tone: 'var(--accent)',
    },
    dl: {
      eyebrow: 'Téléchargement',
      title: 'Diffusez votre ressource.',
      desc: "Livre blanc, étude, fiche produit : le téléchargement se fait après double consentement, l'email est qualifié.",
      icon: 'download',
      tone: 'var(--accent)',
    },
    survey: {
      eyebrow: 'Enquête de satisfaction',
      title: 'Mesurez ce que vos clients pensent vraiment.',
      desc: "Interrogez votre base existante ou un panel ciblé. NPS, CSAT, CES ou questionnaire sur mesure. Résultats agrégés en temps réel.",
      icon: 'check',
      tone: 'var(--accent)',
    },
    poll: {
      eyebrow: "Sondage d'opinion",
      title: "Testez une idée avant de la lancer.",
      desc: "Positionnement, pricing, concept produit : obtenez l'avis de 200 à 2 000 répondants qualifiés en moins de 48 heures.",
      icon: 'chart',
      tone: 'var(--accent)',
    },
  }[kind];

  return (
    <div className="col gap-6">
      <button onClick={onBack} className="row center gap-2" style={{ color: 'var(--ink-4)', fontSize: 13, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={14}/> Retour aux objectifs
      </button>

      <div className="card" style={{ padding: 40, background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
        <div className="row gap-6" style={{ alignItems: 'flex-start' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A5B4FC', flexShrink: 0 }}>
            <Icon name={cfg.icon} size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="mono caps" style={{ color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>— {cfg.eyebrow}</div>
            <h3 className="serif" style={{ fontSize: 40, color: 'var(--paper)', lineHeight: 1.05 }}>{cfg.title}</h3>
            <p style={{ maxWidth: 620, color: 'rgba(255,255,255,.7)', marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>{cfg.desc}</p>
          </div>
        </div>
      </div>

      {kind === 'contact' && <ContactFields/>}
      {kind === 'rdv' && <RdvFields/>}
      {kind === 'evt' && <EventFields/>}
      {kind === 'dl' && <DownloadFields/>}
      {kind === 'survey' && <SurveyFields kind="survey"/>}
      {kind === 'poll' && <SurveyFields kind="poll"/>}

      <div className="row between">
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrowLeft" size={14}/> Changer d'objectif
        </button>
        <button className="btn btn-primary" onClick={() => onContinue(kind)}>
          Continuer vers le panier de données <Icon name="arrow" size={14}/>
        </button>
      </div>
    </div>
  );
}

/* ---------- Prise de contact ---------- */
function ContactFields() {
  const [channel, setChannel] = useState(new Set(['email']));
  const [name, setName] = useState('Atelier Mercier — Devis aménagement');
  const [subject, setSubject] = useState("Bonjour {{prenom}}, un aménagement sur mesure ?");
  const [message, setMessage] = useState("Bonjour {{prenom}},\n\nJ'ai vu que vous habitez {{ville}}. L'Atelier Mercier réalise des cuisines et dressings sur mesure dans votre secteur.\n\nSouhaiteriez-vous un devis gratuit, sans engagement ?\n\nBien cordialement,\nLouis Mercier");
  const [delay, setDelay] = useState(24);

  const toggle = (k) => {
    const n = new Set(channel);
    n.has(k) ? n.delete(k) : n.add(k);
    setChannel(n);
  };

  return (
    <>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Configuration du premier message</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Ce message sera envoyé automatiquement dès qu'un prospect accepte votre demande.</div>

        <div className="label">Nom interne de la campagne</div>
        <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 20 }}/>

        <div className="label">Canaux autorisés</div>
        <div className="row gap-2" style={{ marginBottom: 20 }}>
          {[['email', 'Email', 'email'], ['sms', 'SMS', 'phone'], ['call', 'Appel téléphonique', 'phone']].map(([k, l, ic]) => (
            <button key={k} onClick={() => toggle(k)} style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
              border: '1px solid ' + (channel.has(k) ? 'var(--accent)' : 'var(--line-2)'),
              background: channel.has(k) ? 'color-mix(in oklab, var(--accent) 6%, var(--paper))' : 'var(--paper)',
              color: channel.has(k) ? 'var(--accent-ink)' : 'var(--ink-3)'
            }}>
              <Icon name={ic} size={14}/>
              {channel.has(k) && <span>✓</span>} {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <div className="label">Objet de l'email</div>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)}/>
          </div>
          <div>
            <div className="label">Délai d'envoi après acceptation</div>
            <div className="row gap-2">
              {[[0, 'Immédiat'], [1, '1 h'], [24, '24 h'], [72, '72 h']].map(([v, l]) => (
                <button key={v} onClick={() => setDelay(v)} className="chip" style={{ cursor: 'pointer', padding: '8px 14px',
                  background: delay === v ? 'var(--ink)' : 'var(--paper)', color: delay === v ? 'var(--paper)' : 'var(--ink-3)' }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="label">Message</div>
        <textarea className="input" rows={8} value={message} onChange={e => setMessage(e.target.value)} style={{ fontFamily: 'var(--sans)', resize: 'vertical' }}/>
        <div className="row between" style={{ marginTop: 8 }}>
          <div className="row gap-2">
            {['{{prenom}}', '{{ville}}', '{{age}}', '{{profession}}'].map(v => (
              <span key={v} className="chip mono" style={{ cursor: 'pointer', fontSize: 11 }}>{v}</span>
            ))}
          </div>
          <span className="mono muted" style={{ fontSize: 11 }}>{message.length} / 1200 caractères</span>
        </div>
      </div>

      <div className="card" style={{ padding: 24, background: 'var(--ivory-2)' }}>
        <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Aperçu de l'email</div>
        <div className="card" style={{ padding: 20, background: 'var(--paper)' }}>
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13 }}><span className="muted">De :</span> Atelier Mercier &lt;louis@atelier-mercier.fr&gt;</div>
            <div style={{ fontSize: 13 }}><span className="muted">À :</span> marie.l•••@gmail.com</div>
            <div className="serif" style={{ fontSize: 18, marginTop: 6 }}>{subject.replace('{{prenom}}', 'Marie')}</div>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {message.replace(/{{prenom}}/g, 'Marie').replace(/{{ville}}/g, 'Lyon 3e').replace(/{{age}}/g, '34 ans').replace(/{{profession}}/g, 'architecte')}
          </div>
          <div style={{ marginTop: 18, padding: 10, background: 'var(--ivory-2)', borderRadius: 6, fontSize: 11, color: 'var(--ink-4)' }}>
            <Icon name="shield" size={11}/> <span style={{ marginLeft: 6 }}>Envoyé via BUPP — double consentement vérifié · watermarking actif.</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Prise de rendez-vous ---------- */
function RdvFields() {
  const [duration, setDuration] = useState(30);
  const [provider, setProvider] = useState('google');
  const [buffer, setBuffer] = useState(15);
  const [selected, setSelected] = useState(new Set(['Mar 09:00', 'Mar 14:00', 'Jeu 11:00']));

  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const hours = ['09:00','10:00','11:00','14:00','15:00','16:00','17:00'];

  const toggle = (k) => {
    const n = new Set(selected);
    n.has(k) ? n.delete(k) : n.add(k);
    setSelected(n);
  };

  return (
    <>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Paramètres du rendez-vous</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Le prospect choisit lui-même un créneau parmi ceux que vous laissez ouverts.</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <div className="label">Durée d'un rendez-vous</div>
            <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
              {[15, 30, 45, 60].map(v => (
                <button key={v} onClick={() => setDuration(v)} className="chip" style={{ cursor:'pointer', padding:'8px 12px',
                  background: duration===v?'var(--ink)':'var(--paper)', color: duration===v?'var(--paper)':'var(--ink-3)' }}>
                  {v} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Battement entre 2 RDV</div>
            <div className="row gap-2">
              {[0, 5, 15, 30].map(v => (
                <button key={v} onClick={() => setBuffer(v)} className="chip" style={{ cursor:'pointer', padding:'8px 12px',
                  background: buffer===v?'var(--ink)':'var(--paper)', color: buffer===v?'var(--paper)':'var(--ink-3)' }}>
                  {v} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Lieu du rendez-vous</div>
            <select className="input" defaultValue="visio">
              <option value="visio">Visioconférence Google Meet</option>
              <option value="cab">Au cabinet — 12 rue Lafayette, Lyon 3</option>
              <option value="chez">Chez le prospect</option>
              <option value="tel">Appel téléphonique</option>
            </select>
          </div>
        </div>

        <div className="label" style={{ marginTop: 24 }}>Calendrier synchronisé</div>
        <div className="row gap-2">
          {[['google', 'Google Calendar'], ['outlook', 'Outlook 365'], ['cal', 'Cal.com'], ['apple', 'Apple']].map(([k, l]) => (
            <button key={k} onClick={() => setProvider(k)} className="chip" style={{ cursor:'pointer', padding:'8px 14px',
              background: provider===k?'var(--ink)':'var(--paper)', color: provider===k?'var(--paper)':'var(--ink-3)' }}>
              {provider === k && <span>✓ </span>}{l}
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          ● Synchronisation active — 4 créneaux déjà occupés cette semaine ignorés automatiquement.
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between center" style={{ marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 20 }}>Créneaux récurrents ouverts aux prospects</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{selected.size} créneaux sélectionnés</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)', gap: 6 }}>
          <div/>
          {days.map(d => <div key={d} className="mono caps muted" style={{ fontSize: 10, textAlign: 'center' }}>{d}</div>)}
          {hours.map(h => (
            <React.Fragment key={h}>
              <div className="mono muted" style={{ fontSize: 11 }}>{h}</div>
              {days.map(d => {
                const k = `${d} ${h}`;
                const on = selected.has(k);
                return (
                  <button key={k} onClick={() => toggle(k)} style={{
                    height: 30, borderRadius: 4, fontSize: 11,
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                    background: on ? 'color-mix(in oklab, var(--accent) 14%, var(--paper))' : 'var(--paper)',
                    color: on ? 'var(--accent-ink)' : 'var(--ink-4)',
                    cursor: 'pointer'
                  }}>{on ? '✓' : '+'}</button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 24, background: 'var(--ivory-2)' }}>
        <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Aperçu côté prospect</div>
        <div className="card" style={{ padding: 24, background: 'var(--paper)' }}>
          <div className="serif" style={{ fontSize: 20, marginBottom: 4 }}>Réservez votre RDV avec Atelier Mercier</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Durée : {duration} min · Visioconférence Google Meet</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {['Mar 09:00','Mar 10:00','Mar 14:00','Mer 11:00','Jeu 09:00','Jeu 11:00','Ven 15:00','Ven 16:00'].map((s, i) => (
              <div key={i} className="chip" style={{ justifyContent: 'center', padding: '8px 6px', fontSize: 12, background: i === 2 ? 'var(--accent)' : 'var(--paper)', color: i === 2 ? 'white' : 'var(--ink-3)', borderColor: i === 2 ? 'var(--accent)' : 'var(--line-2)' }}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Événement ---------- */
function EventFields() {
  const [name, setName] = useState('Portes ouvertes printemps — Atelier Mercier');
  const [date, setDate] = useState('2026-05-17');
  const [hStart, setHStart] = useState('10:00');
  const [hEnd, setHEnd] = useState('18:00');
  const [capacity, setCapacity] = useState(80);
  const [format, setFormat] = useState('physical');
  const [desc, setDesc] = useState("Journée portes ouvertes dans notre atelier de menuiserie. Démonstrations, café, découverte des essences de bois, devis express offerts aux visiteurs.");

  return (
    <>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Informations de l'événement</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Chaque inscription est confirmée par email et un rappel est envoyé 24 h avant.</div>

        <div className="label">Nom de l'événement</div>
        <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 20 }}/>

        <div className="label">Format</div>
        <div className="row gap-2" style={{ marginBottom: 20 }}>
          {[['physical', 'Physique', 'mapPin'], ['online', 'En ligne', 'globe'], ['hybrid', 'Hybride', 'sparkle']].map(([k, l, ic]) => (
            <button key={k} onClick={() => setFormat(k)} style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8,
              border: '1px solid ' + (format === k ? 'var(--ink)' : 'var(--line-2)'),
              background: format === k ? 'var(--ivory-2)' : 'var(--paper)',
            }}>
              <Icon name={ic} size={14}/> {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <div className="label">Date</div>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)}/>
          </div>
          <div>
            <div className="label">Début</div>
            <input className="input" type="time" value={hStart} onChange={e => setHStart(e.target.value)}/>
          </div>
          <div>
            <div className="label">Fin</div>
            <input className="input" type="time" value={hEnd} onChange={e => setHEnd(e.target.value)}/>
          </div>
          <div>
            <div className="label">Jauge</div>
            <input className="input mono tnum" type="number" value={capacity} onChange={e => setCapacity(+e.target.value)}/>
          </div>
        </div>

        {format !== 'online' && (
          <>
            <div className="label">Adresse</div>
            <input className="input" defaultValue="12 rue Lafayette, 69003 Lyon" style={{ marginBottom: 20 }}/>
          </>
        )}

        <div className="label">Description</div>
        <textarea className="input" rows={4} value={desc} onChange={e => setDesc(e.target.value)} style={{ fontFamily: 'var(--sans)', resize: 'vertical' }}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 24, background: 'var(--ivory-2)' }}>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Aperçu de l'invitation</div>
          <div className="card" style={{ padding: 0, background: 'var(--paper)', overflow: 'hidden' }}>
            <div style={{ height: 140, background: 'linear-gradient(135deg, var(--ink) 0%, var(--accent) 100%)', color: 'var(--paper)', padding: 20, display: 'flex', alignItems: 'flex-end' }}>
              <div className="mono caps" style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', letterSpacing: '.14em' }}>ÉVÉNEMENT BUPP</div>
            </div>
            <div style={{ padding: 20 }}>
              <div className="serif" style={{ fontSize: 22 }}>{name}</div>
              <div className="row gap-4 muted" style={{ fontSize: 13, marginTop: 12 }}>
                <span><Icon name="calendar" size={12}/> 17 mai 2026</span>
                <span><Icon name="bolt" size={12}/> {hStart} – {hEnd}</span>
                <span><Icon name="users" size={12}/> {capacity} places</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.6 }}>{desc}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                Je m'inscris <Icon name="arrow" size={12}/>
              </button>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="serif" style={{ fontSize: 20, marginBottom: 14 }}>Rappels automatiques</div>
          {[
            ['Confirmation immédiate', 'Email + ajout au calendrier'],
            ['J − 7', 'Email de pré-rappel'],
            ['J − 1', 'SMS + email avec itinéraire'],
            ['H + 24', "Mail de remerciement et invitation à l'évaluation"],
          ].map((r, i) => (
            <div key={i} className="row between" style={{ padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r[0]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{r[1]}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Téléchargement ---------- */
function DownloadFields() {
  const [title, setTitle] = useState("Les 7 erreurs d'aménagement à éviter");
  const [fileName, setFileName] = useState('guide-amenagement-2026.pdf');
  const [requireVerif, setRequireVerif] = useState(true);
  const [pages, setPages] = useState(24);

  return (
    <>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>La ressource à diffuser</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Le prospect obtient le fichier dès que le double consentement est validé.</div>

        <div className="label">Titre de la ressource</div>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 20 }}/>

        <div className="label">Type</div>
        <div className="row gap-2" style={{ marginBottom: 20 }}>
          {['Livre blanc', 'Étude de cas', 'Fiche produit', 'Checklist', 'Template'].map((t, i) => (
            <button key={t} className="chip" style={{ cursor: 'pointer', padding: '8px 14px',
              background: i === 0 ? 'var(--ink)' : 'var(--paper)', color: i === 0 ? 'var(--paper)' : 'var(--ink-3)' }}>{t}</button>
          ))}
        </div>

        <div className="label">Fichier</div>
        <label style={{
          display: 'block', padding: 24, border: '2px dashed var(--line-2)', borderRadius: 12,
          textAlign: 'center', cursor: 'pointer', background: 'var(--paper)', marginBottom: 20
        }}>
          <div style={{ color: 'var(--ink-4)', marginBottom: 8 }}><Icon name="download" size={22}/></div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{fileName}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>PDF · {pages} pages · 3,8 Mo · téléversé le 14 avril</div>
          <div className="row center gap-2" style={{ justifyContent: 'center', marginTop: 12 }}>
            <span className="btn btn-ghost btn-sm"><Icon name="refresh" size={12}/> Remplacer</span>
            <span className="btn btn-ghost btn-sm"><Icon name="eye" size={12}/> Aperçu</span>
          </div>
        </label>

        <label className="row between center" style={{ padding: 14, borderRadius: 10, background: 'var(--ivory-2)', cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Exiger un email vérifié</div>
            <div className="muted" style={{ fontSize: 12 }}>Lien de téléchargement envoyé après clic sur l'email de validation.</div>
          </div>
          <input type="checkbox" checked={requireVerif} onChange={e => setRequireVerif(e.target.checked)}/>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 24, background: 'var(--ivory-2)' }}>
          <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Aperçu de la landing de téléchargement</div>
          <div className="card" style={{ padding: 24, background: 'var(--paper)' }}>
            <div className="row gap-4">
              <div style={{ width: 80, height: 110, background: 'linear-gradient(135deg, var(--ink), var(--accent))', borderRadius: 4, display: 'flex', alignItems: 'flex-end', padding: 8 }}>
                <span className="mono" style={{ color: 'var(--paper)', fontSize: 9, letterSpacing: '.1em' }}>PDF</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>Livre blanc</div>
                <div className="serif" style={{ fontSize: 20, marginTop: 4, lineHeight: 1.2 }}>{title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{pages} pages · 10 min de lecture</div>
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--ivory-2)', borderRadius: 6, fontSize: 12 }}>
              <Icon name="shield" size={11}/> <span style={{ marginLeft: 6 }}>Téléchargement après double consentement BUPP · sans spam.</span>
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
              Télécharger le PDF <Icon name="download" size={12}/>
            </button>
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <div className="serif" style={{ fontSize: 20, marginBottom: 14 }}>Suivi post-téléchargement</div>
          {[
            ['À la complétion', "Page de remerciement + upsell"],
            ['J + 2', 'Email : « Avez-vous pu lire ? »'],
            ['J + 7', "Proposition d'un appel de 15 min"],
            ['J + 21', "Enquête de satisfaction"],
          ].map((r, i) => (
            <div key={i} className="row between" style={{ padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r[0]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{r[1]}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Recharge crédit ---------- */
function RechargeModal({ onClose }) {
  const [amount, setAmount] = useState(500);
  const [custom, setCustom] = useState(false);
  const [method, setMethod] = useState('card');
  const [auto, setAuto] = useState(true);
  const [done, setDone] = useState(false);

  const bonus = amount >= 2000 ? 0.08 : amount >= 1000 ? 0.05 : amount >= 500 ? 0.03 : 0;
  const credit = amount * (1 + bonus);
  const tva = amount * 0.20;

  if (done) {
    return (
      <Modal title="Recharge effectuée" subtitle={'+' + credit.toFixed(2).replace('.', ',') + ' € crédités sur votre compte'} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 16 }}>
            <Icon name="check" size={22} stroke={2}/>
          </div>
          <div className="serif" style={{ fontSize: 26, marginBottom: 6 }}>Nouveau solde : {(847 + credit).toFixed(2).replace('.', ',')} €</div>
          <div className="muted" style={{ fontSize: 13 }}>Facture BUPP-2026-04-0184 disponible immédiatement.</div>
          <div className="row gap-2" style={{ justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Télécharger la facture</button>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Recharger le crédit" subtitle={"Solde actuel : 847 € · Atelier Mercier SARL · TVA intracom. FR 42 852 147 012"} onClose={onClose}>
      <div>
        <div className="label">Montant à créditer</div>
        <div className="recharge-amounts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          {[200, 500, 1000, 2000].map(v => {
            const b = v >= 2000 ? 8 : v >= 1000 ? 5 : v >= 500 ? 3 : 0;
            return (
              <button key={v} onClick={() => { setAmount(v); setCustom(false); }} style={{
                padding: 14, borderRadius: 10, textAlign: 'left',
                border: '1px solid ' + (amount === v && !custom ? 'var(--ink)' : 'var(--line-2)'),
                background: amount === v && !custom ? 'var(--ivory-2)' : 'var(--paper)'
              }}>
                <div className="serif tnum recharge-amount-value" style={{ fontSize: 22 }}>{v} €</div>
                {b > 0 && <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>+{b}% bonus</div>}
              </button>
            );
          })}
        </div>
        <label className="row center gap-2" style={{ padding: 12, border: '1px solid ' + (custom ? 'var(--ink)' : 'var(--line-2)'), borderRadius: 10, cursor: 'pointer', background: custom ? 'var(--ivory-2)' : 'var(--paper)' }}>
          <input type="radio" checked={custom} onChange={() => setCustom(true)}/>
          <span style={{ fontSize: 13 }}>Montant libre</span>
          <input type="number" min="50" max="10000" value={custom ? amount : ''} placeholder="50 – 10 000" onFocus={() => setCustom(true)} onChange={e => setAmount(+e.target.value || 0)} className="input mono tnum" style={{ flex: 1, padding: '6px 10px', fontSize: 14 }}/>
          <span style={{ fontSize: 13 }}>€</span>
        </label>

        <div className="label" style={{ marginTop: 20 }}>Moyen de paiement</div>
        <div className="col gap-2">
          {[
            ['card', 'Carte Visa •••• 4521', 'Atelier Mercier SARL · exp. 08/28', 'Immédiat'],
            ['sepa', 'Prélèvement SEPA', 'IBAN FR76 •••• 0012 · BNP Paribas', '2 jours ouvrés'],
            ['virement', 'Virement bancaire', 'IBAN de BUPP fourni à la validation', '1 à 3 jours'],
          ].map(([k, n, d, tag]) => (
            <label key={k} className="row center gap-3 recharge-method-row" style={{
              padding: 12, border: '1px solid ' + (method === k ? 'var(--ink)' : 'var(--line-2)'),
              borderRadius: 10, cursor: 'pointer', background: method === k ? 'var(--ivory-2)' : 'var(--paper)'
            }}>
              <input type="radio" checked={method === k} onChange={() => setMethod(k)}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{n}</div>
                <div className="muted" style={{ fontSize: 12 }}>{d}</div>
              </div>
              <span className="chip">{tag}</span>
            </label>
          ))}
        </div>

        <label className="row center between" style={{ padding: 14, borderRadius: 10, background: 'var(--ivory-2)', marginTop: 16, cursor: 'pointer' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Recharge automatique</div>
            <div className="muted" style={{ fontSize: 12 }}>Dès que le solde passe sous 100 €, recréditer {amount} € automatiquement.</div>
          </div>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)}/>
        </label>

        <div style={{ marginTop: 20, padding: 16, background: 'var(--ink)', color: 'var(--paper)', borderRadius: 10 }}>
          <div className="row between" style={{ padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,.6)' }}>Montant</span>
            <span className="mono tnum">{amount.toFixed(2).replace('.', ',')} €</span>
          </div>
          {bonus > 0 && (
            <div className="row between" style={{ padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: '#A5B4FC' }}>Bonus {Math.round(bonus * 100)}%</span>
              <span className="mono tnum" style={{ color: '#A5B4FC' }}>+{(amount * bonus).toFixed(2).replace('.', ',')} €</span>
            </div>
          )}
          <div className="row between" style={{ padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,.6)' }}>TVA 20%</span>
            <span className="mono tnum" style={{ color: 'rgba(255,255,255,.6)' }}>{tva.toFixed(2).replace('.', ',')} €</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', marginTop: 8, paddingTop: 10 }} className="row between recharge-summary-totals">
            <div>
              <div className="mono caps recharge-summary-label" style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>Crédit disponible</div>
              <div className="serif tnum recharge-summary-amount" style={{ fontSize: 28 }}>{credit.toFixed(2).replace('.', ',')} €</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono caps recharge-summary-label" style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>À payer TTC</div>
              <div className="serif tnum recharge-summary-amount" style={{ fontSize: 28 }}>{(amount + tva).toFixed(2).replace('.', ',')} €</div>
            </div>
          </div>
        </div>

        <div className="row between center recharge-footer" style={{ marginTop: 20 }}>
          <div className="muted recharge-footer-note" style={{ fontSize: 11, maxWidth: 280 }}>
            Paiement sécurisé via Stripe · facture émise sous 5 min · aucune donnée carte stockée par BUPP.
          </div>
          <div className="row gap-2 recharge-footer-actions">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={() => setDone(true)}>
              Payer {(amount + tva).toFixed(2).replace('.', ',')} € <Icon name="arrow" size={12}/>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Enquête / Sondage ---------- */
function SurveyFields({ kind }) {
  const [name, setName] = useState(kind === 'survey' ? 'Satisfaction clients Q2 2026' : "Sondage — nouveau nom de gamme");
  const [type, setType] = useState(kind === 'survey' ? 'nps' : 'concept');
  const [panel, setPanel] = useState(500);
  const [deadline, setDeadline] = useState(14);
  const [questions, setQuestions] = useState(
    kind === 'survey'
      ? [
          { t: 'Sur une échelle de 0 à 10, recommanderiez-vous notre service ?', k: 'nps' },
          { t: 'Quelle est la principale raison de cette note ?', k: 'text' },
          { t: 'Quel aspect devrions-nous améliorer en priorité ?', k: 'single' },
        ]
      : [
          { t: 'Parmi ces trois noms, lequel évoque le mieux un produit haut de gamme ?', k: 'single' },
          { t: 'Combien seriez-vous prêt à payer pour ce produit ?', k: 'single' },
          { t: "Une remarque libre sur votre première impression ?", k: 'text' },
        ]
  );

  const types = kind === 'survey'
    ? [['nps', 'NPS (recommandation)'], ['csat', 'CSAT (satisfaction)'], ['ces', 'CES (effort)'], ['custom', 'Sur mesure']]
    : [['concept', 'Test de concept'], ['pricing', 'Test de prix'], ['naming', 'Test de nom'], ['custom', 'Sur mesure']];

  return (
    <>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>{kind === 'survey' ? "Cadre de l'enquête" : 'Cadre du sondage'}</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {kind === 'survey'
            ? "Les réponses sont agrégées et anonymisées. Les verbatims ne sont pas rattachés à l'identité."
            : "Résultats en temps réel, export CSV et présentation PDF à la clôture."}
        </div>

        <div className="label">Nom interne</div>
        <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 20 }}/>

        <div className="label">Méthodologie</div>
        <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 20 }}>
          {types.map(([k, l]) => (
            <button key={k} onClick={() => setType(k)} className="chip" style={{ cursor: 'pointer', padding: '8px 14px',
              background: type === k ? 'var(--ink)' : 'var(--paper)', color: type === k ? 'var(--paper)' : 'var(--ink-3)' }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div className="label">Taille du panel</div>
            <div className="row gap-2">
              {[200, 500, 1000, 2000].map(v => (
                <button key={v} onClick={() => setPanel(v)} className="chip" style={{ cursor: 'pointer', padding: '8px 12px',
                  background: panel === v ? 'var(--ink)' : 'var(--paper)', color: panel === v ? 'var(--paper)' : 'var(--ink-3)' }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Délai de collecte</div>
            <div className="row gap-2">
              {[7, 14, 30].map(v => (
                <button key={v} onClick={() => setDeadline(v)} className="chip" style={{ cursor: 'pointer', padding: '8px 12px',
                  background: deadline === v ? 'var(--ink)' : 'var(--paper)', color: deadline === v ? 'var(--paper)' : 'var(--ink-3)' }}>{v} j</button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Rémunération par réponse</div>
            <div className="input mono tnum" style={{ display: 'flex', alignItems: 'center' }}>1,40 €</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between center" style={{ marginBottom: 16 }}>
          <div className="serif" style={{ fontSize: 22 }}>Questions</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setQuestions([...questions, { t: 'Nouvelle question', k: 'single' }])}>
            <Icon name="plus" size={12}/> Ajouter
          </button>
        </div>
        <div className="col gap-2">
          {questions.map((q, i) => (
            <div key={i} className="row gap-3" style={{ padding: 14, border: '1px solid var(--line-2)', borderRadius: 10 }}>
              <div className="mono" style={{ width: 28, color: 'var(--ink-4)', fontSize: 12, paddingTop: 10 }}>Q{i + 1}</div>
              <div style={{ flex: 1 }}>
                <input className="input" value={q.t} onChange={e => {
                  const n = [...questions]; n[i] = { ...n[i], t: e.target.value }; setQuestions(n);
                }}/>
                <div className="row gap-1" style={{ marginTop: 8 }}>
                  {[['nps', 'NPS 0–10'], ['single', 'Choix unique'], ['multi', 'Choix multiples'], ['scale', 'Échelle 1–5'], ['text', 'Texte libre']].map(([k, l]) => (
                    <button key={k} onClick={() => { const n = [...questions]; n[i] = { ...n[i], k }; setQuestions(n); }} className="chip" style={{
                      cursor: 'pointer', fontSize: 11, padding: '4px 10px',
                      background: q.k === k ? 'var(--ink)' : 'var(--paper)', color: q.k === k ? 'var(--paper)' : 'var(--ink-3)'
                    }}>{l}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} style={{ alignSelf: 'flex-start', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--line-2)', background: 'var(--paper)', cursor: 'pointer', color: 'var(--ink-4)' }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 24, background: 'var(--ivory-2)' }}>
        <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 10 }}>— Aperçu côté répondant</div>
        <div className="card" style={{ padding: 24, background: 'var(--paper)' }}>
          <div className="mono caps muted" style={{ fontSize: 10 }}>{kind === 'survey' ? 'Enquête rémunérée' : 'Sondage rémunéré'} · 3 min</div>
          <div className="serif" style={{ fontSize: 22, marginTop: 6, marginBottom: 18 }}>{questions[0]?.t}</div>
          <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
            {questions[0]?.k === 'nps' && [...Array(11)].map((_, i) => (
              <button key={i} className="chip" style={{ width: 38, justifyContent: 'center', cursor: 'pointer', background: i === 9 ? 'var(--accent)' : 'var(--paper)', color: i === 9 ? 'white' : 'var(--ink-3)' }}>{i}</button>
            ))}
            {questions[0]?.k === 'single' && ['Option A', 'Option B', 'Option C'].map((o, i) => (
              <button key={i} className="chip" style={{ padding: '10px 16px', cursor: 'pointer', background: i === 1 ? 'var(--accent)' : 'var(--paper)', color: i === 1 ? 'white' : 'var(--ink-3)' }}>{o}</button>
            ))}
            {questions[0]?.k === 'text' && <textarea className="input" rows={3} placeholder="Votre réponse…"/>}
          </div>
          <div className="row between center" style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <span className="mono muted" style={{ fontSize: 11 }}>Question 1 / {questions.length}</span>
            <span className="chip chip-good">+1,40 € à la complétion</span>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ObjectivePage, RechargeModal, Modal, SurveyFields });
