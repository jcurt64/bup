import Link from "next/link";
import { safeRedirect } from "@/lib/auth/safeRedirect";

export const metadata = {
  title: "BUUPP — Inscription",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

// Palette empruntée à l'email de sollicitation (lib/email/relation.ts) :
// bleu BUUPP → violet, ambre, rose/lavande, vert. Réutilisée ici pour
// donner à l'aiguillage la même chaleur que les emails que les prospects
// reçoivent.
const COLOR = {
  ink: "#0F1629",
  paper: "#FFFEF8",
  ivory: "#F7F4EC",
  line: "#EAE3D0",
  blue: "#4596EC",
  indigo: "#6D5BFF",
  purple: "#7C3AED",
  amber: "#F59E0B",
  amberDeep: "#B45309",
  green: "#10B981",
  pink: "#FFEDF6",
  lavender: "#F3EAFF",
  cream: "#FAF6E8",
};

// CSS responsive : grid 1 colonne en mobile, 2 colonnes ≥ 720 px.
// Variables clamp() pour une typo / padding fluides.
const PAGE_CSS = `
.ins-page {
  --pad-x: clamp(16px, 5vw, 32px);
  position: relative;
  min-height: 100vh;
  padding: 24px var(--pad-x) 80px;
  background: ${COLOR.ivory};
  overflow-x: hidden;
}
.ins-shell { position: relative; z-index: 2; max-width: 920px; margin: 0 auto; }
.ins-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 28px;
}
.ins-back {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px;
  background: ${COLOR.paper}; border: 1px solid ${COLOR.line};
  color: ${COLOR.ink}; text-decoration: none;
  font-size: 14px; font-weight: 500;
  box-shadow: 0 4px 14px -8px rgba(15,22,41,.15);
}
.ins-back:hover { background: ${COLOR.cream}; }
.ins-brand {
  font-family: var(--font-fraunces, Georgia, serif);
  font-size: 22px; font-weight: 500; letter-spacing: -.01em;
  color: ${COLOR.ink};
}
.ins-h1 {
  font-family: var(--font-fraunces, Georgia, serif);
  font-size: clamp(28px, 6vw, 40px);
  line-height: 1.1; margin: 0 0 12px;
  letter-spacing: -.015em; color: ${COLOR.ink};
}
.ins-h1 em { font-style: italic; color: ${COLOR.purple}; }
.ins-sub {
  margin: 0 0 32px; font-size: clamp(14px, 3.6vw, 17px);
  line-height: 1.5; color: #3A4150; max-width: 620px;
}
.ins-cards {
  display: grid; gap: 18px;
  grid-template-columns: 1fr;
  align-items: stretch;
}
@media (min-width: 720px) {
  .ins-cards { grid-template-columns: 1fr 1fr; gap: 22px; }
}
.ins-card {
  position: relative;
  display: flex; flex-direction: column;
  min-height: 360px;
  background: ${COLOR.paper};
  border: 1px solid ${COLOR.line};
  border-radius: 20px;
  padding: 32px 28px 26px;
  text-decoration: none; color: ${COLOR.ink};
  box-shadow: 0 18px 48px -16px rgba(15,22,41,.14);
  overflow: hidden;
  transition: transform .15s ease, box-shadow .15s ease;
}
.ins-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 52px -14px rgba(15,22,41,.18);
}
.ins-card-halo {
  position: absolute; inset: 0 0 auto 0; height: 130px;
  opacity: .85; pointer-events: none;
  border-top-left-radius: 20px; border-top-right-radius: 20px;
}
.ins-card-shapes {
  position: absolute; top: 18px; right: 18px;
  display: flex; gap: 6px; align-items: center;
}
.ins-card-pastille {
  position: relative; z-index: 1;
  width: 60px; height: 60px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; margin-bottom: 28px;
  box-shadow: 0 6px 18px -6px rgba(15,22,41,.25);
}
.ins-card-title {
  position: relative; z-index: 1;
  font-family: var(--font-fraunces, Georgia, serif);
  font-size: 23px; line-height: 1.25;
  margin: 0 0 12px; color: ${COLOR.ink}; letter-spacing: -.01em;
}
.ins-card-tagline {
  position: relative; z-index: 1;
  margin: 0 0 32px; font-size: 14.5px; line-height: 1.6; color: #3A4150;
}
.ins-card-foot {
  position: relative; z-index: 1;
  margin-top: auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: nowrap;
}
.ins-card-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px; border-radius: 999px;
  font-size: 11.5px; letter-spacing: .05em;
  text-transform: uppercase; font-weight: 600;
  white-space: nowrap;
  flex: 0 1 auto; min-width: 0;
}
.ins-card-cta {
  flex: 0 0 38px;
  width: 38px; height: 38px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px;
  box-shadow: 0 6px 18px -6px rgba(15,22,41,.3);
}
.ins-foot {
  margin-top: 32px; display: flex;
  justify-content: center; align-items: center; gap: 10px;
  color: #6B7180; font-size: 14px;
}
.ins-foot a {
  color: ${COLOR.purple}; text-decoration: underline;
  text-underline-offset: 3px; font-weight: 500;
}
.ins-cluster {
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
/* Très petits écrans : on resserre le badge et la flèche pour rester
   sur une ligne sans wrap, et on raccourcit légèrement la taille du
   texte du badge. */
@media (max-width: 400px) {
  .ins-card { padding: 26px 22px 22px; min-height: 340px; }
  .ins-card-badge { font-size: 10.5px; padding: 6px 11px; letter-spacing: .04em; }
  .ins-card-cta { flex-basis: 34px; width: 34px; height: 34px; }
  .ins-card-foot { gap: 10px; }
}
`;

export default async function InscriptionAiguillagePage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const qs = target ? `?redirect_url=${encodeURIComponent(target)}` : "";
  return (
    <main className="ins-page">
      <style>{PAGE_CSS}</style>

      {/* Formes décoratives flottantes en arrière-plan */}
      <DecorBackdrop />

      {/* Header : retour + logo */}
      <header className="ins-header ins-shell" style={{ marginBottom: 28 }}>
        <Link href="/" aria-label="Retour à l'accueil" className="ins-back">
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>←</span>
          Retour
        </Link>
        <span className="ins-brand">BUUPP</span>
      </header>

      {/* Carte centrale */}
      <section className="ins-shell">
        {/* Cluster de formes en accent au-dessus du titre, comme dans
            l'en-tête de l'email de sollicitation. */}
        <div aria-hidden className="ins-cluster">
          <span style={dotShape(COLOR.blue, 14)} />
          <span style={diamondShape(COLOR.purple, 10)} />
          <span style={triangleShape(COLOR.amber, 12)} />
          <span style={dotShape(COLOR.green, 8)} />
        </div>

        <h1 className="ins-h1">
          Bienvenue sur <em>BUUPP</em>
        </h1>
        <p className="ins-sub">
          Quel type de compte souhaitez-vous créer&nbsp;? Une adresse e-mail =
          un seul compte (prospect ou professionnel).
        </p>

        <div className="ins-cards">
          <RoleCard
            href={`/inscription/prospect${qs}`}
            kind="prospect"
            title="Je suis un particulier"
            tagline="Soyez payé pour partager vos données — vous gardez le contrôle."
            badge="🎁 Récompense à la mise en relation"
            gradient={`linear-gradient(135deg, ${COLOR.blue} 0%, ${COLOR.indigo} 60%, ${COLOR.purple} 100%)`}
            soft={`linear-gradient(135deg, #E8F0FE 0%, ${COLOR.lavender} 100%)`}
          />

          <RoleCard
            href={`/inscription/pro${qs}`}
            kind="pro"
            title="Je suis un professionnel"
            tagline="Ciblez des prospects qui ont déjà accepté votre offre."
            badge="◆ Campagnes haute qualité"
            gradient={`linear-gradient(135deg, ${COLOR.amber} 0%, #F97316 60%, ${COLOR.amberDeep} 100%)`}
            soft={`linear-gradient(135deg, ${COLOR.cream} 0%, ${COLOR.pink} 100%)`}
          />
        </div>

        <div className="ins-foot">
          <span aria-hidden style={dotShape("#C9D2E0", 4)} />
          <span>
            Déjà un compte ?{" "}
            <Link href="/connexion">Se connecter</Link>
          </span>
          <span aria-hidden style={dotShape("#C9D2E0", 4)} />
        </div>
      </section>
    </main>
  );
}

/* ─── RoleCard ──────────────────────────────────────────────────────────── */

function RoleCard({
  href,
  kind,
  title,
  tagline,
  badge,
  gradient,
  soft,
}: {
  href: string;
  kind: "prospect" | "pro";
  title: string;
  tagline: string;
  badge: string;
  gradient: string;
  soft: string;
}) {
  return (
    <Link href={href} className="ins-card">
      {/* Halo soft en arrière-plan haut */}
      <div aria-hidden className="ins-card-halo" style={{ background: soft }} />

      {/* Cluster de formes en haut-droite, façon email de sollicitation */}
      <div aria-hidden className="ins-card-shapes">
        {kind === "prospect" ? (
          <>
            <span style={dotShape(COLOR.blue, 12)} />
            <span style={diamondShape(COLOR.purple, 9)} />
          </>
        ) : (
          <>
            <span style={triangleShape(COLOR.amber, 11)} />
            <span style={dotShape(COLOR.amberDeep, 9)} />
          </>
        )}
      </div>

      {/* Pastille gradient + emoji */}
      <div className="ins-card-pastille" style={{ background: gradient }} aria-hidden>
        {kind === "prospect" ? "👤" : "💼"}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "rgba(255,255,255,.35)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: -4,
            left: -4,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,.22)",
          }}
        />
      </div>

      <div className="ins-card-title">{title}</div>
      <p className="ins-card-tagline">{tagline}</p>

      <div className="ins-card-foot">
        <span
          className="ins-card-badge"
          style={{
            background: kind === "prospect" ? COLOR.lavender : COLOR.cream,
            border: `1px solid ${kind === "prospect" ? "#C9B5F2" : COLOR.line}`,
            color: kind === "prospect" ? "#3F2670" : COLOR.amberDeep,
          }}
        >
          {badge}
        </span>
        <span className="ins-card-cta" style={{ background: gradient }} aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

/* ─── Decor : formes flottantes d'arrière-plan ─────────────────────────── */

function DecorBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Grand cercle bleu→violet en haut à gauche */}
      <span
        style={{
          position: "absolute",
          top: -80,
          left: -60,
          width: 220,
          height: 220,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${COLOR.blue} 0%, ${COLOR.purple} 100%)`,
          opacity: 0.18,
          filter: "blur(2px)",
        }}
      />
      {/* Halo ambre en bas à droite */}
      <span
        style={{
          position: "absolute",
          bottom: -80,
          right: -50,
          width: 260,
          height: 260,
          borderRadius: 999,
          background: `radial-gradient(circle at 30% 30%, ${COLOR.amber} 0%, rgba(245,158,11,0) 70%)`,
          opacity: 0.55,
        }}
      />
      {/* Triangle vert flottant (top right) */}
      <span
        style={{
          position: "absolute",
          top: 60,
          right: "8%",
          ...triangleShape(COLOR.green, 22),
          opacity: 0.55,
        }}
      />
      {/* Losange violet (mid-left) */}
      <span
        style={{
          position: "absolute",
          top: "40%",
          left: "4%",
          ...diamondShape(COLOR.purple, 14),
          opacity: 0.5,
        }}
      />
      {/* Petit cercle bleu (bottom left) */}
      <span
        style={{
          position: "absolute",
          bottom: "12%",
          left: "10%",
          ...dotShape(COLOR.blue, 18),
          opacity: 0.55,
        }}
      />
    </div>
  );
}

/* ─── Helpers de formes (CSS-only, pas d'images) ───────────────────────── */

function dotShape(color: string, size: number): React.CSSProperties {
  return {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: 999,
    background: color,
  };
}

function diamondShape(color: string, size: number): React.CSSProperties {
  return {
    display: "inline-block",
    width: size,
    height: size,
    background: color,
    transform: "rotate(45deg)",
  };
}

function triangleShape(color: string, size: number): React.CSSProperties {
  // Triangle équilatéral pointant vers le haut, via la ruse du border.
  return {
    display: "inline-block",
    width: 0,
    height: 0,
    borderLeft: `${size / 2}px solid transparent`,
    borderRight: `${size / 2}px solid transparent`,
    borderBottom: `${size}px solid ${color}`,
  };
}
