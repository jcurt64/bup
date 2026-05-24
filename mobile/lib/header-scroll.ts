// Context partagé entre `ScrollScreen` (qui détient l'Animated.ScrollView)
// et `AppHeader` (qui consomme la position du scroll pour basculer entre
// son layout étendu — boutons + logo centré — et son layout compact —
// logo « b » + nom de page + extras optionnels poussés par la page).
//
// scrollY est une SharedValue Reanimated (60 fps, mise à jour côté UI
// thread) : AppHeader l'interpole sans déclencher de re-render JS.
//
// compactExtras est défini par chaque page qui veut afficher des
// informations supplémentaires à droite du header compact (ex. sur
// Portefeuille : « 🪙 1 234 € · 🔒 56 € »). Optionnel par défaut.
import { createContext, useContext } from "react";
import type { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { SharedValue } from "react-native-reanimated";

/** Hauteur du contenu du header (hors safe area top).
 *  Calculée à partir de l'AppHeader : paddingTop 20 + bouton 40 +
 *  paddingBottom 24 = 84. Partagée pour aligner le paddingTop du
 *  ScrollView et éviter que le contenu passe sous le header absolute. */
export const HEADER_BASE_HEIGHT = 84;

/** Seuil de scroll (en px) à partir duquel le header bascule en mode
 *  compact. Choisi assez bas pour réagir vite sans flicker au premier
 *  geste — la transition est ensuite interpolée sur ~30 px. */
export const HEADER_SCROLL_THRESHOLD = 50;
export const HEADER_SCROLL_TRANSITION = 30;

export type CompactExtra =
  | {
      iconLib?: "ionicons";
      icon: keyof typeof Ionicons.glyphMap;
      /** Valeur affichée (ex. « 1 234 € »). */
      value: string;
      /** Couleur de l'icône. Défaut = ink (#0F1629). */
      color?: string;
    }
  | {
      iconLib: "material";
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      value: string;
      color?: string;
    };

export type HeaderScrollContextValue = {
  scrollY: SharedValue<number>;
  compactExtras?: CompactExtra[];
};

export const HeaderScrollContext =
  createContext<HeaderScrollContextValue | null>(null);

/** Lit le contexte. Renvoie null si AppHeader est utilisé hors d'un
 *  ScrollScreen — dans ce cas, le header se rend dans son mode étendu
 *  statique. */
export function useHeaderScroll(): HeaderScrollContextValue | null {
  return useContext(HeaderScrollContext);
}
