// Bandeau de vérification SIREN/SIRET (registre SIRENE via
// /api/pro/info/verify-company) — parité web InvoiceFieldsModal :
// saisie partielle (après 1,5 s d'inactivité), vérif en cours, introuvable,
// indisponible, validé, ou discordances avec bouton d'import des valeurs
// officielles. Partagé par Mes informations et la feuille des mentions
// légales de facture.
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { CompanyDiff, VerifyState } from "../lib/queries-pro-billing";
import { useTheme } from "../lib/theme";

// Couleurs fixes des bandeaux (identiques au web, lisibles en clair/sombre
// car fond + texte sont définis ensemble).
const RED = { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B" };
const AMBER = { bg: "#FEF3C7", border: "#FCD34D", text: "#78350F" };

function Banner({
  tone,
  children,
}: {
  tone: { bg: string; border: string; text: string };
  children: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {typeof children === "string" ? (
        <Text style={{ color: tone.text, fontSize: 12.5, lineHeight: 18 }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function CompanyVerifyBanner({
  siren,
  siret,
  verify,
  diffs,
  onImport,
  context = "facture",
}: {
  siren: string;
  siret: string;
  verify: VerifyState;
  diffs: CompanyDiff[];
  onImport: () => void;
  /** Formulation du blocage : « la facture » ou « vos informations ». */
  context?: "facture" | "informations";
}) {
  const { c } = useTheme();
  const sirenIn = siren.trim();
  const siretIn = siret.trim();
  const sirenPartial = sirenIn.length > 0 && !/^\d{9}$/.test(sirenIn);
  const siretPartial = siretIn.length > 0 && !/^\d{14}$/.test(siretIn);
  const blockedLabel =
    context === "facture"
      ? "la facture ne pourra pas être générée"
      : "vos informations ne pourront pas être enregistrées";

  // Avertissement « saisie partielle » différé (évite le clignotement à
  // chaque chiffre tapé).
  const [showPartial, setShowPartial] = useState(false);
  useEffect(() => {
    setShowPartial(false);
    if (!sirenPartial && !siretPartial) return;
    const t = setTimeout(() => setShowPartial(true), 1500);
    return () => clearTimeout(t);
  }, [sirenIn, siretIn, sirenPartial, siretPartial]);

  return (
    <View className="gap-2">
      {showPartial && (sirenPartial || siretPartial) ? (
        <Banner tone={RED}>
          {`Numéro non enregistré —${
            sirenPartial ? ` le SIREN doit comporter 9 chiffres (${sirenIn.length} saisi${sirenIn.length > 1 ? "s" : ""}).` : ""
          }${
            siretPartial ? ` Le SIRET doit comporter 14 chiffres (${siretIn.length} saisi${siretIn.length > 1 ? "s" : ""}).` : ""
          } Tant que le numéro n'est pas complet et reconnu par SIRENE, ${blockedLabel}.`}
        </Banner>
      ) : null}

      {verify.status === "loading" ? (
        <View
          style={{
            backgroundColor: c.surface2,
            borderColor: c.borderSoft,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: c.textSub, fontSize: 12.5 }}>
            Vérification en cours sur le registre officiel…
          </Text>
        </View>
      ) : null}

      {verify.status === "not_found" ? (
        <Banner tone={RED}>
          {`Numéro non enregistré — introuvable dans le registre officiel SIRENE. Vérifiez la saisie : tant que le numéro n'est pas reconnu, ${blockedLabel}.`}
        </Banner>
      ) : null}

      {verify.status === "error" ? (
        <Banner tone={AMBER}>
          Vérification temporairement indisponible — vous pouvez quand même enregistrer.
        </Banner>
      ) : null}

      {verify.status === "found" && diffs.length === 0 ? (
        <View
          style={{
            backgroundColor: c.goodSoft,
            borderColor: c.good,
            borderWidth: 1.5,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>
            <Text style={{ fontWeight: "700" }}>✓ Validé</Text>
            {` — les informations correspondent au registre officiel${
              verify.data.raisonSociale ? ` (${verify.data.raisonSociale})` : ""
            }.`}
          </Text>
          {verify.data.actif === false ? (
            <Text style={{ color: c.warn, fontSize: 12.5, marginTop: 4 }}>
              ⚠ Cet établissement est marqué comme cessé dans la base SIRENE.
            </Text>
          ) : null}
        </View>
      ) : null}

      {verify.status === "found" && diffs.length > 0 ? (
        <Banner tone={AMBER}>
          <Text style={{ color: AMBER.text, fontWeight: "700", fontSize: 13, marginBottom: 6 }}>
            ⚠ Discordances détectées avec le registre officiel
          </Text>
          {diffs.map((d) => (
            <Text key={d.key} style={{ color: AMBER.text, fontSize: 12.5, lineHeight: 18, marginBottom: 2 }}>
              <Text style={{ fontWeight: "700" }}>{d.label}</Text>
              {` — saisi : « ${d.user || "∅"} » · officiel : « ${d.official} »`}
            </Text>
          ))}
          <Pressable
            onPress={onImport}
            accessibilityRole="button"
            className="mt-2 items-center rounded-full py-2.5 active:opacity-80"
            style={{ backgroundColor: "#7C3AED" }}
          >
            <Text className="text-[13px] font-semibold" style={{ color: "#FFFFFF" }}>
              Remplacer les informations collectées
            </Text>
          </Pressable>
        </Banner>
      ) : null}
    </View>
  );
}
