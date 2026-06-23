/**
 * Résolution d'une cible géographique administrative (département / région)
 * via l'API officielle geo.api.gouv.fr — utilisée côté serveur lors de
 * l'ÉLARGISSEMENT d'une campagne en cours (PATCH /api/pro/campaigns/[id]).
 *
 * Le wizard de création fait déjà ces appels côté client
 * (`GeoTargetAutocomplete`). Ici on les refait côté serveur pour DÉRIVER le
 * geoTarget élargi à partir de l'ancre courante de la campagne, sans faire
 * confiance à un payload client (garantit « élargir la même zone », pas une
 * relocalisation arbitraire).
 */

const GEO_API = "https://geo.api.gouv.fr";
const TIMEOUT_MS = 6000;

/** Cible géo normalisée (même shape que ce que persiste POST /campaigns). */
export type WidenedGeoTarget =
  | { type: "dept"; nom: string; code: string }
  | { type: "region"; nom: string; code: string; deptCodes: string[] };

/** Ancre courante telle que stockée dans `campaigns.targeting.geoTarget`. */
export type CurrentGeoAnchor =
  | { type: "ville"; codesPostaux?: string[] }
  | { type: "dept"; code?: string }
  | { type: "region"; deptCodes?: string[] }
  | null
  | undefined;

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`geo_api_${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function firstCp(anchor: CurrentGeoAnchor, fallbackCp: string | null): string | null {
  if (anchor && anchor.type === "ville") {
    const cp = anchor.codesPostaux?.find((c) => /^\d{5}$/.test(c));
    if (cp) return cp;
  }
  return fallbackCp && /^\d{5}$/.test(fallbackCp) ? fallbackCp : null;
}

/** Code département (gère 2A/2B et DOM 97x) depuis un code postal. */
async function deptCodeFromCp(cp: string): Promise<string | null> {
  const data = await getJson(
    `${GEO_API}/communes?codePostal=${encodeURIComponent(cp)}&fields=codeDepartement&limit=1`,
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const code = (data[0] as { codeDepartement?: unknown }).codeDepartement;
  return typeof code === "string" && code.length >= 2 ? code : null;
}

/** Détermine le code département de l'ancre (depuis le code dept stocké, ou
 *  depuis un CP représentatif ville/fallback). */
async function resolveDeptCode(
  anchor: CurrentGeoAnchor,
  fallbackCp: string | null,
): Promise<string | null> {
  if (anchor && anchor.type === "dept" && typeof anchor.code === "string") {
    return anchor.code;
  }
  const cp = firstCp(anchor, fallbackCp);
  if (!cp) return null;
  return deptCodeFromCp(cp);
}

/**
 * Construit la cible géo ÉLARGIE (`dept` ou `region`) à partir de l'ancre
 * courante de la campagne. Retourne null si la résolution échoue (réseau,
 * ancre indéterminable) — l'appelant doit alors refuser l'élargissement
 * vers cette zone (le National reste toujours disponible sans réseau).
 */
export async function buildWidenedGeoTarget(
  level: "dept" | "region",
  anchor: CurrentGeoAnchor,
  fallbackCp: string | null,
): Promise<WidenedGeoTarget | null> {
  try {
    const deptCode = await resolveDeptCode(anchor, fallbackCp);
    if (!deptCode) return null;

    if (level === "dept") {
      const d = (await getJson(
        `${GEO_API}/departements/${encodeURIComponent(deptCode)}?fields=nom,code`,
      )) as { nom?: unknown; code?: unknown };
      const code = typeof d.code === "string" ? d.code : deptCode;
      const nom = typeof d.nom === "string" ? d.nom : code;
      return { type: "dept", nom, code };
    }

    // region : dept → codeRegion → { nom, deptCodes }
    const d = (await getJson(
      `${GEO_API}/departements/${encodeURIComponent(deptCode)}?fields=codeRegion`,
    )) as { codeRegion?: unknown };
    const codeRegion = typeof d.codeRegion === "string" ? d.codeRegion : null;
    if (!codeRegion) return null;

    const [reg, depts] = await Promise.all([
      getJson(`${GEO_API}/regions/${encodeURIComponent(codeRegion)}?fields=nom,code`),
      getJson(`${GEO_API}/regions/${encodeURIComponent(codeRegion)}/departements?fields=code`),
    ]);
    const nom =
      reg && typeof (reg as { nom?: unknown }).nom === "string"
        ? (reg as { nom: string }).nom
        : codeRegion;
    const deptCodes = Array.isArray(depts)
      ? (depts as Array<{ code?: unknown }>)
          .map((x) => x.code)
          .filter((c): c is string => typeof c === "string")
      : [];
    if (deptCodes.length === 0) return null;
    return { type: "region", nom, code: codeRegion, deptCodes };
  } catch (err) {
    console.warn("[france-admin] buildWidenedGeoTarget failed", err);
    return null;
  }
}
