// Modes de contact d'une campagne (pivot « mise en relation pure »).
// Miroir mobile de `lib/campaigns/contact-channels.ts` (web).
//
// Le pro ne choisit plus de catégories de données : il coche le ou les
// canaux par lesquels il contactera le prospect — téléphone et/ou e-mail.
// Le prénom + l'initiale du nom sont toujours transmis (personnalisation).
// Appels et e-mails passent TOUJOURS par la plateforme BUUPP : le pro ne
// voit jamais le numéro ni l'adresse brute.
import type { Ionicons } from "@expo/vector-icons";

export const CONTACT_CHANNELS = ["phone", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/** Défaut pour les campagnes antérieures au pivot (champ absent / vide). */
export const DEFAULT_CONTACT_CHANNELS: ContactChannel[] = ["phone", "email"];

function isChannel(v: unknown): v is ContactChannel {
  return (
    typeof v === "string" && (CONTACT_CHANNELS as readonly string[]).includes(v)
  );
}

/** Lecture défensive : filtre les valeurs inconnues, absent → les deux. */
export function readContactChannels(raw: unknown): ContactChannel[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CONTACT_CHANNELS];
  const set = new Set(raw.filter(isChannel));
  const out = CONTACT_CHANNELS.filter((c) => set.has(c));
  return out.length > 0 ? out : [...DEFAULT_CONTACT_CHANNELS];
}

export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: "Téléphone",
  email: "E-mail",
};

export const CHANNEL_ICON: Record<
  ContactChannel,
  keyof typeof Ionicons.glyphMap
> = {
  phone: "call-outline",
  email: "mail-outline",
};

/** « Contact par téléphone / e-mail (via BUUPP) ». */
export function contactChannelsLabel(raw: unknown): string {
  const ch = readContactChannels(raw);
  const parts = ch.map((c) => (c === "phone" ? "téléphone" : "e-mail"));
  return `Contact par ${parts.join(" / ")} (via BUUPP)`;
}

/** Version courte pour les puces : « Téléphone · E-mail ». */
export function contactChannelsShort(raw: unknown): string {
  return readContactChannels(raw)
    .map((c) => CHANNEL_LABEL[c])
    .join(" · ");
}

/** Initiale du nom : première lettre en majuscule ("élodie" → "É"). */
export function nomInitial(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return Array.from(trimmed)[0].toLocaleUpperCase("fr-FR");
}

/** « Marie D. » à partir d'un prénom et d'un nom (ou de son initiale). */
export function prenomInitiale(prenom: unknown, nom: unknown): string {
  const p = typeof prenom === "string" ? prenom.trim() : "";
  const i = nomInitial(nom);
  return [p, i ? `${i}.` : ""].filter(Boolean).join(" ");
}

/** Les 7 champs du profil contact (prénom, initiale, ville, sexe, tranche
 *  d'âge, e-mail, téléphone). Ville, sexe et tranche d'âge servent à proposer
 *  des offres pertinentes et ne sont jamais montrés au pro. */
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

export const CONTACT_FIELD_LABEL: Record<ContactField, string> = {
  prenom: "Prénom",
  nom: "Initiale du nom",
  ville: "Ville",
  genre: "Sexe",
  trancheAge: "Tranche d'âge",
  email: "E-mail",
  telephone: "Téléphone",
};

function filled(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : v != null && v !== "";
}

export function missingContactFields(
  identity: Record<string, unknown> | null | undefined,
): ContactField[] {
  return CONTACT_FIELDS.filter((f) => !filled(identity?.[f]));
}

// ── Sexe / tranche d'âge (profil prospect + ciblage pro) ────────────────────
export type Genre = "femme" | "homme" | "autre";
export type TrancheAge = "18-35" | "35+";

export const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "femme", label: "Femme" },
  { value: "homme", label: "Homme" },
  { value: "autre", label: "Autre" },
];

export const TRANCHE_AGE_OPTIONS: { value: TrancheAge; label: string }[] = [
  { value: "18-35", label: "18–35 ans" },
  { value: "35+", label: "Plus de 35 ans" },
];

export function genreLabel(v: unknown): string {
  return GENRE_OPTIONS.find((o) => o.value === v)?.label ?? "";
}

export function trancheAgeLabel(v: unknown): string {
  return TRANCHE_AGE_OPTIONS.find((o) => o.value === v)?.label ?? "";
}

// ── Ciblage pro : villes / sexe / tranche d'âge (vide = tous) ───────────────
export const MAX_TARGET_CITIES = 20;
export type TargetGenre = "femme" | "homme";

export function readTargetCities(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !x.trim()) continue;
    const k = x.trim().toLocaleLowerCase("fr-FR");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x.trim());
  }
  return out.slice(0, MAX_TARGET_CITIES);
}

export function readTargetGenres(v: unknown): TargetGenre[] {
  if (!Array.isArray(v)) return [];
  return (["femme", "homme"] as const).filter((g) => v.includes(g));
}

export function readTargetAgeBands(v: unknown): TrancheAge[] {
  if (!Array.isArray(v)) return [];
  return (["18-35", "35+"] as const).filter((b) => v.includes(b));
}

export function targetCitiesLabel(v: unknown): string {
  const list = readTargetCities(v);
  return list.length ? list.join(", ") : "Toute la France";
}

export function targetGenresLabel(v: unknown): string {
  const list = readTargetGenres(v);
  if (list.length !== 1) return "Tous";
  return list[0] === "femme" ? "Femmes" : "Hommes";
}

export function targetAgeBandsLabel(v: unknown): string {
  const list = readTargetAgeBands(v);
  if (list.length !== 1) return "Tous";
  return list[0] === "18-35" ? "18–35 ans" : "Plus de 35 ans";
}
