import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "BUUPP — Inscription",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

// Sécurise le `redirect_url` reçu en query param : on n'autorise que les
// chemins relatifs commençant par `/` (et pas `//`) pour éviter une
// redirection ouverte vers un domaine externe.
function safeRedirect(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export default async function InscriptionPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  // Quand un `redirect_url` valide est fourni (ex. depuis la modale d'un
  // flash deal sur la home), on l'impose en `forceRedirectUrl` — il
  // surcharge le `fallbackRedirectUrl` côté Clerk. Sinon, on retombe sur
  // /prospect (comportement par défaut).
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
      <SignUp
        path="/inscription"
        routing="path"
        signInUrl="/connexion"
        {...(target
          ? { forceRedirectUrl: target }
          : { fallbackRedirectUrl: "/prospect" })}
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 440 },
            card: {
              background: "var(--paper)",
              borderRadius: 16,
              boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
              border: "1px solid var(--line)",
            },
            headerTitle: { fontFamily: "var(--font-fraunces, serif)" },
            formButtonPrimary: {
              background: "var(--ink)",
              "&:hover, &:focus, &:active": { background: "#1a2342" },
            },
            socialButtonsBlockButton: {
              border: "1px solid var(--line)",
              borderRadius: 10,
              "&:hover, &:focus": {
                background: "var(--ivory-2, #efe9da)",
                borderColor: "var(--ink-4, #5b6478)",
              },
            },
            socialButtonsBlockButtonText: {
              fontWeight: 500,
            },
            dividerLine: { background: "var(--line)" },
            dividerText: { color: "var(--ink-4, #5b6478)" },
          },
          variables: {
            colorPrimary: "#0F1629",
            colorText: "#0F1629",
            colorTextSecondary: "#5b6478",
            borderRadius: "10px",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          },
        }}
      />
    </main>
  );
}
