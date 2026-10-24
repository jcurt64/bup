// Bouton flottant « crédit » de l'accueil pro : au tap, une sheet affiche
// le solde disponible et un bouton « Recharger mon crédit » qui ouvre
// l'espace pro du site (lien sortant, cf. lib/purchases). Placé au-dessus
// de la barre d'onglets flottante.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheet } from "./bottom-sheet";
import { WebRechargeButton } from "./balance-source-note";
import { BuuppLoader } from "./loader";
import { eur } from "./screen";
import { BALANCE_WEB_LINK_NOTE } from "../lib/purchases";
import { useProWallet } from "../lib/queries";
import { useTheme } from "../lib/theme";

// Barre d'onglets pro : bottom = insets.bottom + 10, hauteur ≈ 60.
const TAB_BAR_CLEARANCE = 84;

export function RechargeFab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const wallet = useProWallet();

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          void wallet.refetch();
        }}
        accessibilityRole="button"
        accessibilityLabel="Mon crédit"
        className="active:opacity-85"
        style={{
          position: "absolute",
          right: 20,
          bottom: insets.bottom + TAB_BAR_CLEARANCE,
          borderRadius: 28,
          shadowColor: c.accVioletDeep,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={[c.accViolet, c.accVioletDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="wallet" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View className="items-center" style={{ paddingTop: 8, paddingBottom: 4 }}>
          <Text
            className="font-mono uppercase"
            style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}
          >
            Crédit disponible
          </Text>
          {wallet.data ? (
            <>
              <Text className="font-serif" style={{ fontSize: 40, color: c.text, marginTop: 6 }}>
                {eur(wallet.data.walletAvailableEur)}
              </Text>
              {wallet.data.walletReservedEur > 0 ? (
                <Text style={{ fontSize: 12.5, color: c.textSub, marginTop: 2 }}>
                  dont {eur(wallet.data.walletReservedEur)} réservés pour vos campagnes en cours
                </Text>
              ) : null}
            </>
          ) : wallet.isError ? (
            <Text style={{ fontSize: 13.5, color: c.textSub, marginTop: 10 }}>
              Solde indisponible pour le moment.
            </Text>
          ) : (
            <View style={{ paddingVertical: 18 }}>
              <BuuppLoader />
            </View>
          )}
        </View>
        <Text className="text-center" style={{ fontSize: 12.5, color: c.textSub, marginTop: 14 }}>
          {BALANCE_WEB_LINK_NOTE}
        </Text>
        <WebRechargeButton style={{ marginTop: 14 }} />
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          className="items-center active:opacity-70"
          style={{ paddingVertical: 12, marginTop: 4 }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.textSub }}>Fermer</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}
