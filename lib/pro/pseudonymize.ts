/**
 * Pseudonymisation des données prospect renvoyées au PRO (onglet « Mes
 * contacts », fiche détaillée).
 *
 * Pivot « mise en relation pure » (nov. 2026) : le prospect ne fournit plus
 * que son prénom, l'INITIALE de son nom, son e-mail et son téléphone. Le pro
 * reçoit uniquement :
 *    - prénom              → CONSERVÉ (personnalisation)
 *    - nom                 → initiale suivie d'un point (« D. »)
 *    - e-mail              → alias watermarqué relayé par BUUPP (injecté par
 *                            la route), seulement si la campagne a le canal
 *                            « email »
 *  Le téléphone n'est jamais listé dans la fiche : l'appel passe par le
 *  bouton « Appeler » (flux révélation journalisé + SMS de préavis), et
 *  seulement si la campagne a le canal « phone ».
 *
 * Tout est calculé À LA LECTURE (aucune donnée transformée n'est stockée).
 * Le même backend `/api/*` sert le web ET le mobile.
 */

import { nomInitial, type ContactChannel } from "@/lib/campaigns/contact-channels";

/** Seul palier restant (clé conservée pour la compatibilité des clients). */
export type TierKey = "identity";

export type PseudoKind =
  | "keep" // conservé tel quel
  | "initial" // nom → initiale + point (« D. »)
  | "alias"; // e-mail → alias watermarqué (valeur injectée par la route)

type FieldRule = { col: string; label: string; kind: PseudoKind; channel?: ContactChannel };

export const PSEUDO_FIELDS: Record<TierKey, FieldRule[]> = {
  identity: [
    { col: "prenom", label: "Prénom", kind: "keep" },
    { col: "nom", label: "Nom", kind: "initial" },
    { col: "email", label: "E-mail (alias sécurisé)", kind: "alias", channel: "email" },
  ],
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** « Dubois » / « D » → « D. ». */
export function initialToken(value: unknown): string | null {
  const i = nomInitial(value);
  return i ? `${i}.` : null;
}

/** Applique une règle de transformation à une valeur brute. */
export function applyKind(kind: PseudoKind, raw: unknown): string | null {
  switch (kind) {
    case "keep":
      return strOrNull(raw);
    case "initial":
      return initialToken(raw);
    case "alias":
      return null; // injecté par la route
    default:
      return null;
  }
}

/**
 * Construit la liste pseudonymisée { label, value } du profil contact à partir
 * de la ligne brute `prospect_identity`. L'e-mail reçoit l'alias watermarqué
 * fourni par la route (`opts.aliasEmail`) et n'apparaît que si la campagne a
 * le canal « email » (`opts.channels`, défaut : tous).
 */
export function pseudonymizeTierItems(
  tier: TierKey,
  raw: Record<string, unknown>,
  opts?: { aliasEmail?: string | null; channels?: readonly ContactChannel[] },
): Array<{ label: string; value: string | null }> {
  const out: Array<{ label: string; value: string | null }> = [];
  for (const f of PSEUDO_FIELDS[tier]) {
    if (f.channel && opts?.channels && !opts.channels.includes(f.channel)) continue;
    const value = f.kind === "alias" ? opts?.aliasEmail ?? null : applyKind(f.kind, raw[f.col]);
    out.push({ label: f.label, value });
  }
  return out;
}
