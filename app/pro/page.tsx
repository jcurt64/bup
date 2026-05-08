import { cookies } from "next/headers";
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

  return (
    <>
      <TopupReconciler />
      <PrototypeFrame route="pro" />
    </>
  );
}
