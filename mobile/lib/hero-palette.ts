import type { ThemeMode } from "./theme";

// Carte d'accueil : base très sombre + halo diagonal, déclinés par thème
// (indigo pour BUUPP/Sombre, vert profond Forest, prune Fushia).
// `pastel` / `pastelRgb` / `pastelText` : teinte claire des détails
// (barre du score, pastilles) posés sur la carte.
export const HOME_HERO: Record<
  ThemeMode,
  { base: [string, string]; glow: string; pastel: string; pastelRgb: string; pastelText: string }
> = {
  light: { base: ["#1E1646", "#0A0820"], glow: "124,92,252", pastel: "#C4B5FD", pastelRgb: "196,181,253", pastelText: "#DDD6FE" },
  dark: { base: ["#1E1646", "#0A0820"], glow: "124,92,252", pastel: "#C4B5FD", pastelRgb: "196,181,253", pastelText: "#DDD6FE" },
  forest: { base: ["#14452D", "#06170E"], glow: "52,168,106", pastel: "#A7E8C3", pastelRgb: "167,232,195", pastelText: "#D1F5E0" },
  fushia: { base: ["#4E1535", "#1A0511"], glow: "232,79,152", pastel: "#F9A8D4", pastelRgb: "249,168,212", pastelText: "#FCE7F3" },
};
