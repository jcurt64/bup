/**
 * Géocodage d'adresses françaises via l'API Adresse (Base Adresse Nationale,
 * data.gouv.fr) — gratuite, sans clé, sans quota contractuel.
 *
 * Utilisé à l'enregistrement de la localisation prospect pour stocker les
 * coordonnées précises + la distance au centre de la commune (cf. migration
 * 20260717120000). Tout est best-effort : en cas d'échec réseau on renvoie
 * null sans bloquer l'enregistrement.
 */

const BAN_SEARCH = "https://api-adresse.data.gouv.fr/search/";

export type LatLng = { lat: number; lng: number };

async function banPoint(url: string): Promise<LatLng | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Géocode une adresse complète → coordonnées précises de l'adresse. */
export async function geocodeAddress(
  adresse: string | null | undefined,
  codePostal?: string | null,
  ville?: string | null,
): Promise<LatLng | null> {
  const q = [adresse, codePostal, ville].filter(Boolean).join(" ").trim();
  if (!q) return null;
  const params = new URLSearchParams({ q, limit: "1" });
  if (codePostal) params.set("postcode", codePostal);
  return banPoint(`${BAN_SEARCH}?${params.toString()}`);
}

/** Centre de la commune (centroïde municipal) → point de référence « centre ». */
export async function geocodeCityCenter(
  codePostal?: string | null,
  ville?: string | null,
): Promise<LatLng | null> {
  const q = [ville, codePostal].filter(Boolean).join(" ").trim();
  if (!q) return null;
  const params = new URLSearchParams({ q, type: "municipality", limit: "1" });
  if (codePostal) params.set("postcode", codePostal);
  return banPoint(`${BAN_SEARCH}?${params.toString()}`);
}

/** Distance orthodromique (haversine) en mètres entre deux points. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
