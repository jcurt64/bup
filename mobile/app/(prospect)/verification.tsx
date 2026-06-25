// Paliers de vérification — /api/prospect/verification.
// Champs/libellés = Prospect.jsx fn VerifTiers (web).
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen } from "../../components/screen";
import { useProspectVerification } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Source unique pour les paliers — clés + libellés.
// Clés = valeurs renvoyées par /api/prospect/verification (route.ts).
// Libellés/textes EXACTS = Prospect.jsx VERIF_TIERS (web).
const TIERS = [
  {
    key: "basique",
    label: "Basique",
    done: "Compte créé",
    requirement: "Création du compte",
  },
  {
    key: "verifie",
    label: "Vérifié",
    done: "Téléphone vérifié",
    requirement:
      "Vérifiez votre numéro de téléphone par SMS pour passer au palier Vérifié.",
  },
  {
    key: "certifie_confiance",
    label: "Certifié confiance",
    done: "Rendez-vous physique accepté",
    requirement:
      "Acceptez un rendez-vous physique proposé par un professionnel.",
  },
] as const;

// Dérivé depuis TIERS : pas de liste séparée à synchroniser.
const TIER_LABEL: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.key, t.label] as [string, string]),
);

export default function Verification() {
  const q = useProspectVerification();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Paliers de vérification",
        title: "Vos paliers",
        desc: "Trois paliers : Basique (à la création), Vérifié (numéro de téléphone vérifié par SMS), Certifié confiance (rendez-vous physique accepté). Chaque palier débloque des demandes plus exigeantes et mieux rémunérées.",
        nav: "drawer",
      }}
    >
      <QueryGate query={q}>
        {(d) => {
          const currentIdx = TIERS.findIndex((t) => t.key === d.tier);
          return (
            <>
              {/* Palier actuel + barre de progression */}
              <Card dark>
                <Text className="font-mono text-[11px] uppercase text-ink-5">
                  Palier actuel
                </Text>
                <Text className="mt-1 font-serif text-3xl text-paper">
                  {TIER_LABEL[d.tier] ?? d.tier}
                  {currentIdx >= 0 && (
                    <Text className="font-sans text-base text-ink-5">
                      {" · Palier "}{currentIdx + 1}/{TIERS.length}
                    </Text>
                  )}
                </Text>
                <View
                  className="mt-3 h-2 overflow-hidden rounded-full bg-ink-4"
                  accessible
                  accessibilityLabel={`Progression de vérification : ${Math.round(d.progress)} %`}
                >
                  <View
                    className="h-2 rounded-full bg-violet"
                    style={{ width: `${Math.max(0, Math.min(100, d.progress))}%` }}
                  />
                </View>
              </Card>

              {/* Les 3 paliers en cartes */}
              {TIERS.map((t, i) => {
                const reached = i <= currentIdx;
                const isCurrent = i === currentIdx;
                const statusLabel = isCurrent
                  ? "Palier actuel"
                  : reached
                    ? "Palier validé"
                    : "À venir";
                return (
                  <Card key={t.key} className={isCurrent ? "border-ink" : ""}>
                    <View className="flex-row items-center justify-between">
                      <Text className="font-mono text-[9px] uppercase text-ink-4">
                        — Palier {i + 1}
                      </Text>
                      <Text
                        className={`text-[11px] font-bold uppercase ${reached ? "text-violet" : "text-ink-4"}`}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                    <Text className="mt-1 font-serif text-xl text-ink">{t.label}</Text>

                    {/* Description/prérequis du palier — texte EXACT web (VERIF_TIERS). */}
                    <Text className="mt-1 text-xs leading-5 text-ink-3">
                      {reached ? `${t.done}.` : t.requirement}
                    </Text>

                    {/* CTA palier Vérifié = vérification du téléphone par SMS
                        (et NON le RIB : le RIB ne valide pas ce palier, cf.
                        /api/prospect/verification → phone_verified_at). La
                        vérification SMS se fait dans Préférences. Parité fix web. */}
                    {t.key === "verifie" && !reached ? (
                      <Pressable
                        className="mt-3 self-start rounded-full border border-line px-4 py-2"
                        onPress={() => router.push("/(prospect)/preferences")}
                      >
                        <Text className="text-xs text-ink-2">Vérifier mon téléphone</Text>
                      </Pressable>
                    ) : null}
                  </Card>
                );
              })}

              {/* Coordonnées bancaires complètes */}
              <Card badge={{ icon: "card-outline", tone: "teal" }}>
                <Text className="font-serif text-lg text-ink">Coordonnées bancaires</Text>
                {d.rib ? (
                  <View className="mt-1">
                    <Text className="text-sm text-ink-2">{d.rib.ibanMasked}</Text>
                    <Text className="text-xs text-ink-4">
                      {d.rib.holderName} · {d.rib.bic}
                    </Text>
                    <Text className="mt-1 text-xs text-ink-4">
                      {d.rib.validated
                        ? `Validé le ${dateFr(d.rib.validatedAt)}`
                        : "En attente de validation"}
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-sm text-ink-4">
                    Aucun RIB enregistré — ajoutez-le dans Préférences.
                  </Text>
                )}
              </Card>

              {/* Acceptations physiques (palier Certifié confiance) */}
              <Card badge={{ icon: "checkmark-circle-outline", tone: "teal" }}>
                <Text className="font-serif text-lg text-ink">
                  Acceptations physiques
                </Text>
                <Text className="mt-1 font-serif text-2xl text-violet">
                  {d.physicalAcceptances}
                </Text>
                <Text className="mt-0.5 text-[11px] text-ink-4">rendez-vous physiques acceptés</Text>
              </Card>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
