/**
 * Modes de contact d'une campagne (pivot « mise en relation pure »).
 *
 * Le pro ne choisit plus de catégories de données : il coche le ou les
 * canaux par lesquels il contactera le prospect — téléphone et/ou e-mail.
 * Le prénom + l'initiale du nom sont toujours transmis (personnalisation).
 * L'e-mail passe TOUJOURS par la plateforme BUUPP (relais) : le pro ne
 * reçoit jamais l'adresse brute. Le téléphone, lui, est communiqué au pro
 * APRÈS acceptation (bouton « Appeler », révélation journalisée + SMS de
 * préavis) : il appelle depuis son propre téléphone, l'appel ne passe pas
 * par BUUPP.
 *
 * Persisté dans `campaigns.contact_channels text[]` (CHECK ⊆ {phone,email},
 * non vide, défaut {phone,email}).
 */

export const CONTACT_CHANNELS = ["phone", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/** Défaut pour les campagnes antérieures au pivot (colonne absente / vide). */
export const DEFAULT_CONTACT_CHANNELS: ContactChannel[] = ["phone", "email"];

function isChannel(v: unknown): v is ContactChannel {
  return typeof v === "string" && (CONTACT_CHANNELS as readonly string[]).includes(v);
}

/**
 * Valide le champ `contactChannels` d'un body client. Retourne la liste
 * dédoublonnée (ordre canonique phone → email), ou `null` si invalide
 * (pas un tableau, valeur inconnue, ou vide).
 */
export function parseContactChannels(raw: unknown): ContactChannel[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seen = new Set<ContactChannel>();
  for (const v of raw) {
    if (!isChannel(v)) return null;
    seen.add(v);
  }
  return CONTACT_CHANNELS.filter((c) => seen.has(c));
}

/**
 * Lecture défensive depuis la DB (ou un objet arbitraire) : filtre les
 * valeurs inconnues, retombe sur le défaut si rien de valide.
 */
export function readContactChannels(raw: unknown): ContactChannel[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CONTACT_CHANNELS];
  const set = new Set(raw.filter(isChannel));
  const out = CONTACT_CHANNELS.filter((c) => set.has(c));
  return out.length > 0 ? out : [...DEFAULT_CONTACT_CHANNELS];
}

/**
 * Initiale du nom : première lettre (accentuée conservée) en majuscule.
 * "élodie" → "É", "  dupont" → "D", "" / null → null.
 */
export function nomInitial(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Premier « caractère » Unicode (gère les paires de substitution).
  const first = Array.from(trimmed)[0];
  return first.toLocaleUpperCase("fr-FR");
}

function filled(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export type ContactIdentity = {
  prenom?: string | null;
  nom?: string | null;
  ville?: string | null;
  genre?: string | null;
  /** Colonne DB (`prospect_identity.tranche_age`). */
  tranche_age?: string | null;
  /** Alias UI (`trancheAge`) — accepté pour les objets côté client. */
  trancheAge?: string | null;
  email?: string | null;
  telephone?: string | null;
};

/** Le prospect possède-t-il les coordonnées requises par les canaux ?
 *  (Éligibilité de base au matching : ville / sexe / tranche d'âge ne sont
 *  requis que si la campagne filtre dessus — cf. audience-targeting.ts ;
 *  ils sont en revanche tous exigés à l'acceptation.) */
export function identityCoversChannels(
  identity: ContactIdentity | null | undefined,
  channels: readonly ContactChannel[],
): boolean {
  if (!identity) return false;
  if (!filled(identity.prenom) || !filled(identity.nom)) return false;
  if (channels.includes("phone") && !filled(identity.telephone)) return false;
  if (channels.includes("email") && !filled(identity.email)) return false;
  return true;
}

/** Les 7 champs du profil prospect (noms UI) : prénom, initiale, ville, sexe,
 *  tranche d'âge, e-mail, téléphone (complétude / score). */
export const CONTACT_FIELDS = [
  "prenom",
  "nom",
  "ville",
  "genre",
  "trancheAge",
  "email",
  "telephone",
] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Champs requis pour ACCEPTER une sollicitation : prénom, initiale, e-mail,
 *  téléphone. Ville / sexe / tranche d'âge restent facultatifs (ils ne servent
 *  qu'au filtrage : un prospect qui ne les a pas renseignés n'est simplement
 *  pas sélectionné par les campagnes filtrées sur ces critères). */
export const ACCEPT_REQUIRED_FIELDS = ["prenom", "nom", "email", "telephone"] as const;

const GENRE_VALUES = ["femme", "homme", "autre"];
const AGE_BAND_VALUES = ["18-35", "35+"];

function fieldFilled(identity: ContactIdentity, f: ContactField): boolean {
  switch (f) {
    case "genre":
      return typeof identity.genre === "string" && GENRE_VALUES.includes(identity.genre);
    case "trancheAge": {
      const v = identity.tranche_age ?? identity.trancheAge;
      return typeof v === "string" && AGE_BAND_VALUES.includes(v);
    }
    default:
      return filled(identity[f]);
  }
}

/** Champs manquants (noms UI, ordre canonique). Accepte une row DB
 *  (`tranche_age`) comme un objet UI (`trancheAge`). */
export function missingContactFields(
  identity: ContactIdentity | null | undefined,
  fields: readonly ContactField[] = ACCEPT_REQUIRED_FIELDS,
): ContactField[] {
  if (!identity) return [...fields];
  return fields.filter((f) => !fieldFilled(identity, f));
}

/** Les champs requis à l'acceptation sont-ils renseignés ? */
export function isContactProfileComplete(
  identity: ContactIdentity | null | undefined,
): boolean {
  return missingContactFields(identity).length === 0;
}

/**
 * Canal de contact IMPLIQUÉ par un sous-type de l'étape 1 (création de
 * campagne). E-mail → relais e-mail BUUPP ; appel, SMS, MMS, WhatsApp,
 * RDV téléphonique → numéro de téléphone. Les autres sous-types (webinar,
 * sondage, « Autres »…) n'impliquent aucun canal : le pro le choisit alors
 * à l'étape 3. Doit rester synchronisé avec SUB_TYPE_CHANNEL de Pro.jsx.
 */
export const SUB_TYPE_CHANNEL: Readonly<Record<string, ContactChannel>> = {
  email: "email",
  phone: "phone",
  sms: "phone",
  mms: "phone",
  wa: "phone",
  rdvtel: "phone",
};

/** Canaux déduits des sous-types de l'étape 1, ou null si aucun n'en implique. */
export function channelsFromSubTypes(
  subTypes: readonly string[] | null | undefined,
): ContactChannel[] | null {
  const set = new Set<ContactChannel>();
  for (const s of subTypes ?? []) {
    const c = SUB_TYPE_CHANNEL[s];
    if (c) set.add(c);
  }
  const out = CONTACT_CHANNELS.filter((c) => set.has(c));
  return out.length > 0 ? out : null;
}
