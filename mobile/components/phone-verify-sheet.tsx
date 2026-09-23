// Vérification SMS du téléphone — bottom-sheet partagée (réplique mobile de
// PhoneVerifyModal, Prospect.jsx). Deux étapes :
//   1. « phone » : saisie du numéro → POST /api/prospect/phone/start
//   2. « code »  : saisie du code 6 chiffres → POST /api/prospect/phone/verify
// Le téléphone n'est JAMAIS écrit via PATCH /api/prospect/donnees (le serveur
// le refuse : 400 telephone_requires_verification) — seul /verify persiste
// le numéro + phone_verified_at. Sert aussi à CHANGER un numéro déjà vérifié
// (le nouveau numéro n'est enregistré qu'une fois son code validé).
//
// Réutilisable depuis Mes données et Préférences (usePhoneStart /
// usePhoneVerify invalident donnees/verification/score au succès).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { ApiError } from "../lib/api";
import { usePhoneStart, usePhoneVerify } from "../lib/queries";
import { useTheme } from "../lib/theme";

type ApiErrBody = {
  error?: string;
  message?: string;
  normalizedPhone?: string;
};

// Extrait le JSON d'erreur renvoyé par les routes phone/* (ApiError.body).
function parseErr(e: unknown): ApiErrBody {
  if (e instanceof ApiError) {
    try {
      return JSON.parse(e.body) as ApiErrBody;
    } catch {
      return {};
    }
  }
  return {};
}

export function PhoneVerifySheet({
  visible,
  initialPhone,
  onClose,
  onDone,
}: {
  visible: boolean;
  /** Numéro pré-rempli (ex. numéro actuel pour un changement). */
  initialPhone?: string;
  onClose: () => void;
  /** Appelé après une vérification réussie (queries déjà invalidées). */
  onDone?: () => void;
}) {
  const { c } = useTheme();
  const start = usePhoneStart();
  const verify = usePhoneVerify();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Numéro déjà rattaché à un autre compte → on propose d'en saisir un autre.
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const submitting = start.isPending || verify.isPending;

  // Réinitialise le flow à chaque ouverture.
  useEffect(() => {
    if (!visible) return;
    setStep("phone");
    setPhone(initialPhone ?? "");
    setCode("");
    setErr(null);
    setInfo(null);
    setAlreadyUsed(false);
  }, [visible, initialPhone]);

  async function sendCode() {
    setErr(null);
    setInfo(null);
    try {
      const j = (await start.mutateAsync({ phone })) as {
        devCode?: string;
      } | null;
      setStep("code");
      // Mode dev (Brevo non configuré) : le serveur renvoie le code.
      if (j?.devCode) {
        setCode(j.devCode);
        setInfo(`Mode dev : code ${j.devCode} pré-rempli (Brevo non configuré).`);
      } else {
        setCode("");
        setInfo("Code envoyé par SMS. Saisissez-le ci-dessous.");
      }
    } catch (e) {
      const b = parseErr(e);
      if (!(e instanceof ApiError)) {
        setErr("Erreur réseau. Réessayez.");
        return;
      }
      const echoed = b.normalizedPhone
        ? ` (numéro normalisé : ${b.normalizedPhone})`
        : "";
      setErr((b.message || "Impossible d'envoyer le code.") + echoed);
      if (b.error === "phone_already_used") setAlreadyUsed(true);
    }
  }

  async function submitCode() {
    setErr(null);
    setInfo(null);
    try {
      await verify.mutateAsync({ code });
      onDone?.();
      onClose();
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setErr("Erreur réseau. Réessayez.");
        return;
      }
      setErr(parseErr(e).message || "Code incorrect.");
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: c.text,
  } as const;

  return (
    <BottomSheet visible={visible} onClose={submitting ? () => {} : onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 14, paddingBottom: 12 }}
      >
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accVioletDeep }}
          >
            <Ionicons name="call-outline" size={18} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Vérification du téléphone
          </Text>
        </View>

        {step === "phone" ? (
          <>
            <Text className="text-[13.5px] leading-5 text-ink-3">
              Saisissez votre numéro. Nous vous enverrons un code de
              confirmation à 6 chiffres par SMS pour valider l&apos;inscription
              du téléphone à votre profil.
            </Text>
            <View className="gap-1.5">
              <Text className="text-[12px] uppercase text-ink-4">
                Numéro de téléphone
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (alreadyUsed) setAlreadyUsed(false);
                  if (err) setErr(null);
                }}
                autoFocus
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={c.textMuted}
                keyboardType="phone-pad"
                accessibilityLabel="Numéro de téléphone"
                style={[inputStyle, { fontSize: 15 }]}
              />
            </View>
            {err ? (
              <View
                className="flex-row gap-2 rounded-xl px-3 py-2.5"
                style={{
                  backgroundColor: c.badSoft,
                  borderWidth: 1,
                  borderColor: c.bad,
                }}
              >
                <Ionicons name="alert-circle-outline" size={15} color={c.bad} />
                <Text className="flex-1 text-[12.5px] leading-5" style={{ color: c.bad }}>
                  {err}
                </Text>
              </View>
            ) : null}
            <View className="mt-1 flex-row gap-3">
              <Pressable
                disabled={submitting}
                onPress={onClose}
                className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
              >
                <Text className="text-sm font-medium text-ink-3">Annuler</Text>
              </Pressable>
              {alreadyUsed ? (
                <Pressable
                  onPress={() => {
                    setPhone("");
                    setErr(null);
                    setAlreadyUsed(false);
                  }}
                  accessibilityRole="button"
                  className="flex-1 items-center rounded-full py-3.5 active:opacity-80"
                  style={{ backgroundColor: c.btnBg }}
                >
                  <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
                    Entrer un autre numéro
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={submitting || !phone.trim()}
                  onPress={() => void sendCode()}
                  accessibilityRole="button"
                  className="flex-1 items-center rounded-full py-3.5 active:opacity-80"
                  style={{
                    backgroundColor: c.btnBg,
                    opacity: submitting || !phone.trim() ? 0.5 : 1,
                  }}
                >
                  <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
                    {start.isPending ? "Envoi…" : "Envoyer le code"}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <Text className="text-[13.5px] leading-5 text-ink-3">
              Entrez le code à 6 chiffres reçu sur{" "}
              <Text className="font-semibold text-ink">{phone}</Text>. Le code
              expire dans 10 minutes.
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={c.textMuted}
              accessibilityLabel="Code reçu par SMS"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              style={[
                inputStyle,
                { fontSize: 20, letterSpacing: 8, textAlign: "center" },
              ]}
            />
            {info ? (
              <Text className="text-[12.5px] text-ink-4">{info}</Text>
            ) : null}
            {err ? (
              <Text className="text-[12.5px]" style={{ color: c.bad }}>
                {err}
              </Text>
            ) : null}
            <Pressable
              disabled={submitting || code.length !== 6}
              onPress={() => void submitCode()}
              accessibilityRole="button"
              className="items-center rounded-full py-3.5 active:opacity-80"
              style={{
                backgroundColor: c.btnBg,
                opacity: submitting || code.length !== 6 ? 0.5 : 1,
              }}
            >
              <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
                {verify.isPending ? "Vérification…" : "Valider"}
              </Text>
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable
                disabled={submitting}
                onPress={() => {
                  setStep("phone");
                  setCode("");
                  setErr(null);
                  setInfo(null);
                }}
                className="flex-1 items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
              >
                <Text className="text-[13px] font-medium text-ink-3">
                  ← Modifier le numéro
                </Text>
              </Pressable>
              <Pressable
                disabled={submitting}
                onPress={() => void sendCode()}
                className="flex-1 items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
              >
                <Text className="text-[13px] font-medium text-ink-3">
                  {start.isPending ? "Envoi…" : "Renvoyer le code"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
