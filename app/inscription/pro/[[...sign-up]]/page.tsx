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
        signInUrl="/connexion"
        // Cf. /inscription/prospect : forceRedirectUrl pour dominer les
        // env CLERK_SIGN_IN_FALLBACK_REDIRECT_URL quand Clerk convertit
        // signup → signin (email déjà utilisé). Aiguillage via
        // /auth/post-login + intent.
        forceRedirectUrl={target ?? "/auth/post-login?intent=pro"}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
