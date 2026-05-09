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
        {...(target
          ? { forceRedirectUrl: target }
          : {
              // Cf. /inscription/prospect : on route via post-login pour
              // détecter un conflit silencieux quand Clerk auto-convertit
              // le signup en signin (email déjà utilisé par un prospect).
              fallbackRedirectUrl: "/auth/post-login?intent=pro",
            })}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
