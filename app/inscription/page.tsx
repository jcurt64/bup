import Link from "next/link";

export const metadata = {
  title: "BUUPP — Inscription",
};

const cardStyle: React.CSSProperties = {
  display: "block",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: "28px 24px",
  boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .12)",
  textDecoration: "none",
  color: "var(--ink)",
  transition: "transform .15s ease, box-shadow .15s ease",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

function safeRedirect(raw: string | string[] | undefined): string | undefined {
  // Sécurise le redirect_url reçu en query param : on n'autorise que les
  // chemins relatifs (commençant par / mais pas //) pour éviter une
  // redirection ouverte vers un domaine externe.
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export default async function InscriptionAiguillagePage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const qs = target ? `?redirect_url=${encodeURIComponent(target)}` : "";
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1
          style={{
            fontFamily: "var(--font-fraunces, serif)",
            fontSize: 32,
            lineHeight: 1.15,
            marginBottom: 8,
          }}
        >
          Bienvenue sur BUUPP
        </h1>
        <p
          style={{
            color: "var(--ink-4, #5b6478)",
            marginBottom: 28,
          }}
        >
          Quel type de compte souhaitez-vous créer&nbsp;?
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <Link href={`/inscription/prospect${qs}`} style={cardStyle}>
            <div style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: 20, marginBottom: 6 }}>
              Je suis un particulier
            </div>
            <div style={{ color: "var(--ink-4, #5b6478)", fontSize: 14 }}>
              Soyez payé pour partager vos données — vous gardez le contrôle.
            </div>
          </Link>

          <Link href={`/inscription/pro${qs}`} style={cardStyle}>
            <div style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: 20, marginBottom: 6 }}>
              Je suis un professionnel
            </div>
            <div style={{ color: "var(--ink-4, #5b6478)", fontSize: 14 }}>
              Ciblez des prospects qui ont accepté votre offre.
            </div>
          </Link>
        </div>

        <p
          style={{
            marginTop: 24,
            fontSize: 13,
            color: "var(--ink-4, #5b6478)",
            textAlign: "center",
          }}
        >
          Déjà un compte ? <Link href="/connexion" style={{ color: "var(--ink)", textDecoration: "underline" }}>Se connecter</Link>
        </p>
      </div>
    </main>
  );
}
