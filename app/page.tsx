import HomeClient from "./_components/HomeClient";
import RoleConflictToast from "./_components/RoleConflictToast";

type Role = "prospect" | "pro";

type SearchParams = Promise<{ role_conflict?: string | string[] }>;

export default async function HomePage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.role_conflict) ? sp.role_conflict[0] : sp.role_conflict;
  const conflictRole: Role | null = raw === "prospect" || raw === "pro" ? raw : null;

  return (
    <>
      {conflictRole && <RoleConflictToast existingRole={conflictRole} />}
      <HomeClient />
    </>
  );
}
