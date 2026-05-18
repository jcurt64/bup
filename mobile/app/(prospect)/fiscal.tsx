// Informations fiscales — /api/prospect/fiscal. Téléchargements récap /
// reçu DGFiP via WebBrowser (routes protégées, session Clerk).
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { apiBase } from "../../lib/api";
import { Card, eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProspectFiscal } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function FiscalScreen() {
  const q = useProspectFiscal();
  useRefetchOnFocus(q);

  // NB: routes protégées — l'ouverture WebBrowser n'envoie pas le Bearer
  // Clerk (401 attendu). Téléchargement authentifié à brancher via le
  // helper partagé (tâche T19, commun avec l'écran Messages).
  const open = (path: string) =>
    WebBrowser.openBrowserAsync(`${apiBase()}${path}`);

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Informations fiscales"
        title="Vos revenus déclarables"
        desc="Récapitulatif annuel de vos gains BUUPP et seuils de déclaration DGFiP."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card>
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
              <Pressable
                className="mt-3 self-start rounded-full border border-line px-4 py-2"
                onPress={() =>
                  open(`/api/prospect/fiscal/${d.currentYear.year}/recap`)
                }
              >
                <Text className="text-xs text-ink-2">Télécharger le récapitulatif</Text>
              </Pressable>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">
                Année {d.previousYear.year}
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.previousYear.totalEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-4">
                {d.previousYear.transactionCount} transaction
                {d.previousYear.transactionCount > 1 ? "s" : ""} ·{" "}
                {d.previousYear.reportedToDgfip
                  ? "Déclaré à la DGFiP"
                  : "Non déclaré"}
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
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
