import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/clerk/server";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import { getCurrentRole } from "@/lib/sync/currentRole";
import PrototypeFrame from "../_components/PrototypeFrame";
import TopupReconciler from "../_components/TopupReconciler";
import CardSetupReconciler from "../_components/CardSetupReconciler";
import { PROTOTYPE_VERSION } from "@/lib/prototype/version";

export const metadata = {
  title: "BUUPP — Espace Pro",
};

export default async function ProPage() {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");

  // `getCurrentRole` (lecture Supabase) et `currentUser` (API Clerk)
  // sont indépendants → lancés en parallèle (cf. /prospect, même
  // optimisation). L'ordre des gardes reste identique.
  const [existingRole, user] = await Promise.all([
    getCurrentRole(userId),
    currentUser(),
  ]);

  // Garde serveur stricte : si l'utilisateur a déjà un rôle prospect
  // (accès direct à /pro depuis l'URL ou bouton non gardé), on bloque
  // immédiatement et on renvoie vers la home avec le toast de conflit.
  // Une row prospect peut subsister en legacy même quand le trigger
  // d'exclusivité de rôle est en place — ce check ne s'y fie pas.
  if (existingRole === "prospect") {
    redirect("/?role_conflict=prospect");
  }

  const primary = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  );

  try {
    await ensureRole(userId, primary?.emailAddress ?? null, "pro");
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

  return (
    <>
      <TopupReconciler />
      <CardSetupReconciler />
      <PrototypeFrame route="pro" version={PROTOTYPE_VERSION} />
    </>
  );
}
