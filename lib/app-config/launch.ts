/**
 * Règles pures des deux bascules du lancement, isolées des lectures base.
 *
 * Elles vivent à part pour deux raisons : `lib/app-config/access.ts` importe
 * le client Supabase admin (inutilisable depuis le proxy edge et depuis un
 * test), et ces règles sont le cœur du comportement du jour J — elles
 * méritent d'être testées sans base.
 *
 * `launch_at` est le pivot AUTOMATIQUE : à l'instant où le compte à rebours
 * de /liste-attente tombe à zéro, les comptes s'ouvrent et la
 * pré-inscription se ferme, sans intervention humaine ni redéploiement. Les
 * drapeaux restent la commande manuelle (ouvrir en avance, refermer avant
 * l'échéance) ; la date ne fait que garantir que l'échéance sera honorée
 * même si personne n'est devant une machine.
 */

/** L'heure du lancement est-elle passée ? `launch_at` absente/illisible = non. */
export function launchReached(
  launchAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!launchAt) return false;
  const t = Date.parse(launchAt);
  return Number.isFinite(t) && now >= t;
}

/**
 * Inscription / connexion accessibles ?
 *
 * Ouvert si le drapeau le dit (le `!== false` conserve le fail-open
 * historique : colonne absente ou nulle = ouvert), OU si `launch_at` est
 * passée.
 */
export function accessOpenFrom(
  flag: boolean | null | undefined,
  launchAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return flag !== false || launchReached(launchAt, now);
}

/**
 * Pré-inscription encore ouverte ?
 *
 * Fermée si le drapeau le dit, OU dès que `launch_at` est passée : la
 * liste d'attente a expiré, le service est ouvert pour de vrai.
 */
export function waitlistOpenFrom(
  flag: boolean | null | undefined,
  launchAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return flag !== false && !launchReached(launchAt, now);
}

/**
 * Chemins de la pré-inscription, à fermer dès que `launch_at` est passée.
 *
 * Deux entrées et non une : `/liste-attente` n'est qu'une coquille qui
 * encadre `public/prototype/waitlist.html` dans une iframe, et ce HTML est
 * servi depuis /public — il reste donc atteignable en direct, hors de son
 * iframe, si on ne le nomme pas ici. Fermer seulement la page laisserait
 * une porte ouverte à qui connaît l'URL (elle a circulé dans le code
 * source de la page pendant tout le mois de pré-inscription).
 */
export function isWaitlistRoute(pathname: string): boolean {
  return (
    pathname === "/liste-attente" ||
    pathname === "/prototype/waitlist.html"
  );
}
