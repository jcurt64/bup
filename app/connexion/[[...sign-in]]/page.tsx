import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";
import { parseRole } from "@/lib/auth/postAuth";
import AuthConflictBanner from "@/app/_components/AuthConflictBanner";
import AuthShell from "@/app/_components/AuthShell";

export const metadata = {
  title: "Connexion",
  // Pas d'intérêt SEO : page d'auth, ne doit pas apparaître dans les SERP.
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  redirect_url?: string | string[];
  intent?: string | string[];
  conflict?: string | string[];
}>;

export default async function ConnexionPage(props: {
  searchParams: SearchParams;
}) {
  // Court-circuit pour les déjà-signés : on les envoie sur
  // /auth/post-login (avec intent si propagé) au lieu d'afficher le
  // formulaire SignIn. Évite que Clerk gère un user déjà connecté
  // avec sa propre logique qui peut perdre l'intent.
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const intent = parseRole(sp.intent);
  const conflict = parseRole(sp.conflict);
  const postLoginUrl = intent
    ? `/auth/post-login?intent=${intent}&mode=signin`
    : "/auth/post-login?mode=signin";

  const { userId } = await auth();
  // Conflit présent : l'utilisateur est déjà authentifié sur le
  // mauvais rôle → on NE redirige PAS vers post-login (boucle) et on
  // affiche la bannière à la place du widget.
  if (userId && !conflict) {
    redirect(target ?? postLoginUrl);
  }
  if (conflict) {
    return (
      <AuthShell>
        <AuthConflictBanner
          existingRole={conflict}
          intent={intent ?? (conflict === "pro" ? "prospect" : "pro")}
        />
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <SignIn
        path="/connexion"
        routing="path"
        signUpUrl={`/inscription/${intent ?? "prospect"}`}
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
    </AuthShell>
  );
}
