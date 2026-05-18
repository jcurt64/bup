// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web) :
// 3 soldes (Disponible / En séquestre / Cumulé depuis ouverture), chacun
// avec sa ligne "BUUPP Coins" (= Math.round(cents)), sous-titre cumulé
// "{X} mois · {Y} mise(s) en relation", et colonne Palier sur les
// mouvements. Le mobile omet l'action "Retirer" et l'export CSV (hors
// périmètre — parité de données uniquement).
import { Text, View } from "react-native";

import { Card, dateFr, eur, QueryGate, ScrollScreen, Stat } from "../../components/screen";
import {
  useProspectMovements,
  useProspectWallet,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Entier "coins" affiché : Math.round(cents) puis séparateur fr-FR
// (identique à `coins.toLocaleString('fr-FR')` du web).
const coins = (cents: unknown) =>
  Math.round(Number(cents ?? 0)).toLocaleString("fr-FR");

// Sous-titre "Cumulé depuis ouverture" : nombre de mois écoulés depuis la
// création du compte + nombre réel de mises en relation. Reproduit à
// l'identique la fonction `lifetimeSub` du web (Prospect.jsx).
function lifetimeSub(accountCreatedAt: string | null, relationsCount: number) {
  const rel = `${relationsCount} mise${relationsCount > 1 ? "s" : ""} en relation`;
  if (!accountCreatedAt) return rel;
  const created = new Date(accountCreatedAt);
  if (Number.isNaN(created.getTime())) return rel;
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth()),
  );
  return `${months} mois · ${rel}`;
}

export default function Portefeuille() {
  const w = useProspectWallet();
  const m = useProspectMovements();
  useRefetchOnFocus(w, m);

  return (
    <ScrollScreen onRefresh={() => Promise.all([w.refetch(), m.refetch()])}>
      <QueryGate query={w}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-paper">
                {eur(d.availableEur)}
              </Text>
              <Text className="mt-1 font-mono text-xs text-ink-5">
                {coins(d.availableCents)} BUUPP Coins
              </Text>
              <Text className="mt-1 text-xs text-ink-5">
                {d.canWithdraw
                  ? "Retirable immédiatement · minimum de 5 €"
                  : `Retirable à partir de ${eur(d.withdrawThresholdEur)} de gains`}
              </Text>
            </Card>

            <View className="flex-row gap-3">
              <Stat
                label="En séquestre"
                value={eur(d.escrowEur)}
                hint={`${coins(d.escrowCents)} BUUPP Coins`}
              />
              <Stat label="Ce mois" value={eur(d.monthGainsEur)} />
            </View>

            <Card>
              <Text
                className="text-[10px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 0.8 }}
              >
                Cumulé depuis ouverture
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.lifetimeGainsEur)}
              </Text>
              <Text className="mt-1 font-mono text-xs text-ink-4">
                {coins(d.lifetimeGainsCents)} BUUPP Coins
              </Text>
              <Text className="mt-2 text-xs text-ink-4">
                {lifetimeSub(d.accountCreatedAt, d.relationsCount)}
              </Text>
            </Card>
          </>
        )}
      </QueryGate>

      <Text
        className="mt-2 text-[11px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 1.2 }}
      >
        Mouvements
      </Text>
      <QueryGate
        query={m}
        isEmpty={(d) => (d.movements?.length ?? 0) === 0}
        emptyLabel="Aucun mouvement pour le moment."
      >
        {(d) => (
          <View className="gap-2">
            {d.movements.map((mv) => (
              <View
                key={mv.id}
                className="flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm text-ink-2" numberOfLines={1}>
                    {mv.origin}
                  </Text>
                  <View className="mt-0.5 flex-row items-center gap-2">
                    <Text className="font-mono text-[10px] text-ink-4">
                      {dateFr(mv.date)} · {mv.statusLabel}
                    </Text>
                    {mv.tier != null ? (
                      <View className="rounded-full border border-line bg-ivory px-2 py-0.5">
                        <Text className="font-mono text-[9px] text-ink-3">
                          Palier {mv.tier}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text
                  className={`font-serif text-base ${
                    mv.amountCents > 0 ? "text-violet" : "text-ink-3"
                  }`}
                >
                  {mv.sign}
                  {eur(Math.abs(mv.amountEur))}
                </Text>
              </View>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
