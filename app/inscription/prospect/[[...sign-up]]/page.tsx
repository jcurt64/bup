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
        {...(target
          ? { forceRedirectUrl: target }
          : {
              // On passe par /auth/post-login pour faire valider le
              // rôle DB avant d'aiguiller — un user dont l'email existe
              // déjà comme pro voit Clerk auto-convertir le signup en
              // signin, et atterrirait sinon sur /prospect blanc avant
              // que la garde page-level ait pu rediriger. L'intent
              // "prospect" est passé pour que post-login détecte la
              // contradiction et affiche le toast role_conflict.
              fallbackRedirectUrl: "/auth/post-login?intent=prospect",
            })}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
