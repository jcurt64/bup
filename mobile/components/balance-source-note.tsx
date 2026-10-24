// Mention « d'où vient le solde » affichée à la place des boutons de
// recharge in-app quand les achats sont masqués (lib/purchases). Avec le
// lien sortant activé (WEB_RECHARGE_LINK_ENABLED), elle porte en plus un
// bouton « Recharger mon crédit » qui ouvre l'espace pro du site.
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import {
  BALANCE_SOURCE_NOTE,
  BALANCE_WEB_LINK_NOTE,
  openWebRecharge,
  WEB_RECHARGE_LINK_ENABLED,
} from "../lib/purchases";
import { useTheme } from "../lib/theme";

export function BalanceSourceNote({
  color,
  style,
}: {
  /** Couleur du texte/icône et du bouton (défaut : thème). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const tint = color ?? c.textSub;
  return (
    <View style={style}>
      <View className="flex-row items-start" style={{ gap: 6 }}>
        <Ionicons
          name="information-circle-outline"
          size={15}
          color={tint}
          style={{ marginTop: 1 }}
        />
        <Text className="flex-1 text-[12px] leading-[17px]" style={{ color: tint }}>
          {WEB_RECHARGE_LINK_ENABLED ? BALANCE_WEB_LINK_NOTE : BALANCE_SOURCE_NOTE}
        </Text>
      </View>
      {WEB_RECHARGE_LINK_ENABLED ? <WebRechargeButton color={color} style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

/** Bouton plein « Recharger mon crédit » → espace pro du site. */
export function WebRechargeButton({
  color,
  style,
}: {
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={openWebRecharge}
      accessibilityRole="link"
      accessibilityHint="Ouvre votre espace professionnel sur buupp.com"
      className="flex-row items-center justify-center rounded-full active:opacity-80"
      style={[
        { gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: color ?? c.accVioletDeep },
        style,
      ]}
    >
      <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
      <Text className="text-[13.5px] font-semibold" style={{ color: "#FFFFFF" }}>
        Recharger mon crédit
      </Text>
      <Ionicons name="open-outline" size={14} color="#FFFFFF" />
    </Pressable>
  );
}
