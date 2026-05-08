import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/clerk/server";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import PrototypeFrame from "../_components/PrototypeFrame";
import TopupReconciler from "../_components/TopupReconciler";

export const metadata = {
  title: "BUUPP — Espace Pro",
};

export default async function ProPage() {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");

  const user = await currentUser();
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
      <PrototypeFrame route="pro" />
    </>
  );
}
