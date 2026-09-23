// Styles partagés des écrans Contacts (palette thémée, initiales, couleur de
// catégorie, dégradé d'avatar). Module feuille : évite les imports circulaires
// entre contact-cards, contact-detail-sheet et contact-actions.
import type { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../lib/theme";

// ── Palette dérivée du thème ──────────────────────────────────────────────
// Mappe les couleurs « forest » de la maquette vers les tokens du thème actif.
export function useContactPalette() {
  const { c, isDark } = useTheme();
  return {
    isDark,
    card: c.surface, // #fff
    border: c.borderSoft, // #e7e1d2
    text: c.text, // #0a1628
    sub: c.textSub, // #6b7384
    muted: c.textMuted, // #9aa1ad
    accent: c.accent, // #2f8d5b
    accentInk: c.accentInk, // #1d6b42
    accentSoft: c.accentSoft, // #eaf5ee
    accentBorder: c.accent + (isDark ? "55" : "40"), // #cfe9d8 (accent translucide)
    field: c.surface2, // #f4f1e9 (encart e-mail watermark)
    line: c.track, // #ece7d9 (filets)
    coral: c.accCoral, // #dd5f48 (action e-mail)
    blue: c.accBlue, // #3f7fd6 (action SMS)
    // Bouton sombre neutre (× Sans filtre / Voir détails / Fermer). Dans la
    // maquette forest c'est un foncé navy/quasi-noir (PAS l'accent vert) → on
    // utilise c.ink (neutre foncé teinté par thème : navy buupp, quasi-noir
    // forest, prune fushia). En sombre, c.ink est clair → on inverse en pastille
    // claire (c.btnBg) pour garder le contraste.
    ctaBg: isDark ? c.btnBg : c.ink,
    ctaText: c.btnText,
    palier: c.ivory2, // pastille « P1 »
    ink5: c.ink5,
    sheetBg: c.bg, // fond de la sheet (= ivoire du thème, #f4f1e9 en forest)
    avatar: (isDark ? [c.accent, c.violet] : [c.accent, c.accentInk]) as [
      string,
      string,
    ],
  };
}

// Initiales (2 lettres max) à partir du nom affiché.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Couleur de catégorie par objectif de campagne (parité web Pro.jsx) :
// accent latéral + pastille. Palette désaturée « épuré, jamais criard ».
type CategoryStyle = { accent: string; label: string; ion: keyof typeof Ionicons.glyphMap };
const CATEGORY: Record<string, CategoryStyle> = {
  contact: { accent: "#4F46E5", label: "Contact", ion: "mail-outline" },
  rdv: { accent: "#0D9488", label: "Rendez-vous", ion: "calendar-outline" },
  evt: { accent: "#D97706", label: "Événementiel", ion: "sparkles-outline" },
  dl: { accent: "#DB2777", label: "Téléchargement", ion: "download-outline" },
  survey: { accent: "#7C3AED", label: "Études & avis", ion: "document-text-outline" },
  promo: { accent: "#E11D48", label: "Promotions", ion: "gift-outline" },
  addigital: { accent: "#0891B2", label: "Publicité", ion: "globe-outline" },
};
export function categoryStyle(objectiveId?: string | null): CategoryStyle {
  return (objectiveId && CATEGORY[objectiveId]) || { accent: "#6B7280", label: "Campagne", ion: "pricetag-outline" };
}

// Gradient d'avatar (cercle d'initiales) varié par prospect — teintes vives,
// initiales blanches. Hash stable sur le nom (parité avec le web).
const AVATAR_GRADIENTS: [string, string][] = [
  ["#6366F1", "#4F46E5"], // indigo
  ["#14B8A6", "#0D9488"], // teal
  ["#F59E0B", "#D97706"], // ambre
  ["#EC4899", "#DB2777"], // rose
  ["#8B5CF6", "#7C3AED"], // violet
  ["#06B6D4", "#0891B2"], // cyan
  ["#22C55E", "#16A34A"], // vert
  ["#FB7185", "#E11D48"], // rose foncé
];
export function avatarGradient(name: string): [string, string] {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
