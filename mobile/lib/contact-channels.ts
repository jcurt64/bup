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

/** Les 4 champs du profil contact (prénom, initiale, e-mail, téléphone). */
export const CONTACT_FIELDS = ["prenom", "nom", "email", "telephone"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export const CONTACT_FIELD_LABEL: Record<ContactField, string> = {
  prenom: "Prénom",
  nom: "Initiale du nom",
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
