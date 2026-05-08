import { cookies } from "next/headers";
import HomeClient from "./_components/HomeClient";
import RoleConflictToast from "./_components/RoleConflictToast";

type Role = "prospect" | "pro";

export default async function HomePage() {
  const c = await cookies();
  const conflictCookie = c.get("role_conflict");
  const conflictRole: Role | null =
    conflictCookie?.value === "prospect" || conflictCookie?.value === "pro"
      ? conflictCookie.value
      : null;

  // Cookie flash : on supprime après lecture pour qu'il ne réapparaisse
  // pas au prochain reload de /.
  if (conflictRole) {
    c.delete("role_conflict");
  }

  return (
    <>
      {conflictRole && <RoleConflictToast existingRole={conflictRole} />}
      <HomeClient />
    </>
  );
}
