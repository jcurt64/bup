// Informations fiscales — /api/prospect/fiscal. Téléchargements récap /
// reçu DGFiP via téléchargement authentifié Bearer Clerk (T19).
import { Alert, Pressable, Text, View } from "react-native";

import { useAuthedDownload } from "../../lib/use-authed-download";
import { Card, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { useProspectFiscal } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Seuils statiques affichés dans la carte "Seuils à retenir" (parité web).
const SEUILS = [
  {
    amount: "305 €",
    label: "Franchise annuelle",
    desc: "En dessous, aucune déclaration URSSAF n'est requise.",
  },
  // Le deuxième seuil est dynamique (thresholdEur depuis l'API).
  {
    amount: null,
    label: "Seuil DGFiP",
    desc: "Les plateformes transmettent le récapitulatif des usagers au-dessus de ce montant.",
  },
  {
    amount: "77 700 €",
    label: "Plafond micro-BIC",
    desc: "Au-delà, bascule en régime réel. BUUPP vous alertera 6 mois avant.",
  },
] as const;

export default function FiscalScreen() {
  const q = useProspectFiscal();
  const download = useAuthedDownload();
  useRefetchOnFocus(q);

  const open = async (path: string) => {
    try {
      await download(path);
    } catch {
      Alert.alert("Erreur", "Téléchargement impossible.");
    }
  };

  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Informations fiscales",
        title: "Vos revenus déclarables",
        desc: "Récapitulatif annuel de vos gains BUUPP et seuils de déclaration DGFiP.",
        nav: "drawer",
      }}
    >
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card badge={{ icon: "calendar-outline", tone: "sky" }}>
              <Text className="font-serif text-lg text-ink">
                Année {d.currentYear.year}
              </Text>
              <Text className="mt-1 font-serif text-3xl text-violet">
                {eur(d.currentYear.totalEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-4">
                {d.currentYear.transactionCount} transaction
                {d.currentYear.transactionCount > 1 ? "s" : ""} ·{" "}
                {d.currentYear.thresholdReached
                  ? "Seuil DGFiP atteint"
                  : `Seuil : ${eur(d.thresholdEur)} / ${d.thresholdTransactions} tx`}
              </Text>
              {/* Barre de progression — gains actuels / seuil EUR (parité web fn Fiscal). */}
              <View
                className="mt-3 h-2 overflow-hidden rounded-full bg-ivory-2"
                accessible
                accessibilityLabel={`Progression vers le seuil déclaratif : ${Math.round(Math.max(0, Math.min(100, (d.currentYear.totalEur / d.thresholdEur) * 100)))} %`}
              >
                <View
                  className="h-2 rounded-full bg-violet"
                  style={{
                    width: `${Math.max(0, Math.min(100, (d.currentYear.totalEur / d.thresholdEur) * 100))}%`,
                  }}
                />
              </View>
              {/* Message qualitatif seuil — texte EXACT web (fn Fiscal). */}
              <Text className="mt-3 text-xs text-ink-4">
                {d.currentYear.thresholdReached
                  ? "Vous avez dépassé le seuil. BUUPP transmettra votre récapitulatif à la DGFiP en janvier prochain."
                  : "Vous n'avez pas atteint le seuil. Aucune obligation de déclaration spécifique pour l'instant."}
              </Text>
              <Pressable
                className="mt-3 self-start rounded-full border border-line px-4 py-2"
                onPress={() =>
                  open(`/api/prospect/fiscal/${d.currentYear.year}/recap`)
                }
              >
                <Text className="text-xs text-ink-2">Télécharger le récapitulatif</Text>
              </Pressable>
            </Card>

            <Card badge={{ icon: "calendar-outline", tone: "violet" }}>
              <Text className="font-serif text-lg text-ink">
                Année {d.previousYear.year}
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.previousYear.totalEur)}
              </Text>
              {/* Détail transmission DGFiP — texte EXACT web (fn Fiscal). */}
              <Text className="mt-1 text-xs text-ink-4">
                {d.previousYear.reportedToDgfip
                  ? `Récapitulatif fiscal ${d.previousYear.year} transmis le 31 janvier ${d.previousYear.year + 1}.`
                  : `Aucune transmission DGFiP pour ${d.previousYear.year} : seuil non atteint (${d.previousYear.transactionCount} transactions, ${eur(d.previousYear.totalEur)}).`}
              </Text>
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  className="rounded-full border border-line px-4 py-2"
                  onPress={() =>
                    open(`/api/prospect/fiscal/${d.previousYear.year}/recap`)
                  }
                >
                  <Text className="text-xs text-ink-2">Récapitulatif</Text>
                </Pressable>
                {d.previousYear.reportedToDgfip ? (
                  <Pressable
                    className="rounded-full border border-line px-4 py-2"
                    onPress={() =>
                      open(
                        `/api/prospect/fiscal/${d.previousYear.year}/dgfip-receipt`,
                      )
                    }
                  >
                    <Text className="text-xs text-ink-2">Reçu DGFiP</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
            {/* Seuils à retenir — parité web fn Fiscal (3 seuils statiques + 1 dynamique). */}
            <Card badge={{ icon: "information-circle-outline", tone: "amber" }}>
              <Text className="font-serif text-lg text-ink">Seuils à retenir</Text>
              <View className="mt-3 gap-3">
                {SEUILS.map((s) => {
                  const amountStr =
                    s.amount !== null ? s.amount : eur(d.thresholdEur);
                  return (
                    <View key={s.label} className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-sm text-ink-2">{s.label}</Text>
                        <Text className="text-xs text-ink-4">{s.desc}</Text>
                      </View>
                      <Text className="font-serif text-sm text-ink-2">{amountStr}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
