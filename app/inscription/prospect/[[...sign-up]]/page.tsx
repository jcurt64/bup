import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { clerkAuthAppearance } from "../../_clerkAppearance";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";
import { parseRole } from "@/lib/auth/postAuth";
import AuthConflictBanner from "@/app/_components/AuthConflictBanner";
import AuthShell from "@/app/_components/AuthShell";

export const metadata = {
  title: "Inscription prospect",
  // Pas d'intérêt SEO : page d'auth, ne doit pas apparaître dans les SERP.
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  redirect_url?: string | string[];
  conflict?: string | string[];
}>;

export default async function InscriptionProspectPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const conflict = parseRole(sp.conflict);

  const { userId } = await auth();
  if (userId && !conflict) {
    redirect("/auth/post-login?intent=prospect&mode=signup");
  }
  if (conflict) {
    return (
      <AuthShell>
        <AuthConflictBanner existingRole={conflict} intent="prospect" />
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <SignUp
        path="/inscription/prospect"
        routing="path"
        // signInUrl propage l'intent : Clerk peut renvoyer vers la
        // page de connexion (ex. email déjà pris) — /connexion lit
        // `?intent=prospect` et le passe à /auth/post-login.
        signInUrl="/connexion?intent=prospect"
        // forceRedirectUrl pour dominer les env Clerk même quand le
        // signup est auto-converti en signin sur la même page.
        forceRedirectUrl={target ?? "/auth/post-login?intent=prospect&mode=signup"}
        appearance={clerkAuthAppearance}
      />
    </AuthShell>
  );
}
