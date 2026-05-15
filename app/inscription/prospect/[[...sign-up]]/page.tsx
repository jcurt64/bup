import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";

export const metadata = {
  title: "Inscription prospect",
  // Pas d'intérêt SEO : page d'auth, ne doit pas apparaître dans les SERP.
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

export default async function InscriptionProspectPage(props: {
  searchParams: SearchParams;
}) {
  // Si l'utilisateur est DÉJÀ authentifié quand il arrive ici (session
  // Clerk persistée d'un précédent flow, navigation depuis le footer,
  // etc.), on n'affiche PAS le <SignUp> — on l'envoie directement à
  // /auth/post-login qui aiguille par rôle DB. Évite que Clerk gère
  // lui-même l'auto-conversion (qui peut perdre l'intent dans l'URL).
  const { userId } = await auth();
  if (userId) {
    redirect("/auth/post-login?intent=prospect");
  }

  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
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
        path="/inscription/prospect"
        routing="path"
        // signInUrl propage l'intent : Clerk peut renvoyer vers la
        // page de connexion (ex. email déjà pris) — /connexion lit
        // `?intent=prospect` et le passe à /auth/post-login.
        signInUrl="/connexion?intent=prospect"
        // forceRedirectUrl pour dominer les env Clerk même quand le
        // signup est auto-converti en signin sur la même page.
        forceRedirectUrl={target ?? "/auth/post-login?intent=prospect"}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
