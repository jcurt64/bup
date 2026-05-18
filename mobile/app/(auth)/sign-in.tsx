// Écran d'authentification combiné (maquette 4.png) :
// Connexion / Inscription (tabs) + toggle rôle "JE SUIS" + e-mail/mdp
// + SSO Apple/Google/Facebook + footer légal.
// Auth = Clerk (MÊME projet que le web → mêmes utilisateurs/données).
import { useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";

// Sous-ensemble des stratégies OAuth qu'on expose (assignable au type
// OAuthStrategy de @clerk/types attendu par startSSOFlow).
type OAuthStrategy = "oauth_apple" | "oauth_google" | "oauth_facebook";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  Accent,
  BrandPill,
  Field,
  LegalFooter,
  PrimaryButton,
} from "../../components/ui";
import { setRoleIntent, type RoleIntent } from "../../lib/role-intent";

// Termine une éventuelle session d'auth web restée ouverte (SSO).
WebBrowser.maybeCompleteAuthSession();

type Tab = "login" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: siReady } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: suReady } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [tab, setTab] = useState<Tab>("login");
  const [role, setRole] = useState<RoleIntent>("prospect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clerkErr = (e: unknown, fb: string) =>
    (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? fb;

  async function done(setActive: typeof setSignInActive, sid?: string | null) {
    await setRoleIntent(role);
    if (sid) await setActive!({ session: sid });
    router.replace("/");
  }

  async function onLogin() {
    if (!siReady || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await signIn.create({ identifier: email, password });
      if (r.status === "complete") await done(setSignInActive, r.createdSessionId);
      else setErr("Étape supplémentaire requise (non gérée ici).");
    } catch (e) {
      setErr(clerkErr(e, "Identifiants invalides."));
    } finally {
      setBusy(false);
    }
  }

  async function onSignup() {
    if (!suReady || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (!pendingCode) {
        await signUp.create({ emailAddress: email, password });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingCode(true);
      } else {
        const r = await signUp.attemptEmailAddressVerification({ code });
        if (r.status === "complete")
          await done(setSignUpActive, r.createdSessionId);
        else setErr("Code invalide.");
      }
    } catch (e) {
      setErr(clerkErr(e, "Inscription impossible."));
    } finally {
      setBusy(false);
    }
  }

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
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="px-6 pt-2 pb-6 gap-4"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center pt-2">
        <BrandPill small />
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
        <Text className="text-center text-sm text-ink-3">
          {tab === "login"
            ? "Reprenez là où vous en étiez."
            : "Quelques secondes, et c'est parti."}
        </Text>
      </View>

      {/* Tabs Connexion / Inscription */}
      <View className="flex-row rounded-2xl bg-ivory-2 p-1">
        {(["login", "signup"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              setErr(null);
              setPendingCode(false);
            }}
            className={`flex-1 items-center rounded-xl py-2.5 ${
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
              { r: "prospect", t: "Buupper", s: "je vends mon attention" },
              { r: "pro", t: "Professionnel", s: "je cherche des prospects" },
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
                <Text className="mt-0.5 text-[11px] text-ink-4">{o.s}</Text>
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

      {tab === "signup" && pendingCode ? (
        <Field
          label="Code reçu par e-mail"
          placeholder="123456"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />
      ) : (
        <Field
          label="Mot de passe"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      )}

      {tab === "login" ? (
        <Link
          href="/(auth)/forgot"
          className="self-end text-sm font-medium text-violet"
        >
          Mot de passe oublié ?
        </Link>
      ) : null}

      {err ? (
        <Text className="text-center text-sm text-bad">{err}</Text>
      ) : null}

      <PrimaryButton
        label={
          tab === "login"
            ? "Se connecter"
            : pendingCode
              ? "Vérifier le code"
              : "Créer mon compte"
        }
        loading={busy}
        onPress={tab === "login" ? onLogin : onSignup}
      />

      {/* OU + SSO */}
      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-line" />
        <Text className="text-[11px] font-bold uppercase text-ink-4">ou</Text>
        <View className="h-px flex-1 bg-line" />
      </View>
      <View className="flex-row gap-3">
        {(
          [
            { s: "oauth_apple", l: "" },
            { s: "oauth_google", l: "G" },
            { s: "oauth_facebook", l: "f" },
          ] as { s: OAuthStrategy; l: string }[]
        ).map((p) => (
          <Pressable
            key={p.s}
            onPress={() => onSSO(p.s)}
            className="flex-1 items-center rounded-2xl border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-lg font-bold text-ink">{p.l}</Text>
          </Pressable>
        ))}
      </View>

      <LegalFooter />
    </ScrollView>
  );
}
