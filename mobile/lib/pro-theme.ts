// Dégradé violet des cartes héros pro (115/150deg du design), par thème.
import type { ThemeMode } from "./theme";

export const HERO_GRADIENT: Record<ThemeMode, readonly [string, string, string]> = {
  light: ["#7C5CFF", "#5B3FE0", "#211B52"],
  dark: ["#3A2F7A", "#241E4A", "#14192B"],
  forest: ["#34A86A", "#2F8D5B", "#103A26"],
  fushia: ["#E84F98", "#D63B80", "#7A2350"],
};
