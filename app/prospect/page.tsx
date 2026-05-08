import { cookies } from "next/headers";
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
      // Pose le cookie flash lu par app/page.tsx pour afficher un toast.
      // 60s suffisent largement pour une redirection immédiate.
      const c = await cookies();
      c.set("role_conflict", err.existingRole, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
      redirect("/");
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
