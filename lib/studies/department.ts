/** Départements valides : 01–19, 2A, 2B, 21–95, 971–976. */
export function isValidDepartment(d: string | null | undefined): d is string {
  if (!d) return false;
  if (d === "2A" || d === "2B") return true;
  if (/^97[1-6]$/.test(d)) return true;
  if (!/^\d{2}$/.test(d)) return false;
  const n = Number(d);
  return n >= 1 && n <= 95 && n !== 20;
}

/**
 * Département déduit du code postal du prospect. Utilisé uniquement comme
 * filtre d'éligibilité — jamais transmis au pro.
 * Corse : 200xx–201xx → 2A, 202xx–206xx → 2B. DOM : 3 chiffres.
 */
export function departmentFromPostalCode(cp: string | null | undefined): string | null {
  const s = (cp ?? "").trim();
  if (!/^\d{5}$/.test(s)) return null;
  if (s.startsWith("97")) {
    const d = s.slice(0, 3);
    return isValidDepartment(d) ? d : null;
  }
  if (s.startsWith("20")) return Number(s.slice(0, 3)) < 202 ? "2A" : "2B";
  const d = s.slice(0, 2);
  return isValidDepartment(d) ? d : null;
}
