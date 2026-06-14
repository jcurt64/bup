/**
 * Pseudonymisation des données prospect renvoyées au PRO (onglet « Mes
 * contacts »).
 *
 * Source de vérité des règles fixées avec l'équipe produit (et illustrées
 * dans le popup « Comment vos données sont pseudonymisées ») :
 *
 *  Palier 1 — Identification
 *    - prénom              → CONSERVÉ   (le pro connaît le prénom à l'appel)
 *    - nom                 → MASQUAGE   (initiale + points)
 *    - e-mail              → alias watermarqué (géré en amont par la route)
 *    - téléphone           → CONSERVÉ
 *    - date de naissance   → GÉNÉRALISATION → tranche d'âge décennale
 *  Palier 2 — Localisation
 *    - adresse postale     → GÉNÉRALISATION → distance au centre de la
 *                            commune, bornée en tranche (« < 2 km du centre »).
 *                            Calculée depuis center_distance_m (géocodage BAN
 *                            à l'enregistrement) ; l'adresse précise et les
 *                            coordonnées exactes ne sont JAMAIS exposées.
 *    - ville / région      → CONSERVÉ
 *    - code postal         → GÉNÉRALISATION → département
 *  Palier 3 — Style de vie : conservé, sauf animaux (catégorisé : on retire
 *    la race) et véhicule (type conservé, marque retirée côté route).
 *  Palier 4 — Données professionnelles : statut / secteur conservés ; poste
 *    et revenus supprimés (champs dépréciés + sensibles).
 *  Palier 5 — Patrimoine & projets : résidence / projets conservés ;
 *    épargne supprimée (champ déprécié + sensible).
 *
 * Tout est calculé À LA LECTURE (aucune donnée transformée n'est stockée),
 * donc parfaitement réversible. Le même backend `/api/*` sert le web ET le
 * mobile : la pseudonymisation profite automatiquement aux deux.
 */

export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";

export type PseudoKind =
  | "keep" // conservé tel quel
  | "suppress" // jamais transmis (champ omis)
  | "mask" // initiale + points (ex. « Marie » → « M•••• »)
  | "age" // date de naissance → tranche d'âge (« 30–39 ans »)
  | "postal" // code postal → département (« 69 · Rhône »)
  | "distance" // adresse → distance au centre (lit center_distance_m)
  | "alias" // e-mail → alias watermarqué (valeur injectée par la route)
  | "animal"; // animaux → catégorie sans la race

type FieldRule = { col: string; label: string; kind: PseudoKind };

/**
 * Ordre + libellés + règle de transformation par palier. Les libellés sont
 * adaptés au résultat pseudonymisé (« Tranche d'âge », « Département »).
 */
export const PSEUDO_FIELDS: Record<TierKey, FieldRule[]> = {
  identity: [
    { col: "prenom", label: "Prénom", kind: "keep" },
    { col: "nom", label: "Nom", kind: "mask" },
    { col: "email", label: "E-mail (alias sécurisé)", kind: "alias" },
    { col: "telephone", label: "Téléphone", kind: "keep" },
    { col: "naissance", label: "Tranche d'âge", kind: "age" },
  ],
  localisation: [
    { col: "adresse", label: "Zone", kind: "distance" },
    { col: "ville", label: "Ville", kind: "keep" },
    { col: "code_postal", label: "Département", kind: "postal" },
    { col: "region", label: "Région", kind: "keep" },
  ],
  vie: [
    { col: "foyer", label: "Foyer", kind: "keep" },
    { col: "sports", label: "Sports / loisirs", kind: "keep" },
    { col: "animaux", label: "Animaux", kind: "animal" },
    { col: "vehicule", label: "Véhicule", kind: "keep" },
    { col: "logement", label: "Logement", kind: "keep" },
    { col: "mobilite", label: "Mobilité", kind: "keep" },
  ],
  pro: [
    { col: "poste", label: "Poste", kind: "suppress" },
    { col: "statut", label: "Statut", kind: "keep" },
    { col: "secteur", label: "Secteur", kind: "keep" },
    { col: "revenus", label: "Revenus déclarés", kind: "suppress" },
  ],
  patrimoine: [
    { col: "residence", label: "Résidence principale", kind: "keep" },
    { col: "epargne", label: "Épargne disponible", kind: "suppress" },
    { col: "projets", label: "Projets à 3–5 ans", kind: "keep" },
  ],
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** « Marie » → « M•••• », « Dubois » → « D••••• ». */
export function maskToken(value: unknown): string | null {
  const s = strOrNull(value);
  if (!s) return null;
  const chars = Array.from(s);
  const first = chars[0].toUpperCase();
  const dots = Math.min(Math.max(chars.length - 1, 2), 5);
  return first + "•".repeat(dots);
}

/**
 * Date de naissance (« JJ/MM/AAAA » ou « AAAA-MM-JJ ») → tranche d'âge
 * décennale (« 30–39 ans »). `ref` permet de figer la date pour les tests.
 */
export function ageRange(value: unknown, ref?: Date): string | null {
  const s = strOrNull(value);
  if (!s) return null;
  let y: number | undefined, m: number | undefined, d: number | undefined;
  let mt = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mt) {
    d = +mt[1];
    m = +mt[2];
    y = +mt[3];
  } else {
    mt = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mt) {
      y = +mt[1];
      m = +mt[2];
      d = +mt[3];
    }
  }
  if (!y || !m || !d) return null;
  const now = ref ?? new Date();
  let age = now.getFullYear() - y;
  const mo = now.getMonth() + 1;
  if (mo < m || (mo === m && now.getDate() < d)) age -= 1;
  if (age < 0 || age > 120) return null;
  const lo = Math.floor(age / 10) * 10;
  return `${lo}–${lo + 9} ans`;
}

// Départements français (code → nom). Le code postal est généralisé à son
// département (2 chiffres ; 3 pour l'Outre-mer 97x/98x ; « 20 » → Corse).
const DEPARTMENTS: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "20": "Corse",
  "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne",
  "25": "Doubs", "26": "Drôme", "27": "Eure", "28": "Eure-et-Loir",
  "29": "Finistère", "30": "Gard", "31": "Haute-Garonne", "32": "Gers",
  "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre",
  "37": "Indre-et-Loire", "38": "Isère", "39": "Jura", "40": "Landes",
  "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire", "44": "Loire-Atlantique",
  "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère",
  "49": "Maine-et-Loire", "50": "Manche", "51": "Marne", "52": "Haute-Marne",
  "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan",
  "57": "Moselle", "58": "Nièvre", "59": "Nord", "60": "Oise",
  "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales", "67": "Bas-Rhin", "68": "Haut-Rhin",
  "69": "Rhône", "70": "Haute-Saône", "71": "Saône-et-Loire", "72": "Sarthe",
  "73": "Savoie", "74": "Haute-Savoie", "75": "Paris", "76": "Seine-Maritime",
  "77": "Seine-et-Marne", "78": "Yvelines", "79": "Deux-Sèvres", "80": "Somme",
  "81": "Tarn", "82": "Tarn-et-Garonne", "83": "Var", "84": "Vaucluse",
  "85": "Vendée", "86": "Vienne", "87": "Haute-Vienne", "88": "Vosges",
  "89": "Yonne", "90": "Territoire de Belfort", "91": "Essonne", "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis", "94": "Val-de-Marne", "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion",
  "975": "Saint-Pierre-et-Miquelon", "976": "Mayotte",
};

/** « 69002 » → « 69 · Rhône ». */
export function postalToDept(value: unknown): string | null {
  const s = strOrNull(value);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 2) return null;
  let code = digits.slice(0, 2);
  if (code === "97" || code === "98") code = digits.slice(0, 3);
  const name = DEPARTMENTS[code];
  return name ? `${code} · ${name}` : code;
}

/** Distance (m) au centre de la commune → tranche (« < 2 km du centre »). */
export function distanceBand(meters: unknown): string | null {
  if (meters == null) return null;
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return null;
  const km = m / 1000;
  if (km < 2) return "< 2 km du centre";
  if (km < 5) return "2–5 km du centre";
  if (km < 10) return "5–10 km du centre";
  if (km < 20) return "10–20 km du centre";
  return "> 20 km du centre";
}

/** Animaux : on retire la race, on ne garde que la présence d'un animal. */
export function animalCategory(value: unknown): string | null {
  const s = strOrNull(value);
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === "non" || low === "aucun" || low.startsWith("pas")) return "Aucun";
  return "Animal de compagnie";
}

/** Applique une règle de transformation à une valeur brute. */
export function applyKind(kind: PseudoKind, raw: unknown): string | null {
  switch (kind) {
    case "keep":
      return strOrNull(raw);
    case "suppress":
    case "alias":
      return null; // alias : injecté par la route ; suppress : omis
    case "mask":
      return maskToken(raw);
    case "age":
      return ageRange(raw);
    case "postal":
      return postalToDept(raw);
    case "animal":
      return animalCategory(raw);
    default:
      return null;
  }
}

/**
 * Construit la liste pseudonymisée { label, value } d'un palier à partir de
 * la ligne brute lue en base. Les champs en SUPPRESSION sont omis. L'e-mail
 * reçoit l'alias watermarqué fourni par la route (`opts.aliasEmail`).
 */
export function pseudonymizeTierItems(
  tier: TierKey,
  raw: Record<string, unknown>,
  opts?: { aliasEmail?: string | null },
): Array<{ label: string; value: string | null }> {
  const out: Array<{ label: string; value: string | null }> = [];
  for (const f of PSEUDO_FIELDS[tier]) {
    if (f.kind === "suppress") continue; // jamais transmis
    let value: string | null;
    if (f.kind === "alias") {
      value = opts?.aliasEmail ?? null;
    } else if (f.kind === "distance") {
      // La distance se lit dans center_distance_m (géocodage), pas dans la
      // colonne adresse. Si non géocodé, on omet le champ (pas de ligne vide).
      value = distanceBand(raw["center_distance_m"]);
      if (value == null) continue;
    } else {
      value = applyKind(f.kind, raw[f.col]);
    }
    out.push({ label: f.label, value });
  }
  return out;
}
