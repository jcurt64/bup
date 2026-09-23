// Popups du wizard de création de campagne (répliques des modales web de
// Pro.jsx) : solde insuffisant, confirmation « retirer les certifiés
// confiance », et explication « multi-paliers » (matching cumulatif).
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { eur } from "./screen";
import { useTheme } from "../lib/theme";

export type InsufficientDetails = {
  balanceCents: number;
  budgetCents: number;
  commissionCents: number;
  planFeeCents: number;
  planLabel: string;
  vitrineFeeCents: number;
  neededCents: number;
};

/** « Solde insuffisant » — miroir d'InsufficientBalanceModal (web). */
export function InsufficientBalanceSheet({
  details,
  onCancel,
  onRecharge,
}: {
  details: InsufficientDetails | null;
  onCancel: () => void;
  /** Absent → pas de bouton de recharge (achats masqués sur iOS). */
  onRecharge?: () => void;
}) {
  const { c } = useTheme();
  const d = details;
  const missing = d ? Math.max(0, d.neededCents - d.balanceCents) : 0;
  const rows: [string, number][] = d
    ? [
        ["Solde disponible", d.balanceCents],
        ["Budget de la campagne", d.budgetCents],
        ["Commission BUUPP max. (10 %)", d.commissionCents],
        ...(d.planFeeCents > 0
          ? [[`Frais cycle ${d.planLabel} (1ʳᵉ campagne)`, d.planFeeCents] as [string, number]]
          : []),
        ...(d.vitrineFeeCents > 0 ? [["Option La Vitrine", d.vitrineFeeCents] as [string, number]] : []),
      ]
    : [];
  return (
    <BottomSheet visible={!!d} onClose={onCancel}>
      <View className="items-center">
        <View
          className="items-center justify-center"
          style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: c.amberSoft }}
        >
          <Ionicons name="wallet-outline" size={26} color={c.accAmber} />
        </View>
        <Text className="mt-2 font-serif text-ink" style={{ fontSize: 22 }}>
          Solde insuffisant
        </Text>
        <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-3">
          Pour lancer cette campagne, votre solde doit couvrir le budget plus la commission BUUPP{" "}
          <Text style={{ fontWeight: "700" }}>maximale</Text> (10 %) — celle-ci n&apos;est facturée
          qu&apos;aux acceptations effectives.
        </Text>
      </View>

      <View
        className="mt-4 rounded-2xl p-3.5"
        style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderSoft }}
      >
        {rows.map(([l, v], i) => (
          <View key={i} className="flex-row justify-between py-1">
            <Text className="flex-1 text-[13px] text-ink-4">{l}</Text>
            <Text className="font-mono text-[13px] text-ink">{eur(v / 100)}</Text>
          </View>
        ))}
        <View
          className="mt-2 flex-row justify-between pt-2"
          style={{ borderTopWidth: 1, borderTopColor: c.borderSoft }}
        >
          <Text className="text-[13.5px] font-semibold text-ink">Montant manquant</Text>
          <Text className="font-mono text-[13.5px] font-bold" style={{ color: c.accAmber }}>
            {eur(missing / 100)}
          </Text>
        </View>
        <View
          className="mt-2.5 flex-row rounded-xl px-2.5 py-2"
          style={{ gap: 6, backgroundColor: c.goodSoft }}
        >
          <Ionicons name="information-circle-outline" size={15} color={c.good} />
          <Text className="flex-1 text-[11.5px] leading-4" style={{ color: c.good }}>
            La commission n&apos;est prélevée qu&apos;à chaque acceptation. Sans acceptation, aucune
            commission n&apos;est facturée.
          </Text>
        </View>
      </View>

      <View className="mt-5 flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="flex-1 items-center rounded-full border py-3.5 active:opacity-70"
          style={{ borderColor: c.borderSoft }}
        >
          <Text className="text-sm font-semibold text-ink-3">Plus tard</Text>
        </Pressable>
        {onRecharge ? (
        <Pressable
          onPress={onRecharge}
          accessibilityRole="button"
          className="flex-row items-center justify-center rounded-full py-3.5 active:opacity-80"
          style={{ flex: 2, gap: 6, backgroundColor: c.btnBg }}
        >
          <Ionicons name="add-circle-outline" size={17} color={c.btnText} />
          <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
            Recharger mon crédit
          </Text>
        </Pressable>
        ) : null}
      </View>
      <Text className="mt-3 text-center text-[11px] italic text-ink-4">
        {onRecharge
          ? "Votre saisie est conservée : vous reprendrez le lancement juste après la recharge."
          : "Votre saisie est conservée dans le brouillon."}
      </Text>
    </BottomSheet>
  );
}

/** Confirmation avant de retirer les « certifié confiance » de la cible. */
export function ExcludeCertifiedSheet({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { c } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View
          className="items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: c.tintViolet }}
        >
          <Text style={{ fontSize: 20 }}>🤔</Text>
        </View>
        <Text className="font-serif text-ink" style={{ fontSize: 21 }}>
          Vraiment ?
        </Text>
      </View>
      <Text className="mt-3 text-[14px] leading-5 text-ink-3">
        Dommage 😕 — vous passez à côté des prospects « certifié confiance », les profils les plus
        engagés de BUUPP. Votre cible risque d&apos;être réduite, et vous renoncez aux meilleurs taux
        d&apos;acceptation.
      </Text>
      <View className="mt-5 flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="flex-1 items-center rounded-full border py-3.5 active:opacity-70"
          style={{ borderColor: c.borderSoft }}
        >
          <Text className="text-center text-[13px] font-semibold text-ink-3">Non, je garde ce profil</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          className="flex-1 items-center rounded-full py-3.5 active:opacity-80"
          style={{ backgroundColor: c.accVioletDeep }}
        >
          <Text className="text-[13px] font-semibold text-white">Oui, je confirme</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Popup pédagogique affichée au 1er ajout d'un 2ᵉ palier (matching cumulatif). */
export function MultiTierSheet({
  visible,
  tiers,
  onClose,
}: {
  visible: boolean;
  tiers: number[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  const list = [...tiers].sort((a, b) => a - b).map((t) => `palier ${t}`).join(", ");
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 40, lineHeight: 46, textAlign: "center" }}>🎯</Text>
      <Text className="mt-2 text-center font-serif text-ink" style={{ fontSize: 22, lineHeight: 28 }}>
        Mode chasseur de précision activé !
      </Text>
      <Text className="mt-3 text-center text-[14px] leading-5 text-ink-3">
        Vous demandez {tiers.length} paliers de données (
        <Text style={{ color: c.text, fontWeight: "700" }}>{list}</Text>).
        {"\n\n"}⚠️ Seuls les prospects qui ont renseigné{" "}
        <Text style={{ color: c.text, fontWeight: "700" }}>tous ces paliers</Text> pourront matcher
        avec votre campagne. Plus vous demandez de données, plus votre cible est qualifiée… mais plus
        le cercle se resserre 🔍
      </Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        className="mt-5 items-center rounded-full py-3.5 active:opacity-80"
        style={{ backgroundColor: c.btnBg }}
      >
        <Text className="text-[15px] font-semibold" style={{ color: c.btnText }}>
          OK, j&apos;ai capté 🚀
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
