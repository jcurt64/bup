import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
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
  await ensureProspect({
    clerkUserId: userId,
    email: primary?.emailAddress ?? null,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

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
