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

  // La suppression du cookie est déléguée à `RoleConflictToast` (qui appelle
  // une Server Action depuis useEffect). En Next.js 16, `cookies().delete()`
  // est interdit pendant le render d'un Server Component (seulement en
  // Server Action ou Route Handler).
  return (
    <>
      {conflictRole && <RoleConflictToast existingRole={conflictRole} />}
      <HomeClient />
    </>
  );
}
