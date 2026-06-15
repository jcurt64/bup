// Popup de consentement préalable au canal TÉLÉPHONE (réforme française du
// démarchage téléphonique = opt-in). Affichée à l'acceptation d'une
// sollicitation : le prospect confirme explicitement accepter d'être
// éventuellement contacté par téléphone par le professionnel.
//   « OK, j'accepte » → finalise l'acceptation (consentement tracé serveur).
//   « Non, je refuse » → annule l'acceptation.
// Parité avec le web (Prospect.jsx fn PhoneConsentModal).
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { useTheme } from "../lib/theme";

export function PhoneConsentSheet({
  visible,
  onClose,
  onAccept,
}: {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  const { c } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accent }}
          >
            <Ionicons name="call" size={18} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Contact par téléphone
          </Text>
        </View>

        {/* Encart explicatif */}
        <View
          className="flex-row gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: c.accentSoft,
            borderWidth: 1.5,
            borderColor: c.borderSoft,
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accent }}
          >
            <Ionicons name="call" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[14px] text-ink">
              En acceptant cette sollicitation
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-ink-2">
              vous êtes susceptible d&apos;être{" "}
              <Text className="font-semibold">contacté(e) par téléphone</Text> par
              ce professionnel, en plus des autres canaux. En appuyant sur
              « OK, j&apos;accepte », vous donnez votre{" "}
              <Text className="font-semibold">
                consentement préalable et spécifique au démarchage téléphonique
              </Text>{" "}
              pour cette mise en relation, conformément à la réglementation. Vous
              pourrez le retirer à tout moment.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Non, je refuse"
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Non, je refuse</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="OK, j'accepte"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            <Ionicons name="checkmark" size={15} color={c.btnText} />
            <Text
              className="text-sm font-semibold"
              style={{ color: c.btnText }}
              numberOfLines={1}
            >
              OK, j&apos;accepte
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
