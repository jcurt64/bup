/**
 * Garde d'accès au back-office BUUPP.
 *
 * Deux mécanismes coexistent :
 *
 *  1. **Clerk + allowlist d'emails** (`isAdminEmail`) — utilisé par les
 *     pages `/buupp-admin/**` et les Route Handlers `/api/admin/stats/**`,
 *     `/api/admin/events/**`. L'admin se connecte avec son compte Clerk
 *     normal ; le middleware vérifie que son email primaire figure dans
 *     l'env `ADMIN_EMAILS` (séparée par virgules, insensible à la casse).
 *
 *  2. **Header `x-admin-secret`** (`hasAdminSecret`) — utilisé pour les
 *     déclencheurs machine (cron Vercel pour les digests, scripts CLI).
 *     L'env `BUUPP_ADMIN_SECRET` doit être définie côté serveur.
 *
 * Politique fail-closed : si une env est manquante, l'accès est refusé.
 */

import { auth, currentUser } from "@/lib/clerk/server";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function hasAdminSecret(req: Request): boolean {
  const expected = process.env.BUUPP_ADMIN_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-secret");
  return Boolean(provided) && provided === expected;
}

/**
 * Garde Server Component / RSC. Lève `notFound()` (404) si non admin —
 * on ne révèle pas l'existence du dashboard à un user non habilité.
 */
export async function requireAdminUserOrNotFound(): Promise<{
  userId: string;
  email: string;
}> {
  const { notFound } = await import("next/navigation");
  const { userId } = await auth();
  if (!userId) notFound();
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress ?? null;
  if (!isAdminEmail(email)) notFound();
  return { userId: userId!, email: email! };
}

/**
 * Garde Route Handler. Accepte EITHER `x-admin-secret` (machine) EITHER
 * un user Clerk dont l'email est dans l'allowlist. Renvoie une `Response`
 * 404 si refus, sinon `null`.
 *
 *   const denied = await requireAdminRequest(req);
 *   if (denied) return denied;
 */
export async function requireAdminRequest(req: Request): Promise<Response | null> {
  if (hasAdminSecret(req)) return null;
  const { userId } = await auth();
  if (!userId) return new Response("Not Found", { status: 404 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress ?? null;
  if (!isAdminEmail(email)) return new Response("Not Found", { status: 404 });
  return null;
}
