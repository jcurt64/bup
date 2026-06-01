// Bottom-sheet réutilisable — Modal RN natif (slide bas), sans dépendance.
// Scrim cliquable + panneau arrondi haut + safe-area bas.
import { type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../lib/theme";

export function BottomSheet({
  visible,
  onClose,
  children,
  /** Hauteur fixe en % de l'écran (ex. 80). Sinon : auto, plafonné à 85%. */
  heightPct,
  /** Rayon des coins supérieurs (px). Défaut : rounded-t-3xl (24). */
  topRadius,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  heightPct?: number;
  topRadius?: number;
}) {
  const insets = useSafeAreaInsets();
  // Le contenu d'un Modal RN est rendu hors de l'arbre du ThemeProvider →
  // on ré-applique les variables du thème (varStyle) sur le panneau pour
  // que ses classes NativeWind basculent en sombre.
  const { c, varStyle } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Pas d'overlay sombre : la page reste visible derrière. C'est
          l'ombre foncée + le liseré au-dessus du bord arrondi qui détachent
          la sheet (un scrim sombre rendait au contraire l'ombre invisible).
          Le Pressable transparent garde le tap-pour-fermer. */}
      <Pressable
        className="flex-1"
        onPress={onClose}
        accessibilityLabel="Fermer"
      />
      <View
        className={`${topRadius == null ? "rounded-t-3xl" : ""} bg-ivory px-5 pt-3`}
        style={[varStyle, {
          paddingBottom: insets.bottom + 16,
          // Ombre portée vers le HAUT : assombrit juste au-dessus du bord
          // arrondi → le détache de la page claire visible derrière.
          shadowColor: "#000000",
          shadowOpacity: 0.4,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -12 },
          elevation: 24,
          // Liseré contrasté sur le bord supérieur : souligne la courbe
          // arrondie au-dessus du fond de page.
          borderTopWidth: 1.5,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: c.borderSoft,
          ...(topRadius != null
            ? { borderTopLeftRadius: topRadius, borderTopRightRadius: topRadius }
            : null),
          ...(heightPct
            ? { height: `${heightPct}%` as const }
            : { maxHeight: "85%" as const }),
        }]}
      >
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-ink-5" />
        {children}
      </View>
    </Modal>
  );
}
