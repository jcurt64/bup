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
