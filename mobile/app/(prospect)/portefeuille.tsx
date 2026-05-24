// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web) :
// 3 soldes (Disponible / En séquestre / Cumulé depuis ouverture), chacun
// avec sa ligne "BUUPP Coins" (= Math.round(cents)), sous-titre cumulé
// "{X} mois · {Y} mise(s) en relation", et colonne Palier sur les
// mouvements. Le mobile omet l'action "Retirer" et l'export CSV (hors
// périmètre — parité de données uniquement).
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

// Illustration 3D thiings.co (Empty Wallet) — empty state mouvements.
const EMPTY_WALLET = require("../../assets/images/empty-wallet.png");

import { useFlashSheet } from "../../components/flash-sheet-context";
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
  useMeTyped,
  useProspectMovements,
  useProspectScore,
  useProspectVerification,
  useProspectWallet,
  type MovementRelation,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Mirror Prospect.jsx — libellés affichés pour chaque tier de vérif.
const VERIF_LABELS: Record<string, string> = {
  basique: "Basique",
  verifie: "Vérifié",
  certifie_confiance: "Certifié confiance",
};
// 1-based : "Niveau 1/3" / "2/3" / "3/3" (parité fn verifTierPosition web).
function verifTierPosition(tier: string | undefined): number {
  if (tier === "verifie") return 2;
  if (tier === "certifie_confiance") return 3;
  return 1;
}

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
  const me = useMeTyped();
  const verif = useProspectVerification();
  const score = useProspectScore();
  useRefetchOnFocus(w, m, verif, score);
  // Relation sélectionnée pour la modale de détail (parité web :
  // RelationDetailModal ouverte au clic sur une ligne d'historique).
  const [detail, setDetail] = useState<MovementRelation | null>(null);

  // Deep-link push : ?openFlash=<dealId> → ouvre le FlashDealsSheet.
  // V1 : on ignore la valeur de dealId (l'user voit la liste complète).
  const params = useLocalSearchParams<{ openFlash?: string }>();
  const flashSheet = useFlashSheet();
  useEffect(() => {
    if (typeof params.openFlash !== "string") return;
    flashSheet.open();
    router.setParams({ openFlash: undefined });
  }, [params.openFlash, flashSheet]);

  // Hero (LinearGradient) — remplace le titre « Votre portefeuille » par
  // les deux pastilles Vérification + BUUPP Score (parité avec les
  // StatusPills du ProspectHeader web).
  const hour = new Date().getHours();
  const hello = hour >= 19 ? "Bonsoir" : "Bonjour";
  const firstName = me.data?.prenom?.trim() || null;
  const greeting = firstName ? `${hello} ${firstName}` : hello;
  const verifValue = verif.data
    ? `${VERIF_LABELS[verif.data.tier] ?? "Basique"} · Niveau ${verifTierPosition(verif.data.tier)}/3`
    : "…";
  // Affichage "{score}/1000" — la borne haute (1000) est explicitée dans
  // l'API (cf. /api/prospect/score) et la page Score (« {p.score} / 1000 »).
  const scoreValue = score.data ? `${score.data.score}/1000` : "…";

  // Extras du header compact (visibles quand la page est scrollée vers
  // le bas) : disponible + séquestre, chacun précédé d'une petite
  // icône colorée (mêmes teintes que les cards : violet pour le
  // portefeuille, ambre pour le séquestre). Format compact sans
  // centimes pour rester lisible dans la barre.
  const eurCompact = (n: number) =>
    `${Math.round(n).toLocaleString("fr-FR")} €`;
  const compactExtras = useMemo(
    () =>
      w.data
        ? [
            {
              icon: "wallet" as const,
              value: eurCompact(w.data.availableEur),
              color: "#7C5CFC",
            },
            {
              icon: "lock-closed" as const,
              value: eurCompact(w.data.escrowEur),
              color: "#F2B65A",
            },
          ]
        : undefined,
    [w.data],
  );

  return (
    <ScrollScreen
      onRefresh={() =>
        Promise.all([w.refetch(), m.refetch(), verif.refetch(), score.refetch()])
      }
      compactExtras={compactExtras}
    >
      {/* Hero gradient — greeting + Vérification + BUUPP Score (parité web) */}
      <LinearGradient
        colors={["#7C5CFC", "#13235B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, padding: 20, paddingTop: 22 }}
      >
        <Text
          className="mb-4 font-serif text-xl text-paper"
          numberOfLines={1}
        >
          {greeting}
        </Text>
        {/* Vérification prend toute la largeur restante (flex: 1) pour
            afficher son chip en totalité (« Basique · Niveau 1/3 »).
            BUUPP Score est poussé à droite, aligné à droite, à largeur
            auto. */}
        <View className="flex-row items-start gap-3">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              className="font-mono text-[10px] uppercase text-white/60"
              style={{ letterSpacing: 1 }}
            >
              Vérification
            </Text>
            <View className="mt-1.5 self-start rounded-full bg-white/15 px-3 py-1.5">
              <Text
                className="text-[12px] font-semibold text-paper"
                numberOfLines={1}
              >
                {verifValue}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text
              className="font-mono text-[10px] uppercase text-white/60"
              style={{ letterSpacing: 1 }}
            >
              BUUPP Score
            </Text>
            <View
              className="mt-1.5 self-end rounded-full px-3 py-1.5"
              style={{ backgroundColor: "rgba(22, 163, 74, 0.35)" }}
            >
              <Text className="text-[12px] font-semibold text-paper">
                {scoreValue}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <QueryGate query={w}>
        {(d) => (
          <>
            <Card tone="violet">
              {/* Header : label + icône wallet alignés horizontalement.
                  Remplace l'ancien badge auto-rendu par <Card badge=...>. */}
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-serif text-xl text-ink">
                  Votre portefeuille
                </Text>
                <View className="h-10 w-10 items-center justify-center rounded-full bg-violet-soft">
                  <Ionicons name="wallet-outline" size={20} color="#7C5CFC" />
                </View>
              </View>
              <Text className="font-mono text-[13px] uppercase text-ink-4">
                Disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-violet">
                {eur(d.availableEur)}
              </Text>
              <CoinsLine coins={coins(d.availableCents)} />
              <Text className="mt-1 text-sm text-ink-4">
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
                className="text-[12px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 0.8 }}
              >
                Cumulé depuis ouverture
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.lifetimeGainsEur)}
              </Text>
              <CoinsLine coins={coins(d.lifetimeGainsCents)} />
              <Text className="mt-2 text-sm text-ink-4">
                {lifetimeSub(d.accountCreatedAt, d.relationsCount)}
              </Text>
            </Card>
          </>
        )}
      </QueryGate>

      <Card badge={{ icon: "swap-vertical-outline", tone: "sky" }} tone="sky">
        <Text
          className="text-[13px] font-bold uppercase text-ink-4"
          style={{ letterSpacing: 1.2 }}
        >
          Mouvements
        </Text>
        <QueryGate query={m}>
          {(d) => (
            (d.movements?.length ?? 0) === 0 ? (
              // Empty state — illustration 3D thiings.co (Empty Wallet)
              // sur cercle pastel ambre, titre serif + sous-titre amical
              // (esthétique cohérente avec messages-sheet.tsx).
              <View className="mt-4 items-center px-4 pb-2">
                <View
                  className="mb-3 h-40 w-40 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(242, 182, 90, 0.10)" }}
                >
                  <Image
                    source={EMPTY_WALLET}
                    style={{ width: 128, height: 128 }}
                    contentFit="contain"
                    accessibilityLabel="Portefeuille vide"
                  />
                </View>
                <Text className="font-serif text-xl text-ink">
                  Aucun mouvement
                </Text>
                <Text className="mt-1.5 text-center text-[14px] leading-5 text-ink-4">
                  Vos prochaines mises en relation,{"\n"}gains et retraits s'afficheront ici.
                </Text>
              </View>
            ) : (
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
                  // items-start (au lieu d'items-center) : le montant +
                  // chevron remontent en haut, alignés sur la ligne
                  // « origine ». Le chip Palier de la ligne 2 ne touche
                  // plus la rémunération à droite.
                  className={`flex-row items-start justify-between rounded-2xl bg-paper p-3 ${
                    clickable ? "active:opacity-70" : ""
                  }`}
                  style={{ borderWidth: 0.7, borderColor: "#CBC7B9" }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-base text-ink-2" numberOfLines={1}>
                      {mv.origin}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-2">
                      <Text className="font-mono text-[12px] text-ink-4">
                        {dateFr(mv.date)} · {mv.statusLabel}
                      </Text>
                      {tStr ? (
                        <View className="rounded-full border border-line bg-ivory px-2 py-0.5">
                          <Text className="font-mono text-[11px] text-ink-3">
                            {tLabel} {tStr}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`font-serif text-lg ${
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
            )
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
