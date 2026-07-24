/**
 * Filtrage des inscriptions FICTIVES de la liste d'attente.
 *
 * La table `waitlist` mélange trois populations :
 *   • de vraies personnes (pré-inscription publique) ;
 *   • des lignes de test créées par nos scripts / fixtures de parrainage
 *     (`filleul-or-3@buupp-test.local`, `jjlex64+clerk_test1@gmail.com`…) ;
 *   • des sondes techniques (honeypot anti-bot, diagnostics de prod).
 *
 * Tout envoi de masse (broadcast admin « liste d'attente », mail de
 * lancement officiel) doit s'adresser UNIQUEMENT à la première population :
 * écrire à des adresses inexistantes fait rebondir les mails et dégrade la
 * réputation d'envoi du domaine buupp.com auprès des FAI.
 *
 * Le filtre est volontairement code-only (pas de colonne `is_test` en base) :
 * il s'applique rétroactivement aux lignes déjà présentes, sans migration, et
 * reste vérifiable par des tests unitaires.
 *
 * Principe : on n'exclut que sur des motifs qu'un inscrit réel ne peut pas
 * produire (domaines réservés/inexistants, préfixes de fixtures, sous-adresse
 * `+test`). En cas de doute, on garde la personne.
 */

export type WaitlistExclusionReason =
  | "duplicate"
  | "invalid_email"
  | "test_domain"
  | "internal_domain"
  | "test_local_part"
  | "typo_domain"
  | "test_city";

export const EXCLUSION_LABEL: Record<WaitlistExclusionReason, string> = {
  duplicate: "Doublon",
  invalid_email: "Adresse invalide",
  test_domain: "Domaine de test",
  internal_domain: "Domaine interne BUUPP",
  test_local_part: "Adresse de fixture / sonde",
  typo_domain: "Domaine mal orthographié",
  test_city: "Ville de test",
};

/** Domaines qui ne correspondent à aucune boîte réelle. */
const TEST_DOMAINS = new Set([
  "buupp-test.local",
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "localhost",
  "mailinator.com",
  "yopmail.com",
]);

/** TLD réservés (RFC 2606 / 6761) — jamais routables. */
const TEST_TLDS = [".local", ".test", ".invalid", ".example", ".localhost"];

/**
 * Nos propres domaines : utilisés par le honeypot anti-bot et les
 * diagnostics de prod, jamais par un inscrit du public. L'équipe qui
 * voudrait recevoir le mail doit s'inscrire avec une adresse perso.
 */
const INTERNAL_DOMAINS = new Set(["buupp.com", "buupp.fr"]);

/**
 * Préfixes de partie locale produits par nos scripts de fixtures et sondes.
 * Ancrés au début et suivis d'un séparateur → « testament@… » ou
 * « celeste.diagne@… » ne matchent pas.
 */
const TEST_LOCAL_PREFIXES =
  /^(honeypot|diag|filleul|fixture|seed|dummy|fake|qa|smoke)([-_.]|\d)/i;

/** Sous-adressage explicite de test : `jjlex64+clerk_test1@gmail.com`. */
const TEST_PLUS_TAG = /\+(clerk_)?(test|qa|fixture|seed)\d*$/i;

/** Partie locale strictement égale à un mot de test. */
const TEST_LOCAL_EXACT = /^(test|tests|testing|noreply|no-reply|postmaster)$/i;

/**
 * Fautes de frappe fréquentes sur les grands webmails. Une adresse
 * `…@hotmail.comb` n'atteindra jamais son destinataire : on la sort de
 * l'envoi et on la remonte à l'admin pour correction manuelle, plutôt que
 * de générer un rebond.
 */
const WEBMAIL_ROOTS = [
  "gmail",
  "hotmail",
  "outlook",
  "yahoo",
  "live",
  "orange",
  "wanadoo",
  "free",
  "sfr",
  "laposte",
  "bbox",
  "icloud",
  "aol",
];
const VALID_WEBMAIL_TLDS = new Set(["com", "fr", "co.uk", "be", "ch", "ca", "es", "it", "de", "net"]);

/** Villes issues des fixtures de parrainage. */
const TEST_CITIES = new Set(["testville", "test", "ville de test"]);

// Validation volontairement simple : un `@`, une partie locale non vide, un
// domaine avec au moins un point et pas d'espace. Suffisant pour écarter les
// saisies cassées — la vraie validation, c'est la délivrabilité.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type WaitlistCandidate = {
  email: string;
  prenom?: string | null;
  nom?: string | null;
  ville?: string | null;
};

export type WaitlistExclusion<T> = {
  row: T;
  reason: WaitlistExclusionReason;
  label: string;
};

/**
 * Classe une ligne waitlist. `null` = destinataire légitime.
 * Ne gère pas les doublons (traités par `partitionWaitlistRecipients`).
 */
export function classifyWaitlistRecipient(
  candidate: WaitlistCandidate,
): WaitlistExclusionReason | null {
  const email = (candidate.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_SHAPE.test(email)) return "invalid_email";

  const domain = email.slice(email.lastIndexOf("@") + 1);
  const localPart = email.slice(0, email.lastIndexOf("@"));

  if (TEST_DOMAINS.has(domain)) return "test_domain";
  if (TEST_TLDS.some((tld) => domain.endsWith(tld))) return "test_domain";
  if (INTERNAL_DOMAINS.has(domain)) return "internal_domain";

  if (TEST_PLUS_TAG.test(localPart)) return "test_local_part";
  if (TEST_LOCAL_PREFIXES.test(localPart)) return "test_local_part";
  if (TEST_LOCAL_EXACT.test(localPart)) return "test_local_part";

  if (isMistypedWebmail(domain)) return "typo_domain";

  const ville = (candidate.ville ?? "").trim().toLowerCase();
  if (ville && TEST_CITIES.has(ville)) return "test_city";

  return null;
}

/**
 * `hotmail.comb` → true ; `hotmail.fr` → false ; `mon-asso.fr` → false
 * (on ne juge que les domaines dont la racine est un grand webmail).
 */
function isMistypedWebmail(domain: string): boolean {
  const firstDot = domain.indexOf(".");
  if (firstDot < 0) return false;
  const root = domain.slice(0, firstDot);
  const rest = domain.slice(firstDot + 1);
  if (!WEBMAIL_ROOTS.includes(root)) return false;
  return !VALID_WEBMAIL_TLDS.has(rest);
}

/**
 * Sépare une liste d'inscrits en destinataires réels / exclus, en
 * dédupliquant au passage sur l'email (insensible à la casse).
 * L'ordre d'entrée est préservé.
 */
export function partitionWaitlistRecipients<T extends WaitlistCandidate>(
  rows: T[],
): { included: T[]; excluded: WaitlistExclusion<T>[] } {
  const included: T[] = [];
  const excluded: WaitlistExclusion<T>[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = (row.email ?? "").trim().toLowerCase();
    const reason = classifyWaitlistRecipient(row);
    if (reason) {
      excluded.push({ row, reason, label: EXCLUSION_LABEL[reason] });
      continue;
    }
    if (seen.has(key)) {
      excluded.push({ row, reason: "duplicate", label: EXCLUSION_LABEL.duplicate });
      continue;
    }
    seen.add(key);
    included.push(row);
  }

  return { included, excluded };
}
