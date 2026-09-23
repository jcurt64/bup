// Feuille « Compléter les mentions légales » — parité web InvoiceFieldsModal
// (Pro.jsx). Ouverte avant chaque téléchargement de facture (unitaire ou
// « Tout télécharger ») : pré-remplie depuis /api/pro/info, vérifie le
// SIREN/SIRET sur le registre SIRENE, persiste via PATCH /api/pro/info puis
// rend la main au parent qui lance le téléchargement du PDF.
//
// Le parent monte ce composant uniquement quand il est ouvert (état
// réinitialisé à chaque ouverture).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { CompanyVerifyBanner } from "./company-verify-banner";
import { usePatchProInfo, useProInfo, type ProInfo } from "../lib/queries";
import {
  apiErrorMessage,
  companyDiffs,
  useCompanyVerification,
} from "../lib/queries-pro-billing";
import { useTheme } from "../lib/theme";

type Form = {
  raisonSociale: string;
  formeJuridique: string;
  capitalSocialEur: string;
  adresse: string;
  codePostal: string;
  ville: string;
  siren: string;
  siret: string;
  rcsVille: string;
  rmNumber: string;
  numeroTva: string;
};

const EMPTY: Form = {
  raisonSociale: "",
  formeJuridique: "",
  capitalSocialEur: "",
  adresse: "",
  codePostal: "",
  ville: "",
  siren: "",
  siret: "",
  rcsVille: "",
  rmNumber: "",
  numeroTva: "",
};

function fromInfo(j: ProInfo): Form {
  // Raison sociale = e-mail Clerk par défaut (placeholder serveur) → vidée.
  const rs = j.raisonSociale ?? "";
  return {
    raisonSociale: rs.includes("@") ? "" : rs,
    formeJuridique: j.formeJuridique ?? "",
    capitalSocialEur: j.capitalSocialEur == null ? "" : String(j.capitalSocialEur),
    adresse: j.adresse ?? "",
    codePostal: j.codePostal ?? "",
    ville: j.ville ?? "",
    siren: j.siren ?? "",
    siret: j.siret ?? "",
    rcsVille: j.rcsVille ?? "",
    rmNumber: j.rmNumber ?? "",
    numeroTva: j.numeroTva ?? "",
  };
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  mono,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  mono?: boolean;
  maxLength?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Text className="mb-1 text-[12px] font-semibold text-ink-3">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        keyboardType={numeric ? "number-pad" : "default"}
        maxLength={maxLength}
        autoCorrect={false}
        className={mono ? "font-mono" : undefined}
        style={{
          backgroundColor: c.field,
          borderColor: c.borderSoft,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: c.text,
        }}
      />
    </View>
  );
}

function Hint({ children }: { children: string }) {
  return <Text className="text-[12px] leading-[17px] text-ink-4">{children}</Text>;
}

export function InvoiceFieldsSheet({
  invoiceNumber,
  bulk = false,
  invoiceCount = 0,
  onClose,
  onConfirmed,
}: {
  invoiceNumber?: string;
  bulk?: boolean;
  invoiceCount?: number;
  onClose: () => void;
  /** Appelé après PATCH réussi — le parent déclenche le téléchargement. */
  onConfirmed: () => void | Promise<void>;
}) {
  const { c } = useTheme();
  const info = useProInfo();
  const patch = usePatchProInfo();
  const [form, setForm] = useState<Form>(info.data ? fromInfo(info.data) : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(!!info.data);
  // L'utilisateur a commencé à saisir → le refetch ne doit plus écraser.
  const touched = useRef(false);

  // Données fraîches à chaque ouverture (une autre saisie a pu les changer).
  const { refetch } = info;
  useEffect(() => {
    let alive = true;
    refetch().then((r) => {
      if (!alive) return;
      if (r.data && !touched.current) setForm(fromInfo(r.data));
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [refetch]);

  const set = (k: keyof Form) => (v: string) => {
    touched.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setDigits = (k: "siren" | "siret", max: number) => (v: string) => {
    touched.current = true;
    setForm((f) => ({ ...f, [k]: v.replace(/\D/g, "").slice(0, max) }));
  };

  const verify = useCompanyVerification(form.siren, form.siret);
  const diffs = verify.status === "found" ? companyDiffs(form, verify.data) : [];
  function importOfficial() {
    if (verify.status !== "found") return;
    const d = verify.data;
    setForm((f) => ({
      ...f,
      raisonSociale: d.raisonSociale || f.raisonSociale,
      adresse: d.adresse || f.adresse,
      ville: d.ville || f.ville,
      codePostal: d.codePostal || f.codePostal,
      formeJuridique: d.formeJuridique || f.formeJuridique,
      siren: d.siren || f.siren,
      siret: d.siret || f.siret,
    }));
  }

  const missing = (
    [
      ["Dénomination sociale ou nom/prénom", form.raisonSociale],
      ["Forme juridique", form.formeJuridique],
      ["Adresse du siège social", form.adresse],
      ["Ville", form.ville],
    ] as const
  )
    .filter(([, v]) => !v.trim())
    .map(([l]) => l);
  const sirenIn = form.siren.trim();
  const siretIn = form.siret.trim();
  const hasIdentifier = !!sirenIn || !!siretIn;
  const hasRegistration = !!form.rcsVille.trim() || !!form.rmNumber.trim();
  const sirenOk = sirenIn.length === 0 || /^\d{9}$/.test(sirenIn);
  const siretOk = siretIn.length === 0 || /^\d{14}$/.test(siretIn);
  // Même garde-fou que le web : numéro non reconnu par SIRENE = blocage
  // (on tolère 'error' = API data.gouv.fr indisponible).
  const blockedByVerification =
    hasIdentifier &&
    (!sirenOk || !siretOk || (verify.status !== "found" && verify.status !== "error"));
  const loading = !hydrated;
  const canSubmit =
    !loading && missing.length === 0 && hasIdentifier && hasRegistration && !blockedByVerification;

  async function submit() {
    if (!canSubmit || busy) return;
    const cap = form.capitalSocialEur.trim().replace(",", ".");
    if (cap !== "" && (!Number.isFinite(Number(cap)) || Number(cap) < 0)) {
      setError("Le capital social doit être un nombre positif.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patch.mutateAsync({
        raisonSociale: form.raisonSociale.trim(),
        formeJuridique: form.formeJuridique.trim() || null,
        adresse: form.adresse.trim() || null,
        ville: form.ville.trim() || null,
        codePostal: form.codePostal.trim() || null,
        capitalSocialEur: cap === "" ? null : Number(cap),
        siren: sirenIn || null,
        siret: siretIn || null,
        rcsVille: form.rcsVille.trim() || null,
        rmNumber: form.rmNumber.trim() || null,
        numeroTva: form.numeroTva.trim().toUpperCase() || null,
      });
    } catch (e) {
      const msg = apiErrorMessage(e, "");
      setError(
        msg.includes("invalid_capital")
          ? "Le capital social doit être un nombre positif."
          : msg.includes("invalid_siren")
            ? "Le SIREN doit comporter 9 chiffres."
            : msg.includes("invalid_siret")
              ? "Le SIRET doit comporter 14 chiffres."
              : "Impossible d'enregistrer ces informations. Réessayez.",
      );
      setBusy(false);
      return;
    }
    try {
      await onConfirmed();
    } finally {
      setBusy(false);
    }
  }

  const warn = (text: string) => (
    <View
      style={{
        backgroundColor: "#FEF3C7",
        borderColor: "#FCD34D",
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: "#78350F", fontSize: 12.5, lineHeight: 18 }}>{text}</Text>
    </View>
  );

  return (
    <BottomSheet visible onClose={onClose} heightPct={92}>
      <View className="mb-1 flex-row items-start justify-between" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="font-mono text-[10px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
            {bulk ? "— Téléchargement des factures" : "— Génération facture"}
          </Text>
          <Text className="mt-1 font-serif text-xl text-ink">Compléter les mentions légales</Text>
        </View>
        <Pressable onPress={onClose} accessibilityLabel="Fermer" hitSlop={10}>
          <Ionicons name="close" size={22} color={c.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[13px] leading-5 text-ink-3">
          {bulk
            ? `Vérifiez (et complétez si nécessaire) les informations qui apparaîtront sur ${
                invoiceCount > 1 ? `vos ${invoiceCount} factures` : "votre facture"
              }. Elles seront enregistrées dans Mes informations pour les prochaines factures.`
            : `Vérifiez (et complétez si nécessaire) les informations qui apparaîtront sur votre facture ${
                invoiceNumber ?? ""
              }. Elles seront enregistrées dans Mes informations pour les prochaines factures.`}
        </Text>

        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={c.accent} />
            <Text className="mt-2 text-[13px] text-ink-4">Chargement de vos informations…</Text>
          </View>
        ) : (
          <>
            <Input
              label="Dénomination sociale ou nom/prénom *"
              value={form.raisonSociale}
              onChange={set("raisonSociale")}
              placeholder="Atelier Mercier"
            />
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              <Input
                label="Forme juridique *"
                value={form.formeJuridique}
                onChange={set("formeJuridique")}
                placeholder="SARL, SAS, EI…"
              />
              <Input
                label="Capital social (€)"
                value={form.capitalSocialEur}
                onChange={(v) => set("capitalSocialEur")(v.replace(/[^0-9.,]/g, ""))}
                placeholder="Sociétés"
                numeric
              />
            </View>
            <Input
              label="Adresse du siège social *"
              value={form.adresse}
              onChange={set("adresse")}
              placeholder="12 rue des Artisans"
            />
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              <Input
                label="Code postal"
                value={form.codePostal}
                onChange={set("codePostal")}
                placeholder="64000"
                numeric
                mono
                maxLength={5}
              />
              <Input label="Ville *" value={form.ville} onChange={set("ville")} placeholder="Pau" />
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              <Input
                label="SIREN"
                value={form.siren}
                onChange={setDigits("siren", 9)}
                placeholder="9 chiffres"
                numeric
                mono
              />
              <Input
                label="SIRET"
                value={form.siret}
                onChange={setDigits("siret", 14)}
                placeholder="14 chiffres"
                numeric
                mono
              />
            </View>
            <Hint>
              Renseignez au moins l&apos;un des deux numéros (SIREN ou SIRET). Vérification
              automatique sur le registre officiel SIRENE / data.gouv.fr.
            </Hint>
            <CompanyVerifyBanner
              siren={form.siren}
              siret={form.siret}
              verify={verify}
              diffs={diffs}
              onImport={importOfficial}
            />
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              <Input
                label="Ville d'immatriculation RCS"
                value={form.rcsVille}
                onChange={set("rcsVille")}
                placeholder="Pau, Lyon…"
              />
              <Input
                label="Numéro RM (artisans)"
                value={form.rmNumber}
                onChange={set("rmNumber")}
                placeholder="Répertoire des métiers"
                mono
              />
            </View>
            <Hint>
              Renseignez la ville RCS pour les sociétés commerciales, ou le numéro RM pour les
              artisans.
            </Hint>
            <Input
              label="N° TVA intracommunautaire"
              value={form.numeroTva}
              onChange={set("numeroTva")}
              placeholder="FR.. (si assujetti à la TVA)"
              mono
            />
            <Hint>
              Requis pour la facturation électronique (à partir de 2026) si vous êtes assujetti à
              la TVA. Laissez vide en franchise en base.
            </Hint>

            {missing.length > 0
              ? warn(`Champs obligatoires manquants : ${missing.join(", ")}.`)
              : !hasIdentifier
                ? warn("Renseignez votre SIREN ou votre SIRET pour générer la facture.")
                : !hasRegistration
                  ? warn(
                      "Renseignez votre ville d'immatriculation RCS (sociétés) ou votre numéro RM (artisans).",
                    )
                  : null}
            {error ? (
              <Text className="text-[13px]" style={{ color: c.bad }}>
                {error}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <View className="flex-row pt-3" style={{ gap: 10 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          className="flex-1 items-center rounded-full py-3.5 active:opacity-80"
          style={{ borderWidth: 1.5, borderColor: c.borderSoft, backgroundColor: c.surface }}
        >
          <Text className="text-[14px] font-semibold text-ink-2">Annuler</Text>
        </Pressable>
        <Pressable
          disabled={!canSubmit || busy}
          onPress={submit}
          accessibilityRole="button"
          className="flex-[2] flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
          style={{ backgroundColor: c.btnBg, opacity: canSubmit ? 1 : 0.5 }}
        >
          {busy ? (
            <ActivityIndicator color={c.btnText} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={c.btnText} />
              <Text className="text-[14px] font-semibold" style={{ color: c.btnText }}>
                {bulk ? "Enregistrer et tout télécharger" : "Enregistrer et télécharger"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
