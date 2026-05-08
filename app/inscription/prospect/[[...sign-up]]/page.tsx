import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";

export const metadata = {
  title: "BUUPP — Inscription prospect",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

// Sécurise le redirect_url reçu en query param : on n'autorise que les
// chemins relatifs (commençant par / mais pas //) pour éviter une
// redirection ouverte vers un domaine externe.
function safeRedirect(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

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
          : { fallbackRedirectUrl: "/prospect" })}
        appearance={clerkAuthAppearance}
      />
    </main>
  );
}
