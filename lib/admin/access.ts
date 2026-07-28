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
 *     déclencheurs machine (scripts CLI, curl).
 *     L'env `BUUPP_ADMIN_SECRET` doit être définie côté serveur.
 *
 *  3. **Cron Vercel** (`hasCronAuthorization`) — la plateforme appelle le
 *     endpoint sans en-tête maison ; cf. le commentaire de la fonction.
 *
 * Politique fail-closed : si une env est manquante, l'accès est refusé.
 */

import { notFound } from "next/navigation";
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
  const provided =
    req.headers.get("x-admin-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return Boolean(provided) && provided === expected;
}

/**
 * Autorise une invocation de cron Vercel.
 *
 * Vercel appelle les crons en **GET**, sans header maison : le secret
 * `x-admin-secret` ne peut donc pas être transmis. Trois voies acceptées,
 * de la plus forte à la plus faible :
 *
 *  1. `hasAdminSecret` — déclenchement manuel (curl, script).
 *  2. `Authorization: Bearer $CRON_SECRET` — Vercel ajoute cet en-tête
 *     automatiquement dès que l'env `CRON_SECRET` est définie sur le
 *     projet. C'est la voie recommandée : la définir suffit.
 *  3. En-tête `x-vercel-cron` — posé par la plateforme sur les
 *     invocations de cron. Repli utilisé UNIQUEMENT si `CRON_SECRET`
 *     n'est pas définie, pour que le cron ne soit jamais silencieusement
 *     inopérant faute d'env. Dès que l'env existe, on exige la preuve
 *     forte : un en-tête seul ne suffit plus.
 */
export function hasCronAuthorization(req: Request): boolean {
  if (hasAdminSecret(req)) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    return Boolean(provided) && provided === cronSecret;
  }

  return Boolean(req.headers.get("x-vercel-cron"));
}

/**
 * Garde Server Component / RSC. Lève `notFound()` (404) si non admin —
 * on ne révèle pas l'existence du dashboard à un user non habilité.
 */
export async function requireAdminUserOrNotFound(): Promise<{
  userId: string;
  email: string;
}> {
  const { userId } = await auth();
  if (!userId) notFound();
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;
  if (!email || !isAdminEmail(email)) notFound();
  return { userId, email };
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
  )?.emailAddress;
  if (!email || !isAdminEmail(email)) return new Response("Not Found", { status: 404 });
  return null;
}
