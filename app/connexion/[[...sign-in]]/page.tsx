import { SignIn } from "@clerk/nextjs";
import { safeRedirect } from "@/lib/auth/safeRedirect";

export const metadata = {
  title: "BUUPP — Connexion",
};

type SearchParams = Promise<{
  redirect_url?: string | string[];
  intent?: string | string[];
}>;

function parseIntent(raw: string | string[] | undefined): "prospect" | "pro" | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "prospect" || v === "pro") return v;
  return null;
}

export default async function ConnexionPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  // L'intent est propagé depuis /inscription/{prospect,pro} quand Clerk
  // renvoie sur /connexion (typiquement quand l'email existe déjà). On
  // le repasse à /auth/post-login pour qu'il puisse détecter une
  // contradiction intent vs rôle DB.
  const intent = parseIntent(sp.intent);
  const postLoginUrl = intent
    ? `/auth/post-login?intent=${intent}`
    : "/auth/post-login";
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
      <SignIn
        path="/connexion"
        routing="path"
        signUpUrl="/inscription"
        // forceRedirectUrl (pas fallback) pour dominer les env vars
        // qui peuvent prendre le pas dans certaines transitions Clerk
        // internes. Cible : /auth/post-login → aiguillage par rôle DB.
        forceRedirectUrl={target ?? postLoginUrl}
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
            // Boutons sociaux (Google / Apple / Facebook…) — alignés sur le design BUUPP
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
