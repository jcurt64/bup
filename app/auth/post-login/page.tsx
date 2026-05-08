import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Role = "prospect" | "pro";

export default async function PostLoginPage() {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  const user = await currentUser();
  const cached = (user?.publicMetadata as { role?: Role } | undefined)?.role;

  if (cached === "prospect") redirect("/prospect");
  if (cached === "pro") redirect("/pro");

  // Fallback DB : signup interrompu avant ensureRole, ou metadata pas
  // encore propagée par Clerk. On lit la vérité côté Supabase.
  const admin = createSupabaseAdminClient();
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);

  const dbRole: Role | null = proRow ? "pro" : prospectRow ? "prospect" : null;

  if (dbRole) {
    // Resync Clerk metadata avant la redirection (le client lira correctement
    // au prochain render). Read-merge-write pour ne pas écraser les autres clés.
    try {
      const client = await clerkClient();
      const merged = {
        ...((user?.publicMetadata as Record<string, unknown> | null | undefined) ?? {}),
        role: dbRole,
      };
      await client.users.updateUser(userId, { publicMetadata: merged });
    } catch (err) {
      console.error("[/auth/post-login] failed to resync publicMetadata", err);
    }
    redirect(dbRole === "pro" ? "/pro" : "/prospect");
  }

  // User Clerk valide mais sans rôle (rare : tab fermé entre signup et
  // /prospect|/pro). On l'envoie sur l'aiguillage pour qu'il choisisse.
  redirect("/inscription");
}
