/**
 * Re-exports pratiques pour l'usage côté serveur.
 *
 * - `auth()` → renvoie `{ userId, sessionId, orgId, … }` dans une route handler / RSC.
 * - `currentUser()` → renvoie l'objet utilisateur Clerk complet (plus coûteux : 1 appel API).
 * - `clerkClient` → SDK admin (gestion d'utilisateurs depuis le serveur).
 *
 * Usage :
 *   import { auth, currentUser } from "@/lib/clerk/server";
 *   const { userId } = await auth();
 */

export { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
