// Écran d'authentification (maquette 4.png, adapté à la réalité Clerk).
//
// ⚠️ Harmonisation avec le web : l'instance Clerk est configurée en
// **code e-mail (passwordless)** — le web (composants hébergés
// <SignIn>/<SignUp>) envoie un code, pas de mot de passe. On reproduit
// donc ici le MÊME mécanisme en 2 étapes (e-mail → code à 6 chiffres),
// pour Connexion ET Inscription. Pas de champ mot de passe ni de
// "mot de passe oublié" (sans objet en passwordless).
import { useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  Accent,
  BrandLogo,
  Field,
  LegalFooter,
  PrimaryButton,
  SocialButtons,
} from "../../components/ui";
import { AuthBackdrop } from "../../components/auth-backdrop";
import { withAlpha } from "../../components/onboarding-art";
import { setRoleIntent, type RoleIntent } from "../../lib/role-intent";
import { useTheme } from "../../lib/theme";

type OAuthStrategy = "oauth_apple" | "oauth_google" | "oauth_facebook";

WebBrowser.maybeCompleteAuthSession();

type Tab = "login" | "signup";
type Step = "email" | "code";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { startSSOFlow } = useSSO();

  const { c, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>("login");
  const [step, setStep] = useState<Step>("email");
  const [role, setRole] = useState<RoleIntent>("prospect");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Erreurs Clerk traduites (Clerk renvoie des messages bruts en anglais,
  // ex. « is invalid ») ; repli sur le message fourni par l'appelant.
  const clerkErr = (e: unknown, fb: string) => {
    const first = (e as { errors?: { code?: string; message?: string }[] })
      ?.errors?.[0];
    const byCode: Record<string, string> = {
      form_param_format_invalid: "Adresse e-mail invalide.",
      form_param_nil: "Renseignez votre adresse e-mail.",
      form_identifier_not_found:
        "Aucun compte avec cet e-mail. Utilisez l'onglet Inscription.",
      form_identifier_exists:
        "Un compte existe déjà avec cet e-mail. Utilisez l'onglet Connexion.",
      form_code_incorrect: "Code incorrect.",
      verification_expired: "Code expiré. Demandez-en un nouveau.",
      verification_failed: "Code incorrect ou expiré.",
      too_many_requests: "Trop de tentatives. Réessayez dans quelques minutes.",
      session_exists: "Vous êtes déjà connecté.",
      oauth_access_denied: "Connexion annulée.",
      external_account_not_found:
        "Aucun compte BUUPP n'est lié à ce compte. Inscrivez-vous d'abord.",
      not_allowed_access: "Cette adresse n'est pas autorisée.",
    };
    return (first?.code && byCode[first.code]) || fb;
  };

  function reset(toTab?: Tab) {
    if (toTab) setTab(toTab);
    setStep("email");
    setCode("");
    setErr(null);
  }

  // — Étape 1 : envoyer le code e-mail —
  async function requestCode() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      if (tab === "login") {
        if (!signIn) return;
        const r = await signIn.create({ identifier: email.trim() });
        const f = r.supportedFirstFactors?.find(
          (x): x is typeof x & { emailAddressId: string } =>
            x.strategy === "email_code",
        );
        if (!f) throw new Error("Connexion par code indisponible.");
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: f.emailAddressId,
        });
      } else {
        if (!signUp) return;
        await signUp.create({ emailAddress: email.trim() });
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
      }
      setStep("code");
    } catch (e) {
      setErr(clerkErr(e, "Impossible d'envoyer le code."));
    } finally {
      setBusy(false);
    }
  }

  // — Étape 2 : vérifier le code → session —
  async function verifyCode() {
    if (busy || code.trim().length < 4) return;
    setBusy(true);
    setErr(null);
    try {
      // L'intention de rôle ne vaut que pour une INSCRIPTION : à la
      // connexion, le rôle réel vient du serveur (/api/me/role).
      if (tab !== "login") await setRoleIntent(role);
      if (tab === "login") {
        if (!signIn) return;
        const r = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (r.status === "complete") {
          await setSignInActive!({ session: r.createdSessionId });
          router.replace("/");
        } else setErr("Code incorrect ou expiré.");
      } else {
        if (!signUp) return;
        const r = await signUp.attemptEmailAddressVerification({
          code: code.trim(),
        });
        if (r.status === "complete") {
          await setSignUpActive!({ session: r.createdSessionId });
          router.replace("/");
        } else setErr("Code incorrect ou expiré.");
      }
    } catch (e) {
      setErr(clerkErr(e, "Code invalide."));
    } finally {
      setBusy(false);
    }
  }

  const onSocial = (p: "apple" | "google" | "facebook") =>
    onSSO(`oauth_${p}` as OAuthStrategy);

  async function onSSO(strategy: OAuthStrategy) {
    setErr(null);
    try {
      const redirectUrl = Linking.createURL("/", { scheme: "buupp" });
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setRoleIntent(role);
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (e) {
      setErr(clerkErr(e, "Connexion sociale indisponible."));
    }
  }

  return (
    <View className="flex-1 bg-ivory">
      <AuthBackdrop />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow justify-center px-5 py-6 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center pt-2">
          <BrandLogo small />
        </View>

        <View className="gap-1">
          <Text className="text-center font-serif text-3xl text-ink">
            {tab === "login" ? (
              <>
                Bon retour, <Accent>buupper</Accent>.
              </>
            ) : (
              <>
                Rejoignez <Accent>buupp</Accent>.
              </>
            )}
          </Text>
          <Text className="text-center text-lg leading-6 text-ink-3">
            {step === "code"
              ? `Code envoyé à ${email}`
              : tab === "login"
                ? "On vous envoie un code par e-mail."
                : "Quelques secondes, et c'est parti."}
          </Text>
        </View>

        {/* Formulaire posé sur une carte translucide, au-dessus du décor */}
        <View
          className="gap-4"
          style={{
            borderRadius: 28,
            padding: 16,
            backgroundColor: withAlpha(c.surface, isDark ? "E6" : "EB"),
            borderWidth: 1,
            borderColor: c.borderSoft,
            shadowColor: isDark ? "#000000" : c.navyDeep,
            shadowOpacity: isDark ? 0.45 : 0.1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
          }}
        >
          {/* Tabs Connexion / Inscription */}
          <View className="flex-row rounded-full bg-ivory-2 p-1">
            {(["login", "signup"] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => reset(t)}
                className={`flex-1 items-center rounded-full py-2.5 ${
                  tab === t ? "bg-ink" : ""
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    tab === t ? "text-paper" : "text-ink-3"
                  }`}
                >
                  {t === "login" ? "Connexion" : "Inscription"}
                </Text>
              </Pressable>
            ))}
          </View>

          {step === "email" && (
            <>
              {/* JE SUIS — toggle rôle */}
              <View className="gap-1.5">
                <Text
                  className="text-[11px] font-bold uppercase text-ink-4"
                  style={{ letterSpacing: 1.2 }}
                >
                  Je suis
                </Text>
                <View className="flex-row gap-3">
                  {(
                    [
                      {
                        r: "prospect",
                        t: "Buupper",
                        s: "je vends mon attention",
                      },
                      {
                        r: "pro",
                        t: "Professionnel",
                        s: "je cherche des prospects",
                      },
                    ] as { r: RoleIntent; t: string; s: string }[]
                  ).map((o) => {
                    const on = role === o.r;
                    return (
                      <Pressable
                        key={o.r}
                        onPress={() => setRole(o.r)}
                        className={`flex-1 rounded-2xl border bg-paper p-3 ${
                          on ? "border-violet bg-violet-soft" : "border-line"
                        }`}
                      >
                        <Text className="font-serif text-base italic text-ink">
                          {o.t}
                        </Text>
                        <Text className="mt-0.5 text-[11px] text-ink-4">
                          {o.s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Field
                label="Email"
                placeholder="vous@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {err ? (
                <Text className="text-center text-sm text-bad">{err}</Text>
              ) : null}
              <PrimaryButton
                label="Recevoir le code"
                loading={busy}
                onPress={requestCode}
              />

              {/* OU + connexion sociale (primitive partagée) */}
              <SocialButtons onPress={onSocial} />
            </>
          )}

          {step === "code" && (
            <>
              <Field
                label="Code reçu par e-mail"
                placeholder="123456"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
              {err ? (
                <Text className="text-center text-sm text-bad">{err}</Text>
              ) : null}
              <PrimaryButton
                label={tab === "login" ? "Se connecter" : "Créer mon compte"}
                loading={busy}
                onPress={verifyCode}
              />
              <View className="flex-row justify-between">
                <Pressable onPress={() => reset()}>
                  <Text className="text-sm text-ink-4">
                    ← Changer d&apos;e-mail
                  </Text>
                </Pressable>
                <Pressable onPress={requestCode} disabled={busy}>
                  <Text className="text-sm font-medium text-violet">
                    Renvoyer le code
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <LegalFooter />
      </ScrollView>
    </View>
  );
}
