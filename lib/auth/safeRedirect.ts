/**
 * Normalise un `redirect_url` reçu en query param et retourne un chemin
 * relatif sûr (sans protocole, sans cross-origin), ou `undefined` si la
 * valeur n'est pas exploitable.
 *
 * Pourquoi pas juste `startsWith("/")` :
 *   Clerk's `redirectToSignIn({ returnBackUrl })` normalise `returnBackUrl`
 *   via `new URL(returnBackUrl, baseUrl)` puis sérialise via `.toString()`
 *   (cf. @clerk/backend/dist/internal.js:329-346). La query reçue par
 *   /connexion est donc TOUJOURS une URL absolue (ex.
 *   `http://localhost:3000/prospect`), même si on a passé "/prospect"
 *   au middleware. Refuser ces valeurs cassait `forceRedirectUrl` →
 *   fallback /auth/post-login qui route par rôle existant → un user
 *   pro envoyé sur /pro alors qu'il cliquait "Je suis prospect".
 *
 * Garde anti-open-redirect : on extrait le pathname+search uniquement,
 * jamais l'origine. Un `redirect_url=https://evil.com/foo` est donc
 * tronqué en `/foo` (origine de la requête courante) plutôt qu'autorisé
 * tel quel.
 */
export function safeRedirect(
  raw: string | string[] | undefined,
): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || v.length === 0) return undefined;

  // Cas chemin relatif simple : "/foo" autorisé, "//foo" interdit
  // (ce dernier est en réalité un protocol-relative URL → cross-origin).
  if (v.startsWith("/") && !v.startsWith("//")) {
    return v;
  }

  // Cas URL absolue : on parse et on garde uniquement pathname + search
  // (le hash est volontairement omis — il n'a pas de sens côté serveur
  // post-auth et n'aide pas au routing). On utilise une base bidon
  // valide pour ne pas faire planter URL() sur des inputs partiels.
  try {
    const url = new URL(v, "http://placeholder.invalid");
    const path = url.pathname + url.search;
    if (path.startsWith("/") && !path.startsWith("//")) {
      return path;
    }
  } catch {
    /* fallthrough → undefined */
  }
  return undefined;
}
