/**
 * Date de naissance prospect — minimisation RGPD : on ne conserve que le
 * mois et l'année (`MM/AAAA`), suffisants pour le ciblage par tranche d'âge.
 *
 * Les lectures restent tolérantes aux anciens formats (`JJ/MM/AAAA`,
 * `AAAA-MM-JJ`) : données antérieures à la migration, clients mobiles pas
 * encore mis à jour.
 */

export type BirthMonth = { year: number; month: number };

/** Extrait { année, mois } d'une date de naissance, quel que soit le format. */
export function parseBirth(s: string | null | undefined): BirthMonth | null {
  if (typeof s !== "string") return null;
  const v = s.trim();
  let year: number, month: number;
  let m = /^(\d{2})\/(\d{4})$/.exec(v);
  if (m) {
    month = Number(m[1]);
    year = Number(m[2]);
  } else if ((m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(v))) {
    month = Number(m[1]);
    year = Number(m[2]);
  } else if ((m = /^(\d{4})-(\d{2})-\d{2}$/.exec(v))) {
    year = Number(m[1]);
    month = Number(m[2]);
  } else {
    return null;
  }
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Âge révolu à partir du mois + année : l'anniversaire est réputé tomber le
 * 1er du mois (précision ≤ 1 mois, sans effet sur des tranches d'âge).
 */
export function ageFromBirth(
  s: string | null | undefined,
  ref: Date = new Date(),
): number | null {
  const b = parseBirth(s);
  if (!b) return null;
  let age = ref.getFullYear() - b.year;
  if (ref.getMonth() + 1 < b.month) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/**
 * Normalise une saisie vers le format stocké `MM/AAAA`. Accepte aussi un
 * `JJ/MM/AAAA` (le jour est alors abandonné). Renvoie null si invalide
 * (mois hors 1-12, année hors des 120 dernières années, date future).
 */
export function normalizeNaissance(raw: string): string | null {
  const b = parseBirth(raw);
  if (!b) return null;
  const now = new Date();
  const year = now.getFullYear();
  if (b.year < year - 120 || b.year > year) return null;
  if (b.year === year && b.month > now.getMonth() + 1) return null;
  return `${String(b.month).padStart(2, "0")}/${b.year}`;
}
