// Catégorisation d'affichage des messages (cf. maquettes mes1/mes2/mes3).
// Les broadcasts n'ont pas de champ « catégorie » en base — on la dérive
// par mots-clés du titre/corps pour piloter icône, couleur et libellé
// (ANNONCE / ALERTE / COMMUNICATION). Module partagé entre la sheet
// Messages et la page de détail.
import { Ionicons } from "@expo/vector-icons";

export type MsgCategory = "annonce" | "alerte" | "communication";

export type CatConf = {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const CAT_CONF: Record<MsgCategory, CatConf> = {
  annonce: { label: "ANNONCE", color: "#7C5CFC", bg: "#EDE9FE", icon: "flash" },
  alerte: { label: "ALERTE", color: "#E0972F", bg: "#FCEFD6", icon: "notifications" },
  communication: {
    label: "COMMUNICATION",
    color: "#3F7FD6",
    bg: "#DDE9F8",
    icon: "mail",
  },
};

export function categorizeMessage(
  title: string,
  body: string | null,
): MsgCategory {
  const s = `${title} ${body ?? ""}`.toLowerCase();
  if (/(flash\s*deal|flash|deal|offre|nouveau pro|près de chez|opportunit)/.test(s))
    return "annonce";
  if (
    /(récompense|recompense|crédit|credit|séquestre|sequestre|alerte|expire|bient[oô]t|attention|action requise)/.test(
      s,
    )
  )
    return "alerte";
  return "communication";
}

// "Aujourd'hui · 08:42" / "31 mai · 18:30" — format des maquettes messages.
export function fmtMessageDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Aujourd'hui · ${time}`;
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `${day} · ${time}`;
}
