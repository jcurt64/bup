// Paliers de vérification — /api/prospect/verification.
// Champs/libellés = Prospect.jsx fn VerifTiers (web).
import { Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProspectVerification } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Libellés alignés sur VERIF_TIERS du web (Prospect.jsx).
// Clés = valeurs renvoyées par /api/prospect/verification (route.ts).
const TIER_LABEL: Record<string, string> = {
  basique: "Basique",
  verifie: "Vérifié",
  certifie_confiance: "Certifié confiance",
};

// Les 3 paliers dans l'ordre, avec leur index.
const TIERS = [
  { key: "basique", label: "Basique" },
  { key: "verifie", label: "Vérifié" },
  { key: "certifie_confiance", label: "Certifié confiance" },
] as const;

export default function Verification() {
  const q = useProspectVerification();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Paliers de vérification"
        title="Vos paliers"
        desc="Trois paliers : Basique (à la création), Vérifié (numéro de téléphone vérifié par SMS), Certifié confiance (rendez-vous physique accepté). Chaque palier débloque des demandes plus exigeantes et mieux rémunérées."
      />
      <QueryGate query={q}>
        {(d) => {
          const currentIdx = Math.max(
            0,
            TIERS.findIndex((t) => t.key === d.tier),
          );
          return (
            <>
              {/* Palier actuel + barre de progression */}
              <Card dark>
                <Text className="font-mono text-[11px] uppercase text-ink-5">
                  Palier actuel
                </Text>
                <Text className="mt-1 font-serif text-3xl text-paper">
                  {TIER_LABEL[d.tier] ?? d.tier}
                  <Text className="font-sans text-base text-ink-5">
                    {" · Palier "}{currentIdx + 1}/{TIERS.length}
                  </Text>
                </Text>
                <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-4">
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

                    {/* RIB inline pour le palier vérifié (parité web : ibanMasked affiché si validé) */}
                    {t.key === "verifie" && d.rib?.validated && d.rib.ibanMasked ? (
                      <Text className="mt-1 font-mono text-xs text-ink-4">
                        RIB : {d.rib.ibanMasked}
                      </Text>
                    ) : null}
                  </Card>
                );
              })}

              {/* Coordonnées bancaires complètes */}
              <Card>
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
              <Card>
                <Text className="font-serif text-lg text-ink">
                  Acceptations physiques
                </Text>
                <Text className="mt-1 font-serif text-2xl text-violet">
                  {d.physicalAcceptances}
                </Text>
              </Card>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
