// Mention neutre « d'où vient le solde » affichée à la place des boutons
// de recharge quand les achats in-app sont masqués (lib/purchases).
// Purement informative : pas de lien, pas de bouton, pas de prix.
import { Ionicons } from "@expo/vector-icons";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { BALANCE_SOURCE_NOTE } from "../lib/purchases";
import { useTheme } from "../lib/theme";

export function BalanceSourceNote({
  color,
  style,
}: {
  /** Couleur du texte/icône (défaut : texte secondaire du thème). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const tint = color ?? c.textSub;
  return (
    <View className="flex-row items-start" style={[{ gap: 6 }, style]}>
      <Ionicons
        name="information-circle-outline"
        size={15}
        color={tint}
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 text-[12px] leading-[17px]" style={{ color: tint }}>
        {BALANCE_SOURCE_NOTE}
      </Text>
    </View>
  );
}
