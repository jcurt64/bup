import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import PrototypeFrame from "../_components/PrototypeFrame";

export const metadata = { title: "BUUPP — Espace Prospect" };

const VALID_TABS = new Set([
  "portefeuille", "donnees", "relations", "verif", "score",
  "prefs", "parrainage", "fiscal",
]);

type SearchParams = Promise<{ tab?: string }>;

export default async function ProspectPage(props: { searchParams: SearchParams }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");

  const user = await currentUser();
  const primary = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  );

  try {
    await ensureRole(userId, primary?.emailAddress ?? null, "prospect", {
      prenom: user?.firstName ?? null,
      nom: user?.lastName ?? null,
    });
  } catch (err) {
    if (err instanceof RoleConflictError) {
      // Signale le conflit de rôle via query param (Next.js 16 interdit
      // cookies().set() pendant le render d'un Server Component). La
      // home lit searchParams.role_conflict et affiche un toast ; le
      // toast strippe le param via router.replace au montage pour un
      // comportement one-shot.
      redirect(`/?role_conflict=${err.existingRole}`);
    }
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, bupp_score, verification, created_at")
    .single();
  if (error) {
    console.error("[/prospect] Lecture RLS échouée :", error);
  } else {
    console.log("[/prospect] Pont Clerk↔Supabase OK → prospect", prospect.id);
  }

  const sp = await props.searchParams;
  const tab = sp.tab && VALID_TABS.has(sp.tab) ? sp.tab : null;

  return <PrototypeFrame route="prospect" tab={tab} />;
}
