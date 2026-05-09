import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";

export const metadata = {
  title: "BUUPP — Inscription pro",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

export default async function InscriptionProPage(props: {
  searchParams: SearchParams;
}) {
  // Cf. /inscription/prospect : on court-circuite Clerk si l'utilisateur
  // est déjà signé pour éviter qu'il se débrouille avec sa logique
  // interne d'auto-conversion qui peut perdre l'intent.
  const { userId } = await auth();
  if (userId) {
    redirect("/auth/post-login?intent=pro");
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
