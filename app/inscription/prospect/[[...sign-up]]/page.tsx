import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";
import { safeRedirect } from "@/lib/auth/safeRedirect";

export const metadata = {
  title: "BUUPP — Inscription prospect",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

export default async function InscriptionProspectPage(props: {
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
        path="/inscription/prospect"
        routing="path"
        signInUrl="/connexion"
        // forceRedirectUrl (pas fallback) pour dominer même les env
        // CLERK_SIGN_IN_FALLBACK_REDIRECT_URL, qui prennent la main
        // quand Clerk convertit le SignUp en SignIn (email déjà pris).
        // Cible : /auth/post-login qui valide le rôle DB et envoie
        // sur le bon espace ou sur la home avec toast role_conflict.
        forceRedirectUrl={target ?? "/auth/post-login?intent=prospect"}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
