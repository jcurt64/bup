/**
 * Génère un code de parrainage déterministe à partir d'un email.
 *
 * Propriétés :
 *   - Même email (insensible à la casse) → toujours le même code.
 *   - Code court (7 caractères), URL-safe, base36 majuscule.
 *   - Pas un secret : c'est un identifiant public destiné à apparaître
 *     dans des liens partagés (`buupp.fr/ref/<code>`). L'algorithme peut
 *     être reproduit côté client sans risque.
 *
 * Algo : 5 premiers octets du SHA-1 de l'email normalisé → entier 40 bits
 * → base36 majuscule, padé à 7 caractères.
 *
 * Couverture : 36^7 ≈ 78 milliards de codes possibles → collision improbable
 * pour une liste d'attente sous le million d'inscrits.
 */

import crypto from "node:crypto";

export function refCodeFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash("sha1").update(normalized).digest();
  // Lit les 5 premiers octets en big-endian → entier 40 bits.
  // 40 bits tiennent largement dans un Number JS (précis jusqu'à 2^53),
  // pas besoin de BigInt. On évite `<<` qui force en int32 signé.
  let n = 0;
  for (let i = 0; i < 5; i++) n = n * 256 + hash[i];
  return n.toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
}
