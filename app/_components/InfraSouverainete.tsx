/**
 * Section « Infrastructure & souveraineté » de la page À propos.
 *
 * Reproduction fidèle de la maquette `public/prototype/sec.html`
 * (couleurs, fonts, icônes conservées). Le style vit dans globals.css,
 * scopé sous `.infra` (cf. bloc « Infrastructure & souveraineté »).
 * Les 3 classes en collision avec les utilitaires globaux sont renommées :
 * `.card → .infra-card`, `.grid → .infra-grid`, `.wrap → .infra-wrap`.
 *
 * Seul écart volontaire vs maquette : le quadrillage de fond reprend le
 * motif maison du site (88px), comme demandé.
 */

// Icône check (puces de features) — identique à la maquette.
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6D5BFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4L19 7" />
    </svg>
  );
}

// Icône cadenas (pills « star » = certif phare) — identique à la maquette.
function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6D5BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Anneau de 12 étoiles UE — généré avec la formule exacte du script de la
 * maquette (rayon d'anneau 34, étoiles à 5 branches r=7, ratio interne .42).
 */
function EuStars() {
  const points = (cx: number, cy: number, r: number) => {
    let pts = "";
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts += `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)} `;
      const a2 = a + Math.PI / 5;
      pts += `${cx + r * 0.42 * Math.cos(a2)},${cy + r * 0.42 * Math.sin(a2)} `;
    }
    return pts.trim();
  };
  const stars = Array.from({ length: 12 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 12;
    return points(50 + 34 * Math.cos(ang), 50 + 34 * Math.sin(ang), 7);
  });
  return (
    <span className="eu-stars" aria-hidden>
      <svg viewBox="0 0 100 100" width="38" height="38">
        {stars.map((p, i) => (
          <polygon key={i} points={p} fill="#e7b24a" />
        ))}
      </svg>
    </span>
  );
}

export default function InfraSouverainete() {
  return (
    <section className="infra">
      <div className="infra-grid" aria-hidden />
      <div className="infra-wrap">

        <div className="eyebrow">Infrastructure &amp; souveraineté</div>
        <h2>
          Héberger, stocker et communiquer<br />
          sans jamais quitter <em>l&apos;Union&nbsp;européenne.</em>
        </h2>
        <p className="lead">
          Chaque brique de buupp s&apos;appuie sur des partenaires <b>audités par des tiers</b> et
          opérés en Europe. Vos données restent sur le continent — du premier octet hébergé au
          dernier e-mail envoyé.
        </p>

        <div className="euband">
          <EuStars />
          <span className="txt">Résidence des données <b>100 % UE</b> · infrastructure auditée</span>
        </div>

        <div className="providers">

          {/* CLOUDFLARE */}
          <div className="infra-card">
            <div className="topline">
              <div className="tile" style={{ background: "linear-gradient(150deg,#fbbf6b,#f0860f)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M6.4 16.5h11.2a3 3 0 0 0 .5-5.96 4.4 4.4 0 0 0-8.2-1.7 3.3 3.3 0 0 0-4.9 2.9c0 .3 0 .6.1.9A2.95 2.95 0 0 0 6.4 16.5z" fill="#fff" opacity=".95" />
                  <path d="M9.5 16.5l1.7-4.2 3.6 1 .9-1.8" stroke="#f0860f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="res"><span className="pin" />Traitement UE</span>
            </div>
            <div className="role">Hébergement · Réseau · Bouclier</div>
            <div className="pname">Cloudflare</div>
            <div className="pdesc">L&apos;hébergeur et le <b>bouclier du site</b> : diffusion mondiale, filtrage des attaques et chiffrement de bout en bout, avec traitement des données dans l&apos;UE.</div>
            <div className="feats">
              <div className="feat"><span className="fi"><CheckIcon /></span>Chiffrement TLS de toutes les connexions</div>
              <div className="feat"><span className="fi"><CheckIcon /></span>Protection anti-DDoS &amp; pare-feu applicatif (WAF)</div>
              <div className="feat"><span className="fi"><CheckIcon /></span>Attaques filtrées avant d&apos;atteindre la plateforme</div>
            </div>
            <div className="certs">
              <div className="lab">Certifications</div>
              <div className="pills">
                <span className="pill">SOC 2 Type II</span>
                <span className="pill">ISO 27001</span>
                <span className="pill star"><LockIcon />ISO 27701</span>
                <span className="pill">PCI DSS</span>
              </div>
            </div>
            <div className="note"><span className="q">“</span><span>L&apos;ISO 27701, extension «&nbsp;vie privée&nbsp;» de l&apos;ISO 27001 — l&apos;atout d&apos;un site RGPD-native.</span></div>
          </div>

          {/* SUPABASE */}
          <div className="infra-card">
            <div className="topline">
              <div className="tile" style={{ background: "linear-gradient(150deg,#5cdca0,#1f9f63)" }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <ellipse cx="12" cy="6" rx="7" ry="2.6" fill="#fff" opacity=".95" />
                  <path d="M5 6v5c0 1.45 3.13 2.6 7 2.6s7-1.15 7-2.6V6" stroke="#fff" strokeWidth="1.5" opacity=".95" />
                  <path d="M5 11v5c0 1.45 3.13 2.6 7 2.6s7-1.15 7-2.6v-5" stroke="#fff" strokeWidth="1.5" opacity=".95" />
                  <path d="M12.4 8.6l-2.2 3.3h2l-.4 2.6 2.4-3.4h-2z" fill="#1f9f63" />
                </svg>
              </div>
              <span className="res"><span className="pin" />Région UE</span>
            </div>
            <div className="role">Base de données · PostgreSQL</div>
            <div className="pname">Supabase</div>
            <div className="pdesc">Le <b>stockage sécurisé</b> de la plateforme : données chiffrées et cloisonnées au niveau de la base elle-même, hébergées en région européenne.</div>
            <div className="feats">
              <div className="feat"><span className="fi"><CheckIcon /></span>Résidence des données dans l&apos;UE</div>
              <div className="feat"><span className="fi"><CheckIcon /></span>Chiffrement AES-256 au repos, TLS en transit</div>
              <div className="feat"><span className="fi"><CheckIcon /></span><span>Isolation par <b style={{ color: "#0F172A", fontWeight: 600, whiteSpace: "nowrap" }}>Row Level Security</b> — chacun ne voit que ses données</span></div>
            </div>
            <div className="certs">
              <div className="lab">Certifications</div>
              <div className="pills">
                <span className="pill">SOC 2 Type 2</span>
                <span className="pill star"><LockIcon />ISO/IEC 27001:2022</span>
                <span className="pill">PCI DSS</span>
                <span className="pill">HIPAA</span>
                <span className="pill">RGPD</span>
              </div>
            </div>
            <div className="note"><span className="q">“</span><span>ISO 27001 obtenue en avril 2026 — certification récente, auditée par tiers.</span></div>
          </div>

          {/* BREVO */}
          <div className="infra-card">
            <div className="topline">
              <div className="tile" style={{ background: "linear-gradient(150deg,#6f7cff,#3f3fd6)" }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M4 5.5l16 6.4-16 6.6 3.3-6.6L4 5.5z" fill="#fff" opacity=".96" />
                  <path d="M7.3 11.9L20 11.9" stroke="#3f3fd6" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
              <span className="res"><span className="pin" />FR · DE · BE</span>
            </div>
            <div className="role">Passerelle de communication</div>
            <div className="pname">Brevo</div>
            <div className="pdesc">La <b>passerelle d&apos;émission</b> : elle permet aux professionnels d&apos;appeler et d&apos;envoyer des e-mails depuis la plateforme, sans jamais exposer vos coordonnées.</div>
            <div className="feats">
              <div className="feat"><span className="fi"><CheckIcon /></span>Données hébergées exclusivement dans l&apos;UE</div>
              <div className="feat"><span className="fi"><CheckIcon /></span>Authentification multi-facteurs &amp; whitelisting IP</div>
              <div className="feat"><span className="fi"><CheckIcon /></span>Sauvegardes réparties sur 3 serveurs distincts</div>
            </div>
            <div className="certs">
              <div className="lab">Certifications</div>
              <div className="pills">
                <span className="pill star"><LockIcon />ISO/IEC 27001:2022</span>
                <span className="pill">RGPD</span>
              </div>
            </div>
            <div className="note"><span className="q">“</span><span>Sauvegardes géo-redondantes : France, Allemagne et Belgique — aucune donnée hors UE.</span></div>
          </div>

        </div>

        {/* bandeau d'assurance */}
        <div className="strip">
          <div className="scell">
            <div className="k">Résidence des données</div>
            <div className="resflags">
              <span className="flag"><i style={{ background: "linear-gradient(90deg,#0055a4 33%,#fff 33% 66%,#ef4135 66%)" }} />France</span>
              <span className="flag"><i style={{ background: "linear-gradient(180deg,#000 33%,#dd0000 33% 66%,#ffce00 66%)" }} />Allemagne</span>
              <span className="flag"><i style={{ background: "linear-gradient(180deg,#000 33%,#fae042 33% 66%,#ed2939 66%)" }} />Belgique</span>
            </div>
          </div>
          <div className="scell"><div className="k">Chiffrement</div><div className="v">AES-256 <small>au repos · TLS en transit</small></div></div>
          <div className="scell"><div className="k">Cloisonnement</div><div className="v">Row Level <small>Security native</small></div></div>
          <div className="scell"><div className="k">Audits tiers</div><div className="v">SOC 2 · ISO 27001<small> /27701</small></div></div>
        </div>

      </div>
    </section>
  );
}
