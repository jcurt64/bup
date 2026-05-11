/**
 * /api/me — infos minimales sur l'utilisateur connecté + suppression de compte.
 *
 *   GET    → { prenom, nom, email, initials, role, displayName }
 *            role peut être null (utilisateur Clerk valide mais inscription
 *            interrompue avant /prospect ou /pro).
 *            Utilisé par le header du dashboard pour afficher les vraies
 *            initiales à la place du placeholder "ML"/"AM".
 *
 *   DELETE → supprime DÉFINITIVEMENT :
 *              1. la row `prospects` (cascade → tous les paliers)
 *              2. la row `pro_accounts` (cascade → campagnes/relations)
 *              3. la row `waitlist` éventuelle (même email)
 *              4. l'utilisateur Clerk (le webhook `user.deleted` ré-appelle
 *                 deleteProspect mais c'est idempotent)
 *            La perte de solde est implicite — toutes les rows liées au
 *            wallet (transactions, etc.) tombent via les cascades existantes.
 */

import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function makeInitials(prenom: string | null, nom: string | null, fallback: string): string {
  const a = (prenom || "").trim();
  const b = (nom || "").trim();
  const fromName = (a[0] || "") + (b[0] || "");
  if (fromName.length >= 1) return fromName.slice(0, 2).toUpperCase();
  // Fallback : 2 premières lettres alpha de l'email/raison sociale.
  const cleaned = fallback.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return (cleaned.slice(0, 2) || "?").toUpperCase();
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const admin = createSupabaseAdminClient();

  // DB = source de vérité. Depuis la migration 20260508140000, un userId
  // ne peut avoir qu'un seul rôle (trigger d'exclusivité). Si une legacy
  // row "double profil" persiste, on privilégie "pro" par prudence.
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin
      .from("pro_accounts")
      .select("raison_sociale")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
    admin
      .from("prospects")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
  ]);

  // Email côté prospect : on lit la copie stockée dans `prospect_identity`
  // (alimentée par `ensureProspect` à la première visite). Évite de dépendre
  // de Clerk côté front pour un champ qui est aussi en base. Fallback Clerk
  // si la row palier 1 n'existe pas encore (cas marginal d'une création
  // partielle). Côté pro, aucune colonne email n'est persistée → Clerk reste
  // l'unique source.
  let dbEmail: string | null = null;
  if (prospectRow?.id) {
    const { data: identity } = await admin
      .from("prospect_identity")
      .select("email")
      .eq("prospect_id", prospectRow.id)
      .maybeSingle();
    dbEmail = identity?.email ?? null;
  }
  const resolvedEmail = dbEmail ?? email;

  // Récupère prénom/nom depuis Clerk d'abord, fallback sur la row waitlist
  // pour les utilisateurs qui se sont inscrits via la liste d'attente avant
  // d'avoir un compte Clerk avec firstName/lastName renseignés.
  let prenom = (user?.firstName || "").trim() || null;
  let nom = (user?.lastName || "").trim() || null;

  if ((!prenom || !nom) && email) {
    const { data: wl } = await admin
      .from("waitlist")
      .select("prenom, nom")
      .ilike("email", email)
      .maybeSingle();
    if (wl) {
      prenom = prenom || wl.prenom;
      nom = nom || wl.nom;
    }
  }

  // Mutuellement exclusif depuis la migration 20260508140000.
  // `role === null` = utilisateur Clerk valide mais qui n'a pas encore
  // finalisé son inscription (tab fermé entre signup et /prospect|/pro).
  const role: "pro" | "prospect" | null =
    proRow ? "pro" : prospectRow ? "prospect" : null;

  let displayName: string;
  let initials: string;

  if (role === "pro" && proRow?.raison_sociale) {
    displayName = proRow.raison_sociale;
    const parts = proRow.raison_sociale.split(/\s+/).filter(Boolean);
    initials = makeInitials(parts[0] ?? null, parts[1] ?? null, proRow.raison_sociale);
  } else {
    displayName = `${prenom ?? ""} ${nom ?? ""}`.trim() || email || "Utilisateur";
    initials = makeInitials(prenom, nom, email ?? displayName);
  }

  // Resync défensif du cache Clerk : si la DB a un rôle mais que Clerk
  // ne le sait pas (ou vice versa), on aligne sur la DB (source de vérité).
  const cachedRole = (user?.publicMetadata as { role?: "prospect" | "pro" } | undefined)?.role;
  if (role !== null && cachedRole !== role) {
    try {
      const client = await clerkClient();
      // Merge avec les autres clés déjà présentes (cache de `currentUser()`,
      // pas de round-trip Clerk supplémentaire).
      const merged = {
        ...((user?.publicMetadata as Record<string, unknown> | null | undefined) ?? {}),
        role,
      };
      await client.users.updateUser(userId, { publicMetadata: merged });
    } catch (err) {
      console.error("[/api/me] failed to resync Clerk publicMetadata", err);
    }
  }

  return NextResponse.json({
    prenom,
    nom,
    email: resolvedEmail,
    initials,
    role,
    displayName,
    // hasProspectProfile / hasProProfile retirés — mutuellement exclusifs
    // désormais. Les consommateurs lisent `role` directement.
  });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const admin = createSupabaseAdminClient();

  // Suppression Supabase EN PREMIER — si Clerk échoue ensuite, l'utilisateur
  // garde son compte Clerk mais sans données métier (état dégradé acceptable :
  // il peut réessayer la suppression Clerk depuis son profil ou nous contacter).
  const dbErrors: string[] = [];

  const { error: errProspect } = await admin
    .from("prospects")
    .delete()
    .eq("clerk_user_id", userId);
  if (errProspect) dbErrors.push("prospects: " + errProspect.message);

  const { error: errPro } = await admin
    .from("pro_accounts")
    .delete()
    .eq("clerk_user_id", userId);
  if (errPro) dbErrors.push("pro_accounts: " + errPro.message);

  if (email) {
    const { error: errWaitlist } = await admin
      .from("waitlist")
      .delete()
      .ilike("email", email);
    if (errWaitlist) dbErrors.push("waitlist: " + errWaitlist.message);
  }

  if (dbErrors.length > 0) {
    console.error("[/api/me DELETE] Supabase errors:", dbErrors);
    return NextResponse.json(
      { error: "supabase_delete_failed", details: dbErrors },
      { status: 500 },
    );
  }

  // Suppression Clerk — déclenche le webhook `user.deleted` qui ré-appelle
  // deleteProspect (idempotent puisque déjà supprimé ci-dessus).
  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (err) {
    console.error("[/api/me DELETE] Clerk delete failed:", err);
    return NextResponse.json(
      { error: "clerk_delete_failed", message: "Suppression du compte échouée." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
