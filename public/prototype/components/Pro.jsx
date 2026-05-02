// Pro dashboard
var { useState, useEffect } = React;
const PRO_SECTIONS = [
  { id: 'create',     icon: 'plus',    label: 'Créer une campagne', featured: true },
  { id: 'overview',   icon: 'chart',   label: "Vue d'ensemble" },
  { id: 'campagnes',  icon: 'target',  label: 'Campagnes' },
  { id: 'contacts',   icon: 'users',   label: 'Mes contacts' },
  { id: 'analytics',  icon: 'trend',   label: 'Analytics' },
  { id: 'facturation',icon: 'money',   label: 'Facturation' },
];

function ProDashboard({ go }) {
  const [sec, setSec] = useState('overview');
  const [recharge, setRecharge] = useState(false);
  const [campDetail, setCampDetail] = useState(null);
  return (
    <>
    <DashShell role="pro" go={go} sections={PRO_SECTIONS} current={sec} onNav={setSec}
      header={<ProHeader onCreate={() => setSec('create')} onRecharge={() => setRecharge(true)}/>}>
      {sec === 'overview' && <Overview onCreate={() => setSec('create')}/>}
      {sec === 'campagnes' && !campDetail && <Campagnes onCreate={() => setSec('create')} onDetail={setCampDetail}/>}
      {sec === 'campagnes' && campDetail && <CampaignDetail camp={campDetail} onBack={() => setCampDetail(null)}/>}
      {sec === 'create' && <CreateCampaign onDone={() => setSec('campagnes')}/>}
      {sec === 'contacts' && <Contacts/>}
      {sec === 'analytics' && <Analytics/>}
      {sec === 'facturation' && <Facturation onRecharge={() => setRecharge(true)}/>}
    </DashShell>
    {recharge && <RechargeModal onClose={() => setRecharge(false)}/>}
    </>
  );
}

function ProHeader({ onCreate, onRecharge }) {
  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— Atelier Mercier · Menuiserie sur mesure</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            <em>847 €</em> de crédit actif · 24 contacts ce mois
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            2 campagnes actives · taux d'acceptation moyen 62% · ROI estimé ×3,8
          </div>
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
  return (
    <div className="col gap-6">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Contacts acceptés (30j)', '24', '+18%', 'trend'],
          ["Taux d'acceptation", '62%', '+4 pts', 'check'],
          ['Coût moyen / contact', '5,40 €', '−0,30 €', 'money'],
          ['ROI estimé', '×3,8', '+0,4', 'sparkle'],
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="row between center" style={{ marginBottom: 14 }}>
              <div className="mono caps muted" style={{ fontSize: 10 }}>{k[0]}</div>
              <span style={{ color: 'var(--accent)' }}><Icon name={k[3]} size={14}/></span>
            </div>
            <div className="serif tnum" style={{ fontSize: 36 }}>{k[1]}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--good)', marginTop: 4 }}>{k[2]} vs mois dernier</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div className="serif" style={{ fontSize: 22 }}>Performance des campagnes</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Contacts obtenus, 30 derniers jours</div>
            </div>
            <div className="row gap-2">
              {['7J', '30J', '90J'].map((t, i) => (
                <button key={t} className="chip" style={{ cursor: 'pointer', background: i === 1 ? 'var(--ink)' : 'var(--ivory-2)', color: i === 1 ? 'var(--paper)' : 'var(--ink-3)', border: 0 }}>{t}</button>
              ))}
            </div>
          </div>
          <BarChart/>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition par palier</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Coût et volume des 30 derniers jours</div>
          {[
            [1, 'Identification', 6, 1.20, 20],
            [2, 'Localisation', 8, 11.60, 40],
            [3, 'Style de vie', 5, 18.50, 28],
            [4, 'Pro', 3, 19.80, 18],
            [5, 'Patrimoine', 2, 17.00, 12],
          ].map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--line)' : 'none' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r[0]}</span> {r[1]}</span>
                <span className="mono tnum" style={{ fontSize: 12 }}>{r[2]} contacts · {r[3].toFixed(2).replace('.', ',')} €</span>
              </div>
              <Progress value={r[4]/40}/>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between" style={{ marginBottom: 20 }}>
          <div className="serif" style={{ fontSize: 22 }}>Dernières acceptations</div>
          <button className="btn btn-ghost btn-sm">Voir tout <Icon name="arrow" size={12}/></button>
        </div>
        <table className="tbl">
          <thead><tr><th>Prospect</th><th>Campagne</th><th>Palier</th><th>BUPP Score</th><th>Reçu</th><th style={{textAlign:'right'}}>Coût</th></tr></thead>
          <tbody>
            {[
              ['Marie L.', 'Bilan postural — Lyon', 2, 742, 'il y a 2 h', '4,20'],
              ['Antoine R.', 'Devis aménagement', 3, 688, 'il y a 6 h', '6,80'],
              ['Solène P.', 'Bilan postural — Lyon', 2, 812, 'hier', '4,20'],
              ['Karim B.', 'Devis aménagement', 3, 655, 'hier', '6,80'],
            ].map((r, i) => (
              <tr key={i}>
                <td className="row center gap-3"><Avatar name={r[0]} size={28}/><span>{r[0]}</span></td>
                <td>{r[1]}</td>
                <td><span className="chip">Palier {r[2]}</span></td>
                <td><span className="mono tnum">{r[3]}</span></td>
                <td className="muted mono">{r[4]}</td>
                <td className="mono tnum" style={{ textAlign: 'right' }}>−{r[5]} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarChart() {
  const data = [4, 7, 5, 9, 6, 8, 12, 10, 13, 9, 14, 11];
  const labels = ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12'];
  const max = 16, H = 180, W = 560, P = 16;
  const bw = (W - 2*P) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H+28}`} style={{ width: '100%', height: 210 }}>
      {[4, 8, 12, 16].map(v => {
        const y = P + (1 - v/max) * (H - 2*P);
        return <g key={v}><line x1={P} x2={W-P} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+2} y={y+3} fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{v}</text></g>;
      })}
      {data.map((v, i) => {
        const h = (v / max) * (H - 2*P);
        const x = P + i * bw + 4;
        const y = H - P - h;
        return <g key={i}>
          <rect x={x} y={y} width={bw - 8} height={h} fill={i === data.length - 1 ? 'var(--accent)' : 'var(--ink-2)'} rx="2"/>
          <text x={x + (bw-8)/2} y={H+4} textAnchor="middle" fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{labels[i]}</text>
        </g>;
      })}
    </svg>
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
          Durée de diffusion · 7 jours calendaires
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
          Chaque campagne est active pendant 7 jours à compter de sa mise en ligne.
          {' '}Prolongation possible <strong style={{ color: 'var(--ink)' }}>une fois, de 7 jours supplémentaires</strong>, pour <strong style={{ color: 'var(--ink)' }}>10 € HT</strong> — décision à prendre depuis la fiche campagne avant expiration.
        </div>
      </div>
    </div>
  );
}

function Campagnes({ onCreate, onDetail }) {
  const [filter, setFilter] = useState('all');
  const camps = [
    ['Bilan postural — Lyon', 'active', 300, 218, 42, 'Prise de RDV', '02 avr.', '4,20'],
    ['Devis aménagement', 'active', 400, 147, 21, 'Prise de contact', '10 avr.', '6,80'],
    ['Portes ouvertes mai', 'paused', 150, 82, 11, 'Événement', '28 mars', '3,40'],
    ['Promo printemps', 'done', 200, 200, 38, 'Prise de contact', '14 fév.', '5,20'],
  ];
  const filtered = camps.filter(c => filter === 'all' || c[1] === filter);
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Campagnes" title="Vos initiatives en cours" action={
        <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={14}/> Nouvelle campagne</button>
      }/>
      <CampaignDurationBanner/>
      <div className="row gap-2">
        {[['all', 'Toutes (4)'], ['active', 'Actives (2)'], ['paused', 'En pause (1)'], ['done', 'Terminées (1)']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="chip" style={{
            cursor: 'pointer', padding: '6px 12px', fontSize: 12,
            background: filter === k ? 'var(--ink)' : 'var(--paper)',
            color: filter === k ? 'var(--paper)' : 'var(--ink-3)',
            borderColor: filter === k ? 'var(--ink)' : 'var(--line-2)'
          }}>{l}</button>
        ))}
      </div>
      <div className="col gap-3">
        {filtered.map((c, i) => (
          <div key={i} className="card" style={{ padding: 24 }}>
            <div className="row between" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="row center gap-3" style={{ marginBottom: 10 }}>
                  <div className="serif" style={{ fontSize: 22 }}>{c[0]}</div>
                  <span className={'chip ' + (c[1] === 'active' ? 'chip-good' : c[1] === 'paused' ? 'chip-warn' : '')}>
                    {c[1] === 'active' ? 'Active' : c[1] === 'paused' ? 'En pause' : 'Terminée'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{c[5]} · créée le {c[6]} · coût unitaire moyen {c[7]} €</div>
                <div className="row gap-6" style={{ marginTop: 16, flexWrap: 'wrap' }}>
                  <div><div className="muted mono caps" style={{ fontSize: 10 }}>Budget</div><div className="serif tnum" style={{ fontSize: 20 }}>{c[3]} / {c[2]} €</div></div>
                  <div><div className="muted mono caps" style={{ fontSize: 10 }}>Contacts</div><div className="serif tnum" style={{ fontSize: 20 }}>{c[4]}</div></div>
                  <div style={{ flex: 1, minWidth: 180, alignSelf: 'flex-end' }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6 }}>Budget consommé</div>
                    <Progress value={c[3]/c[2]}/>
                  </div>
                </div>
              </div>
              <div className="row gap-2">
                <button className="btn btn-ghost btn-sm">
                  <Icon name={c[1] === 'active' ? 'pause' : 'play'} size={12}/>
                  {c[1] === 'active' ? 'Pause' : 'Relancer'}
                </button>
                <button className="btn btn-ghost btn-sm"><Icon name="copy" size={12}/> Dupliquer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDetail(c)}>Détails <Icon name="arrow" size={12}/></button>
              </div>
            </div>
          </div>
        ))}
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
  { id:'evt', name:'Événementiel & inscription', desc:'8 opérations — webinar, atelier, conférence', icon:'flag', allowedTiers:[1], sub:[
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
  { id:'addigital', name:'Publicité digitale', desc:'Adresses réseaux sociaux pour ciblage publicitaire', icon:'bolt', allowedTiers:[1], sub:[
    {id:'meta',      name:'Audience Meta (Facebook / Instagram)', desc:'Liste d\u2019emails / téléphones hashés pour ciblage publicitaire', cost:0.20},
    {id:'google',    name:'Google Customer Match',     desc:'Audience pour Google Ads, YouTube, Discovery',                cost:0.20},
    {id:'tiktok',    name:'TikTok Ads — Custom Audience', desc:'Liste pour ciblage publicitaire TikTok Ads',               cost:0.20},
    {id:'linkedin',  name:'LinkedIn Matched Audiences',desc:'Audience B2B pour LinkedIn Ads',                              cost:0.30},
    {id:'snap',      name:'Snapchat Ads',              desc:'Audience pour ciblage publicitaire Snap',                     cost:0.20},
    {id:'x',         name:'X (Twitter) Ads',           desc:'Liste pour ciblage publicitaire sur X',                       cost:0.20},
  ]},
];

const TIERS_DATA = [
  {id:1, name:'Identification',            sub:'Email, nom, téléphone, date de naissance',        min:0.10, max:0.50,  pct:20},
  {id:2, name:'Localisation',              sub:'Adresse postale, logement, mobilité',             min:0.50, max:2.00,  pct:40},
  {id:3, name:'Style de vie',              sub:'Habitudes, famille, véhicule, sport',             min:2.00, max:5.00,  pct:58},
  {id:4, name:'Données professionnelles',  sub:'Poste, revenus, statut, secteur',                 min:5.00, max:8.00,  pct:78},
  {id:5, name:'Patrimoine & projets',      sub:'Immobilier, épargne, succession, création',       min:8.00, max:10.00, pct:100},
];

const GEO_ZONES = [
  {id:'ville',    name:'Ville',       sub:'Rayon 20 km'},
  {id:'dept',     name:'Département', sub:'Rayon 50 km'},
  {id:'region',   name:'Région',      sub:'Rayon 150 km'},
  {id:'national', name:'National',    sub:'Toute la France'},
];

const AGE_RANGES = ['18–25','26–35','36–45','46–55','56–65','65+','Tous'];

const VERIF_LEVELS = [
  {id:'p0', name:'Standard — Palier 0',  sub:'Email vérifié uniquement',                         mult:1},
  {id:'p1', name:'Vérifié — Palier 1',   sub:'Téléphone + email confirmé',                       mult:1.2},
  {id:'p2', name:'Certifié — Palier 2',  sub:"Pièce d'identité + selfie KYC",                    mult:1.5},
  {id:'p3', name:'Confiance — Palier 3', sub:'IBAN + courrier postal — Gains prospects doublés', mult:2, badge:'×2'},
];

const KW_SUGGESTIONS = ['véhicule','immobilier','retraite','sport','artisan','nutrition','coaching','BTP','épargne','assurance','crédit','jardinage','animaux','voyages','informatique'];

const WIZ_STEPS = ['Objectif','Données','Ciblage','Budget','Mots-clés','Récap'];

const fmtEur = (v) => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(v);

function CreateCampaign({ onDone }) {
  const [step, setStep] = useState(1);
  const [launched, setLaunched] = useState(null); // {code} when launched
  const [selectedObj, setSelectedObj] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());
  const [selectedTiers, setSelectedTiers] = useState(new Set([1]));
  const [geo, setGeo] = useState('ville');
  const [ages, setAges] = useState(new Set(['Tous']));
  const [verif, setVerif] = useState('p0');
  const [contacts, setContacts] = useState(50);
  const [days, setDays] = useState(30);
  const [poolMode, setPoolMode] = useState('standard');
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState('');
  const [kwFilter, setKwFilter] = useState(false);

  const obj = OBJECTIVES.find(o => o.id === selectedObj);
  const allowedTiers = obj?.allowedTiers || [1,2,3,4,5];

  // RGPD : prune tiers when objective changes — only keep allowed ones
  useEffect(() => {
    if (!obj) return;
    setSelectedTiers(prev => {
      const next = new Set();
      prev.forEach(tid => { if (allowedTiers.includes(tid)) next.add(tid); });
      if (next.size === 0) next.add(allowedTiers[0]);
      return next;
    });
  }, [selectedObj]);

  const cpc = (() => {
    if (!selectedTiers.size) return 0;
    let base = 0;
    selectedTiers.forEach(tid => { const t = TIERS_DATA.find(t => t.id === tid); base += (t.min + t.max) / 2; });
    if (obj && selectedSubs.size) {
      let subAdd = 0;
      selectedSubs.forEach(sid => { const s = obj.sub.find(s => s.id === sid); if (s) subAdd += s.cost; });
      base += subAdd / selectedSubs.size;
    }
    const mult = VERIF_LEVELS.find(v => v.id === verif)?.mult || 1;
    return Math.round(base * mult * 100) / 100;
  })();
  const total = Math.round(cpc * contacts * 100) / 100;

  const toggleSub = (sid) => setSelectedSubs(p => { const n = new Set(p); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const toggleTier = (tid) => setSelectedTiers(p => { const n = new Set(p); n.has(tid) ? n.delete(tid) : n.add(tid); return n; });
  const toggleAge = (a) => setAges(p => {
    if (a === 'Tous') return new Set(['Tous']);
    const n = new Set(p); n.delete('Tous');
    n.has(a) ? n.delete(a) : n.add(a);
    if (!n.size) n.add('Tous');
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

  const stepperBar = (
    <div className="card" style={{ padding: 4 }}>
      <div className="row" style={{ padding: 8 }}>
        {WIZ_STEPS.map((s, i) => {
          const idx = i + 1;
          const isDone = idx < step;
          const isActive = idx === step;
          return (
            <div key={s} style={{ flex: 1, padding: '10px 12px', borderRadius: 8,
              background: isActive ? 'var(--ivory-2)' : 'transparent',
              borderRight: i < WIZ_STEPS.length - 1 ? '1px solid var(--line)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: idx <= step ? 1 : 0.5
            }}>
              <span style={{ width: 22, height: 22, borderRadius: 999,
                background: isDone ? 'var(--good)' : isActive ? 'var(--ink)' : 'var(--line)',
                color: idx <= step ? 'white' : 'var(--ink-4)',
                fontSize: 11, fontFamily: 'var(--mono)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? '✓' : idx}
              </span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400 }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const costPreview = cpc > 0 && (
    <div className="wizard-cost-preview" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
      background: 'color-mix(in oklab, var(--accent) 6%, var(--paper))',
      border: '1px solid color-mix(in oklab, var(--accent) 20%, var(--line))',
      borderRadius: 14, padding: 20, marginBottom: 24 }}>
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
  );

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Nouvelle campagne" title={"Étape " + step + " · " + WIZ_STEPS[step-1]}/>
      {stepperBar}
      {step === 1 && <CampaignDurationBanner/>}

      <div className="card" style={{ padding: 32 }}>

        {step === 1 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Quel est l'objectif de votre campagne ?</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Choisissez un objectif principal, puis affinez avec les sous-types.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {OBJECTIVES.map(o => (
                <button key={o.id} onClick={() => { setSelectedObj(o.id); setSelectedSubs(new Set()); }}
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

            {selectedObj && obj && (
              <div>
                <div style={{ height: 1, background: 'var(--line)', margin: '24px 0 20px' }}/>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Précisez : {obj.name}</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Multi-sélection possible.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {obj.sub.map(s => (
                    <button key={s.id} onClick={() => toggleSub(s.id)}
                      className="row center" style={{ gap: 12, padding: 12, borderRadius: 10, textAlign: 'left',
                        border: '1px solid ' + (selectedSubs.has(s.id) ? 'var(--accent)' : 'var(--line-2)'),
                        background: selectedSubs.has(s.id) ? 'color-mix(in oklab, var(--accent) 5%, var(--paper))' : 'var(--paper)',
                        cursor: 'pointer' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4,
                        border: '1.5px solid ' + (selectedSubs.has(s.id) ? 'var(--accent)' : 'var(--line-2)'),
                        background: selectedSubs.has(s.id) ? 'var(--accent)' : 'var(--paper)',
                        color: 'white', fontSize: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {selectedSubs.has(s.id) ? '✓' : ''}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>+{fmtEur(s.cost)}/contact</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
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

            {/* Tiers grid */}
            <div className="col gap-2">
              {TIERS_DATA.map(t => {
                const allowed = allowedTiers.includes(t.id);
                const checked = selectedTiers.has(t.id) && allowed;
                return (
                  <button key={t.id}
                    onClick={() => allowed && toggleTier(t.id)}
                    disabled={!allowed}
                    title={allowed ? '' : 'Palier non disponible pour cette finalité (RGPD — minimisation)'}
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
                          <div className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmtEur(t.min)} – {fmtEur(t.max)}</div>
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>par contact</div>
                        </>
                      ) : (
                        <span className="mono caps" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', letterSpacing: '.08em' }}>
                          🔒 Non autorisé
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

        {step === 3 && (
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
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Définissez votre budget</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Ajustez le nombre de contacts et la durée de la campagne.</div>

            {costPreview}

            <div className="col gap-6" style={{ marginBottom: 24 }}>
              <div>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>Contacts souhaités</label>
                  <span className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{contacts}</span>
                </div>
                <input type="range" min={10} max={500} step={10} value={contacts} onChange={e => setContacts(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}/>
                <div className="row between mono muted" style={{ fontSize: 10, marginTop: 4 }}><span>10</span><span>500</span></div>
              </div>
              <div>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>Durée de la campagne</label>
                  <span className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{days} jours</span>
                </div>
                <input type="range" min={7} max={90} step={7} value={days} onChange={e => setDays(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}/>
                <div className="row between mono muted" style={{ fontSize: 10, marginTop: 4 }}><span>7 j</span><span>90 j</span></div>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--line)', margin: '8px 0 20px' }}/>

            <div className="label">Mode de campagne</div>
            <div className="col gap-2">
              {[
                { id: 'standard', name: 'Mise en relation individuelle', sub: 'Contact direct avec chaque prospect — immédiat' },
                { id: 'pool', name: 'BUPP Pool — enchère groupée', sub: 'Groupez des prospects ayant un besoin commun — le plus offrant remporte le pool' },
              ].map(m => {
                const sel = poolMode === m.id;
                return (
                  <button key={m.id} onClick={() => setPoolMode(m.id)} className="row center wizard-mode-row" style={{ gap: 14, padding: 14, borderRadius: 10, cursor: 'pointer',
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
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{m.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="row center gap-3" style={{ marginBottom: 6 }}>
              <div className="serif" style={{ fontSize: 22 }}>Filtrage par mots-clés</div>
              <span className="chip chip-accent" style={{ fontSize: 10 }}>Optionnel</span>
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22, maxWidth: 720 }}>
              Affinez votre ciblage en ajoutant des mots-clés. BUPP vérifiera leur présence dans les données
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
                        Le filtre strict peut réduire le nombre de prospects disponibles. BUPP vous notifiera
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

        {step === 6 && (
          <div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Récapitulatif de votre campagne</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Vérifiez tous les paramètres avant de lancer.</div>

            {costPreview}

            <div style={{ background: 'var(--ivory-2)', border: '1px solid var(--line-2)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              {[
                ['Objectif', obj?.name || '—'],
                ['Sous-types', obj ? Array.from(selectedSubs).map(sid => obj.sub.find(s => s.id === sid)?.name).filter(Boolean).join(', ') || '—' : '—'],
                ['Paliers de données', Array.from(selectedTiers).map(tid => TIERS_DATA.find(t => t.id === tid)?.name).join(', ') || '—'],
                ['Zone', GEO_ZONES.find(z => z.id === geo)?.name],
                ["Tranches d'âge", Array.from(ages).join(', ')],
                ['Vérification', VERIF_LEVELS.find(v => v.id === verif)?.name],
                ['Mode', poolMode === 'pool' ? 'BUPP Pool — enchère groupée' : 'Mise en relation individuelle'],
                ['Contacts', contacts + ' contacts'],
                ['Durée', days + ' jours'],
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
              <div className="row between" style={{ padding: '10px 0' }}>
                <span className="muted" style={{ fontSize: 12 }}>Budget total</span>
                <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{total > 0 ? fmtEur(total) : '—'}</span>
              </div>
            </div>

            <div className="alert-block" style={{ padding: 14, borderRadius: 10,
              background: 'color-mix(in oklab, var(--warn) 8%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--warn) 25%, transparent)',
              fontSize: 11, lineHeight: 1.55, color: 'color-mix(in oklab, var(--warn) 55%, var(--ink-3))',
              marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                minWidth: 22, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--good)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 1, boxShadow: '0 0 0 3px color-mix(in oklab, var(--good) 18%, transparent)'
              }}>
                <Icon name="check" size={12} stroke={2.5}/>
              </span>
              <span>
                En lançant cette campagne, vous acceptez les conditions de licence des données BUPP. Les coordonnées
                des prospects ne sont transmises qu'après double consentement explicite. Vos données sont
                watermarkées — toute revente est juridiquement poursuivable.
              </span>
            </div>

            <div className="row gap-3">
              <button onClick={() => setStep(1)} className="btn btn-ghost" style={{ flex: 1 }}>Modifier</button>
              <button onClick={() => {
                  // Generate a unique single-use code (e.g. BUPP-XXXX-XXXX)
                  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
                  setLaunched({ code: `BUPP-${rand()}-${rand()}`, name: obj?.name });
                }} className="btn btn-primary" style={{ flex: 2 }}>Lancer la campagne <Icon name="arrow" size={14}/></button>
            </div>
          </div>
        )}

      </div>

      <div className="row between">
        <button className="btn btn-ghost" onClick={() => step > 1 ? setStep(step - 1) : onDone()}>
          <Icon name="arrowLeft" size={14}/> {step > 1 ? 'Retour' : 'Annuler'}
        </button>
        {step < 6 && (
          <button className="btn btn-primary"
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && (!selectedObj || !selectedSubs.size)) ||
              (step === 2 && !selectedTiers.size)
            }>
            Continuer <Icon name="arrow" size={14}/>
          </button>
        )}
      </div>

      {launched && <CampaignLaunchedModal data={launched} onClose={() => { setLaunched(null); onDone(); }}/>}
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
        </div>

        {/* RGPD article 14 notice */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))',
          border: '1px solid var(--line)',
          fontSize: 12, lineHeight: 1.55, color: 'var(--ink-2)', marginBottom: 8
        }}>
          Communiquez ce code à chaque prospect afin de confirmer que vous avez bien obtenu
          ses données via la plateforme <strong>BUPP</strong>, conformément à l'<strong>article 14
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

function Contacts() {
  const ALL_ROWS = [
    ['Marie Leroy', 742, 'Bilan postural — Lyon', 2, 'marie.l•••@gmail.com', '06 •• •• •• 12', '02 avr.', 'valide'],
    ['Antoine Renaud', 688, 'Devis aménagement', 3, 'a.renaud•••@orange.fr', '07 •• •• •• 48', '04 avr.', null],
    ['Solène Pires', 812, 'Bilan postural — Lyon', 2, 's.pires•••@free.fr', '06 •• •• •• 03', '08 avr.', 'valide'],
    ['Karim Benali', 655, 'Devis aménagement', 3, 'k.benali•••@laposte.net', '07 •• •• •• 91', '12 avr.', 'difficile'],
    ['Julie Caron', 774, 'Bilan postural — Lyon', 2, 'julie.caron•••@gmail.com', '06 •• •• •• 27', '14 avr.', null],
  ];
  // Filter definitions — a filter narrows the list; combining filters is AND
  const FILTERS = {
    f1: { label: 'Score ≥ 720',          test: r => r[1] >= 720 },
    f2: { label: "Évaluation validée",   test: r => r[7] === 'valide' },
    f3: { label: 'Palier 2',              test: r => r[3] === 2 },
  };
  const [active, setActive] = useState(new Set());
  const toggle = (k) => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const clear = () => setActive(new Set());
  const rows = active.size === 0 ? ALL_ROWS : ALL_ROWS.filter(r => [...active].every(k => FILTERS[k].test(r)));

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
            {rows.length} / {ALL_ROWS.length} prospect{rows.length > 1 ? 's' : ''}
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

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead><tr>
            <th>Prospect</th><th>Score</th><th>Campagne</th><th>Palier</th><th>Email</th><th>Téléphone</th><th>Reçu</th><th>Évaluation</th><th style={{ textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div className="muted" style={{ fontSize: 13 }}>Aucun prospect ne correspond aux filtres activés.</div>
              </td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="row center gap-3"><Avatar name={r[0]} size={28}/><span>{r[0]}</span></td>
                <td className="mono tnum">{r[1]}</td>
                <td className="muted">{r[2]}</td>
                <td><span className="chip">P{r[3]}</span></td>
                <td className="mono" style={{ fontSize: 12 }}>{r[4]}</td>
                <td className="mono" style={{ fontSize: 12 }}>{r[5]}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{r[6]}</td>
                <td>
                  {r[7] === 'valide' ? <span className="chip chip-good">✓ Valide</span>
                    : r[7] === 'difficile' ? <span className="chip chip-warn">Difficile</span>
                    : <div className="row gap-1">
                      <button className="chip" style={{ cursor:'pointer' }}>Valide</button>
                      <button className="chip" style={{ cursor:'pointer' }}>Diff.</button>
                      <button className="chip" style={{ cursor:'pointer' }}>Invalide</button>
                    </div>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}><Icon name="phone" size={12}/></button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}><Icon name="email" size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ padding: 16, background: 'var(--ivory-2)', borderStyle: 'dashed' }}>
        <div className="row center gap-3">
          <Icon name="shield" size={16}/>
          <div style={{ fontSize: 13 }}>
            <strong>Politique d'usage.</strong> <span className="muted">Les coordonnées sont watermarquées individuellement. Toute diffusion hors périmètre de la campagne déclenchera une enquête automatique et peut entraîner la résiliation du compte.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Analytics" title="Performance fine" desc="Analyses sur 30 derniers jours · mise à jour toutes les 15 minutes"/>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Taux d'acceptation par palier</div>
          {[
            [1, 'Identification', 84],
            [2, 'Localisation', 72],
            [3, 'Style de vie', 61],
            [4, 'Pro', 48],
            [5, 'Patrimoine', 34],
          ].map(r => (
            <div key={r[0]} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r[0]}</span> {r[1]}</span>
                <span className="mono tnum">{r[2]}%</span>
              </div>
              <Progress value={r[2]/100}/>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Meilleurs créneaux</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>Heatmap du taux d'acceptation heure × jour</div>
          <Heatmap/>
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition géographique</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Pourcentage de contacts acceptés par zone</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            ['Lyon 3e', '78%', '42 contacts'],
            ['Villeurbanne', '71%', '28 contacts'],
            ['Lyon 6e', '66%', '19 contacts'],
            ['Caluire', '58%', '12 contacts'],
            ['Lyon 7e', '54%', '8 contacts'],
          ].map((r, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="serif" style={{ fontSize: 18 }}>{r[0]}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{r[1]}</div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{r[2]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Age breakdown */}
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par tranche d'âge</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par segment</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {[
            ['18–25', 8],
            ['26–35', 24],
            ['36–45', 31],
            ['46–55', 22],
            ['56–65', 11],
            ['65+', 4],
          ].map(([l, v], i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>{l}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{v}%</div>
              <div style={{ height: 4, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (v * 3) + '%', background: 'var(--accent)', borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sex breakdown */}
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par sexe</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par genre déclaré</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['Femmes', 58, 'color-mix(in oklab, var(--accent) 90%, #EC4899)'],
            ['Hommes', 39, 'var(--accent)'],
            ['Autre / non précisé', 3, 'var(--ink-4)'],
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
        {/* Stacked horizontal bar */}
        <div style={{ marginTop: 22, height: 14, borderRadius: 999, overflow: 'hidden', display: 'flex', border: '1px solid var(--line)' }}>
          <div style={{ width: '58%', background: 'color-mix(in oklab, var(--accent) 90%, #EC4899)' }}/>
          <div style={{ width: '39%', background: 'var(--accent)' }}/>
          <div style={{ width: '3%', background: 'var(--ink-4)' }}/>
        </div>
      </div>
    </div>
  );
}

function Heatmap() {
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const hours = ['8', '10', '12', '14', '16', '18', '20'];
  const grid = days.map((_, d) => hours.map((_, h) => {
    const peak = (h === 2 || h === 4 || h === 5) && d < 5 ? 0.7 : 0.15;
    return Math.min(1, peak + (Math.sin(d * 7 + h * 3) + 1) * 0.15);
  }));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px repeat(7, 1fr)', gap: 4 }}>
      <div/>
      {hours.map(h => <div key={h} className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textAlign: 'center' }}>{h}h</div>)}
      {days.map((d, di) => (
        <React.Fragment key={di}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{d}</div>
          {hours.map((_, hi) => (
            <div key={hi} style={{
              aspectRatio: '1', borderRadius: 4,
              background: `color-mix(in oklab, var(--accent) ${Math.round(grid[di][hi] * 80)}%, var(--ivory-2))`
            }}/>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function Facturation() {
  const rows = [
    ['BUPP-2026-04-0183', '14 avr. 2026', 'Recharge crédit', '500,00', 'Payée'],
    ['BUPP-2026-04-0112', '02 avr. 2026', 'Abonnement Pro · avril', '149,00', 'Payée'],
    ['BUPP-2026-03-0421', '02 mars 2026', 'Abonnement Pro · mars', '149,00', 'Payée'],
    ['BUPP-2026-03-0298', '18 mars 2026', 'Recharge crédit', '300,00', 'Payée'],
    ['BUPP-2026-02-0512', '02 fév. 2026', 'Abonnement Pro · février', '149,00', 'Payée'],
  ];
  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Facturation" title="Paiements &amp; factures"/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          ['Abonnement actuel', 'Pro', '149 € / mois'],
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
        <div className="row between" style={{ marginBottom: 18 }}>
          <div className="serif" style={{ fontSize: 22 }}>Historique des factures</div>
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Tout télécharger</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Numéro</th><th>Date</th><th>Libellé</th><th>Statut</th><th style={{textAlign:'right'}}>Montant</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12 }}>{r[0]}</td>
                <td className="muted">{r[1]}</td>
                <td>{r[2]}</td>
                <td><span className="chip chip-good">✓ {r[4]}</span></td>
                <td className="mono tnum" style={{ textAlign: 'right' }}>{r[3]} €</td>
                <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignDetail({ camp, onBack }) {
  const [tab, setTab] = useState('overview');
  // camp = [name, status, budget, spent, contacts, objective, date, avgCost]
  const [name, status, budget, spent, contacts, objective, date, avgCost] = camp;
  const statusLabel = status === 'active' ? 'Active' : status === 'paused' ? 'En pause' : 'Terminée';
  const statusChip = status === 'active' ? 'chip-good' : status === 'paused' ? 'chip-warn' : '';

  const dailyData = [2, 4, 3, 6, 5, 7, 9, 8, 11, 9, 12, 10, 13, 14];
  const maxDaily = Math.max(...dailyData);

  const funnel = [
    ['Prospects exposés', 3840, 100],
    ['Demandes envoyées', 912, 24],
    ['Acceptées', 218, 6],
    ['Acceptées (P2+)', 147, 4],
    ['Rendez-vous pris', 42, 1],
  ];

  const contactsList = [
    ['Marie Leroy', 742, 'P2 · Certifié', '14 avr. 10:12', 'RDV confirmé', 'good'],
    ['Antoine Renaud', 688, 'P1 · Vérifié', '14 avr. 09:47', 'Contact accepté', 'good'],
    ['Solène Pires', 812, 'P2 · Certifié', '13 avr. 17:22', 'RDV confirmé', 'good'],
    ['Karim Benali', 655, 'P1 · Vérifié', '13 avr. 14:08', 'En attente', ''],
    ['Julie Caron', 774, 'P2 · Certifié', '13 avr. 11:35', 'Contact accepté', 'good'],
    ['Théo Martin', 701, 'P1 · Vérifié', '12 avr. 16:44', 'Refusé', 'warn'],
    ['Léa Dubois', 788, 'P2 · Certifié', '12 avr. 09:21', 'Contact accepté', 'good'],
  ];

  const activity = [
    ['Il y a 14 min', 'Marie Leroy a confirmé le RDV du 17 avril à 14:30', 'calendar', 'var(--good)'],
    ['Il y a 1 h 22 min', 'Antoine Renaud a accepté votre mise en relation', 'check', 'var(--good)'],
    ['Il y a 3 h', 'Budget : 5,20 € consommés — 218 contacts au total', 'wallet', 'var(--accent)'],
    ['Il y a 6 h', 'Karim Benali — demande envoyée, en attente sous 72 h', 'email', 'var(--ink-4)'],
    ['Hier, 17:42', 'Solène Pires a réservé un créneau dans votre agenda', 'calendar', 'var(--good)'],
    ['Hier, 09:12', 'Théo Martin a refusé — motif : hors zone', 'close', 'var(--warn)'],
    ['14 avril', 'Campagne relancée automatiquement — objectif non atteint', 'refresh', 'var(--ink-4)'],
  ];

  return (
    <div className="col gap-6">
      <div>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={12}/> Toutes les campagnes
        </button>
        <div className="row between" style={{ alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="mono caps muted" style={{ marginBottom: 8 }}>— Campagne · {objective}</div>
            <h3 className="serif" style={{ fontSize: 40, letterSpacing: '-0.015em' }}>
              {name} <span className={'chip ' + statusChip} style={{ fontSize: 12, verticalAlign: 'middle', marginLeft: 10 }}>{statusLabel}</span>
            </h3>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Créée le {date} · coût unitaire moyen {avgCost} € ·
              {' '}<span style={{ color: 'var(--ink)', fontWeight: 500 }}>{status === 'active' ? 'Expire dans 3 j 14 h' : status === 'paused' ? 'Reprise possible · 4 j restants' : 'Terminée le 21 fév.'}</span>
              {' '}· durée initiale 7 jours
            </div>
          </div>
          <div className="row gap-2">
            <button className="btn btn-ghost btn-sm"><Icon name="copy" size={12}/> Dupliquer</button>
            <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Exporter</button>
            <button className="btn btn-ghost btn-sm">
              <Icon name={status === 'active' ? 'pause' : 'play'} size={12}/>
              {status === 'active' ? 'Mettre en pause' : 'Relancer'}
            </button>
            <button className="btn btn-primary btn-sm"><Icon name="edit" size={12}/> Modifier</button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Budget consommé', spent + ' € / ' + budget + ' €', Math.round(spent / budget * 100) + '% engagé', 'wallet'],
          ['Contacts obtenus', String(contacts), 'objectif ~' + Math.round(budget / parseFloat(avgCost.replace(',', '.'))), 'users'],
          ['Taux d\'acceptation', '24%', 'vs 18% marché', 'trend'],
          ['Coût moyen / contact', avgCost + ' €', '−0,40 € vs estimé', 'bolt'],
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
              {status === 'active' ? (
                <>Campagne active — <strong>expiration dans 3 j 14 h</strong> · diffusion de 7 jours calendaires</>
              ) : status === 'paused' ? (
                <>Campagne en pause — reprise possible sous 4 jours avant clôture automatique</>
              ) : (
                <>Campagne clôturée le 21 février après 7 jours de diffusion</>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              Prolongation possible une fois · +7 jours · 10 € HT ajoutés à la prochaine facture.
            </div>
          </div>
        </div>
        {status === 'active' && (
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={12}/> Prolonger · 10 €</button>
        )}
        {status === 'done' && (
          <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            Prolongation expirée
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="row gap-2">
        {[['overview', 'Vue d\'ensemble'], ['contacts', 'Contacts (' + contacts + ')'], ['config', 'Configuration'], ['activity', 'Activité'], ['billing', 'Facturation']].map(([k, l]) => (          <button key={k} onClick={() => setTab(k)} className="chip" style={{
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
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Contacts acceptés par jour sur les 14 derniers jours</div>
              </div>
            </div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 160, marginBottom: 12 }}>
              {dailyData.map((v, i) => (
                <div key={i} style={{ flex: 1, height: (v / maxDaily * 100) + '%', background: 'var(--accent)', borderRadius: 4, position: 'relative', opacity: 0.4 + (i / dailyData.length) * 0.6 }}>
                  <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{v}</span>
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
            <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>De l'exposition au rendez-vous</div>
            <div className="col gap-3">
              {funnel.map(([l, v, pct], i) => (
                <div key={i}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span>
                    <span className="mono tnum" style={{ fontSize: 13 }}>{v.toLocaleString('fr-FR')} · <span style={{ color: 'var(--accent)' }}>{pct}%</span></span>
                  </div>
                  <div style={{ height: 8, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 999, opacity: 0.3 + (1 - i / funnel.length) * 0.7 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Budget breakdown — full width */}
          <div className="card" style={{ padding: 28, gridColumn: '1 / -1' }}>
            <div className="row between" style={{ marginBottom: 20 }}>
              <div>
                <div className="serif" style={{ fontSize: 22 }}>Répartition du budget</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Ventilation des {spent} € consommés par palier et canal</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>Reste à engager</div>
                <div className="serif tnum" style={{ fontSize: 22, color: 'var(--accent)' }}>{(budget - spent).toFixed(0)} €</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                ['Palier 1 — Identification', 62, 'var(--accent)'],
                ['Palier 2 — Localisation', 94, 'color-mix(in oklab, var(--accent) 70%, var(--ink))'],
                ['Palier 3 — Style de vie', 48, 'color-mix(in oklab, var(--accent) 40%, var(--ink))'],
                ['Vérification certifiée', 14, 'var(--ink-4)'],
              ].map(([l, v, c], i) => (
                <div key={i}>
                  <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 8 }}>{l}</div>
                  <div className="serif tnum" style={{ fontSize: 24 }}>{v} €</div>
                  <div style={{ height: 4, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (v / spent * 100) + '%', background: c, borderRadius: 999 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="row between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div className="serif" style={{ fontSize: 20 }}>Contacts obtenus</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{contacts} contacts acceptés via cette campagne</div>
            </div>
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filtrer</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Exporter CSV</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Prospect</th><th>Score</th><th>Palier</th><th>Date</th><th>Statut</th><th style={{ textAlign: 'right' }}>Action</th>
            </tr></thead>
            <tbody>
              {contactsList.map((r, i) => (
                <tr key={i}>
                  <td><span className="row center gap-3"><Avatar name={r[0]} size={26}/>{r[0]}</span></td>
                  <td className="mono tnum">{r[1]}</td>
                  <td><span className="chip" style={{ fontSize: 11 }}>{r[2]}</span></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{r[3]}</td>
                  <td><span className={'chip ' + (r[5] === 'good' ? 'chip-good' : r[5] === 'warn' ? 'chip-warn' : '')} style={{ fontSize: 11 }}>{r[4]}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm"><Icon name="email" size={12}/> Contacter</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 28 }}>
            <div className="serif" style={{ fontSize: 20, marginBottom: 18 }}>Objectif & données</div>
            {[
              ['Objectif principal', objective],
              ['Sous-types', 'Email marketing, SMS'],
              ['Paliers de données', 'P1 · Identification, P2 · Localisation'],
              ['Mots-clés', 'véhicule, immobilier'],
              ['Mode mot-clé', 'Signal de priorité'],
            ].map(([l, v], i) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--line)' : 'none' }}>
                <span className="muted" style={{ fontSize: 12 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 28 }}>
            <div className="serif" style={{ fontSize: 20, marginBottom: 18 }}>Ciblage & budget</div>
            {[
              ['Zone géographique', 'Département (rayon 50 km)'],
              ["Tranches d'âge", '26–35, 36–45'],
              ['Vérification min.', 'Certifié — Palier 2'],
              ['Contacts souhaités', '50 contacts'],
              ['Durée', '30 jours'],
              ['Mode', 'Mise en relation individuelle'],
              ['Budget total', budget + ' €'],
              ['Coût max / contact', '6,00 €'],
            ].map(([l, v], i) => (
              <div key={i} className="row between" style={{ padding: '12px 0', borderBottom: i < 7 ? '1px solid var(--line)' : 'none' }}>
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
          <div className="muted" style={{ fontSize: 13, marginBottom: 22 }}>Événements temps réel de votre campagne</div>
          {activity.map((a, i) => (
            <div key={i} className="row" style={{ padding: '14px 0', borderBottom: i < activity.length - 1 ? '1px solid var(--line)' : 'none', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ivory-2)', color: a[3], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={a[2]} size={14}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{a[1]}</div>
                <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>{a[0]}</div>
              </div>
            </div>
          ))}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              ['Total débité', spent + ',00 €'],
              ['Contacts facturés', contacts + ' / ' + Math.round(budget / parseFloat(avgCost.replace(',', '.')))],
              ['Moyenne / contact', avgCost + ' €'],
            ].map(([l, v], i) => (
              <div key={i} style={{ padding: 16, background: 'var(--ivory-2)', borderRadius: 10 }}>
                <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>{l}</div>
                <div className="serif tnum" style={{ fontSize: 22 }}>{v}</div>
              </div>
            ))}
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Date</th><th>Contact</th><th>Palier</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th>
            </tr></thead>
            <tbody>
              {[
                ['14 avr. 10:12', 'Marie Leroy', 'P2 · Certifié', '5,80', 'Débité'],
                ['14 avr. 09:47', 'Antoine Renaud', 'P1 · Vérifié', '3,20', 'Débité'],
                ['13 avr. 17:22', 'Solène Pires', 'P2 · Certifié', '6,10', 'Débité'],
                ['13 avr. 11:35', 'Julie Caron', 'P2 · Certifié', '5,90', 'Débité'],
                ['12 avr. 09:21', 'Léa Dubois', 'P2 · Certifié', '5,40', 'Débité'],
              ].map((r, i) => (
                <tr key={i}>
                  <td className="muted mono" style={{ fontSize: 12 }}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td><span className="chip" style={{ fontSize: 11 }}>{r[2]}</span></td>
                  <td className="mono tnum" style={{ textAlign: 'right' }}>{r[3]} €</td>
                  <td><span className="chip chip-good" style={{ fontSize: 11 }}>✓ {r[4]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProDashboard });
