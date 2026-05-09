import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";
import { safeRedirect } from "@/lib/auth/safeRedirect";

export const metadata = {
  title: "BUUPP — Inscription pro",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

export default async function InscriptionProPage(props: {
  searchParams: SearchParams;
}) {
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
        path="/inscription/pro"
        routing="path"
        // signInUrl propage l'intent : si Clerk redirige vers la page
        // de connexion (typiquement quand l'email est déjà pris),
        // /connexion lit `?intent=pro` et le passe à /auth/post-login
        // pour qu'il puisse détecter une éventuelle contradiction
        // intent vs rôle DB.
        signInUrl="/connexion?intent=pro"
        // forceRedirectUrl pour dominer les env Clerk même quand le
        // signup est auto-converti en signin sur la même page.
        forceRedirectUrl={target ?? "/auth/post-login?intent=pro"}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
