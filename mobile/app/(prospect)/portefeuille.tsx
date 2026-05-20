// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web) :
// 3 soldes (Disponible / En séquestre / Cumulé depuis ouverture), chacun
// avec sa ligne "BUUPP Coins" (= Math.round(cents)), sous-titre cumulé
// "{X} mois · {Y} mise(s) en relation", et colonne Palier sur les
// mouvements. Le mobile omet l'action "Retirer" et l'export CSV (hors
// périmètre — parité de données uniquement).
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MovementDetailSheet } from "../../components/movement-detail-sheet";
import {
  Card,
  CoinsLine,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
  Stat,
} from "../../components/screen";
import {
  useProspectMovements,
  useProspectWallet,
  type MovementRelation,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Entier "coins" affiché : Math.round(cents) puis séparateur fr-FR
// (identique à `coins.toLocaleString('fr-FR')` du web).
const coins = (cents: unknown) =>
  Math.round(Number(cents ?? 0)).toLocaleString("fr-FR");

// Sérialise un ensemble de paliers en notation compacte :
//   [3]          → "3"
//   [1,2,3]      → "1-3"
//   [1,3,5]      → "1,3,5"
//   [1,2,5]      → "1-2,5"
//   [1,2,4,5]    → "1-2,4-5"
// Renvoie « null » si rien à afficher.
function formatPaliers(tiers: number[]): string | null {
  const uniq = [...new Set(tiers.filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
  if (uniq.length === 0) return null;
  const groups: string[] = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i <= uniq.length; i++) {
    const cur = uniq[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return groups.join(",");
}

// Tire la liste des paliers depuis un Movement (priorité à `tiers[]`,
// fallback sur l'unique `tier` rétrocompatible).
function movementTiers(mv: { tier: number | null; tiers?: number[] | null }) {
  if (Array.isArray(mv.tiers) && mv.tiers.length > 0) return mv.tiers;
  if (mv.tier != null) return [mv.tier];
  return null;
}

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
  // Relation sélectionnée pour la modale de détail (parité web :
  // RelationDetailModal ouverte au clic sur une ligne d'historique).
  const [detail, setDetail] = useState<MovementRelation | null>(null);

  return (
    <ScrollScreen
      onRefresh={() => Promise.all([w.refetch(), m.refetch()])}
      hero={{
        title: "Votre portefeuille",
        nav: "menu",
      }}
    >
      <QueryGate query={w}>
        {(d) => (
          <>
            <Card badge={{ icon: "wallet-outline", tone: "violet" }} tone="violet">
              <Text className="font-mono text-[11px] uppercase text-ink-4">
                Disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-violet">
                {eur(d.availableEur)}
              </Text>
              <CoinsLine coins={coins(d.availableCents)} />
              <Text className="mt-1 text-xs text-ink-4">
                {d.canWithdraw
                  ? "Retirable immédiatement · minimum de 5 €"
                  : `Retirable à partir de ${eur(d.withdrawThresholdEur)} de gains`}
              </Text>
            </Card>

            <View className="flex-row gap-3">
              <Stat
                label="En séquestre"
                value={eur(d.escrowEur)}
                coins={coins(d.escrowCents)}
                icon="lock-closed"
                tone="amber"
              />
              <Stat
                label="Ce mois"
                value={eur(d.monthGainsEur)}
                icon="trending-up"
                tone="teal"
              />
            </View>

            <Card tone="amber">
              <Text
                className="text-[10px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 0.8 }}
              >
                Cumulé depuis ouverture
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.lifetimeGainsEur)}
              </Text>
              <CoinsLine coins={coins(d.lifetimeGainsCents)} />
              <Text className="mt-2 text-xs text-ink-4">
                {lifetimeSub(d.accountCreatedAt, d.relationsCount)}
              </Text>
            </Card>
          </>
        )}
      </QueryGate>

      <Card badge={{ icon: "swap-vertical-outline", tone: "sky" }} tone="sky">
        <Text
          className="text-[11px] font-bold uppercase text-ink-4"
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
            <View className="mt-3 gap-2">
              {d.movements.map((mv) => {
                const tList = movementTiers(mv);
                const tStr = tList ? formatPaliers(tList) : null;
                const tLabel =
                  tList && tList.length > 1 ? "Paliers" : "Palier";
                // Cliquable uniquement quand le mouvement est lié à une
                // relation (escrow/credit issu d'une mise en relation).
                // Retraits IBAN / parrainages sans campagne restent
                // non interactifs — parité avec le tableau web.
                const clickable = !!mv.relation;
                return (
                <Pressable
                  key={mv.id}
                  onPress={clickable ? () => setDetail(mv.relation) : undefined}
                  disabled={!clickable}
                  accessibilityRole={clickable ? "button" : undefined}
                  accessibilityLabel={
                    clickable
                      ? `Détail de ${mv.origin}`
                      : undefined
                  }
                  className={`flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3 ${
                    clickable ? "active:opacity-70" : ""
                  }`}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm text-ink-2" numberOfLines={1}>
                      {mv.origin}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-2">
                      <Text className="font-mono text-[10px] text-ink-4">
                        {dateFr(mv.date)} · {mv.statusLabel}
                      </Text>
                      {tStr ? (
                        <View className="rounded-full border border-line bg-ivory px-2 py-0.5">
                          <Text className="font-mono text-[9px] text-ink-3">
                            {tLabel} {tStr}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`font-serif text-base ${
                        mv.amountCents > 0 ? "text-violet" : "text-ink-3"
                      }`}
                    >
                      {mv.sign}
                      {eur(Math.abs(mv.amountEur))}
                    </Text>
                    {clickable ? (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#B7BCC7"
                      />
                    ) : null}
                  </View>
                </Pressable>
                );
              })}
            </View>
          )}
        </QueryGate>
      </Card>

      <MovementDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        relation={detail}
      />
    </ScrollScreen>
  );
}
