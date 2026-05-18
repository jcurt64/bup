// Mot de passe oublié — flux en 3 étapes + succès (maquettes 5→8).
// Implémenté avec le reset Clerk `reset_password_email_code`.
//
// Note honnête : les maquettes évoquent un « lien sécurisé ». Clerk Expo
// (mobile) utilise un CODE e-mail (pas un deep-link), donc l'étape 3
// inclut un champ Code en plus du nouveau mot de passe. Le reste est
// fidèle au design.
import { Ionicons } from "@expo/vector-icons";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Accent, Eyebrow, Field, PrimaryButton } from "../../components/ui";

type Step = 1 | 2 | 3 | "done";

export default function Forgot() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clerkErr = (e: unknown, fb: string) =>
    (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ?? fb;

  // Force du mot de passe : longueur ≥ 8, ≥1 chiffre, ≥1 majuscule.
  const rules = [pwd.length >= 8, /\d/.test(pwd), /[A-Z]/.test(pwd)];
  const strength = rules.filter(Boolean).length; // 0..3
  const canReset =
    strength === 3 && pwd === confirm && code.trim().length > 0 && !busy;

  async function sendCode() {
    if (!isLoaded || busy || !email) return;
    setBusy(true);
    setErr(null);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep(2);
    } catch (e) {
      setErr(clerkErr(e, "Impossible d'envoyer le code."));
    } finally {
      setBusy(false);
    }
  }

  async function resetPwd() {
    if (!isLoaded || !canReset) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: pwd,
      });
      if (r.status === "complete") {
        if (r.createdSessionId) await setActive!({ session: r.createdSessionId });
        setStep("done");
      } else {
        setErr("Vérification incomplète.");
      }
    } catch (e) {
      setErr(clerkErr(e, "Code ou mot de passe invalide."));
    } finally {
      setBusy(false);
    }
  }

  function back() {
    if (step === 1) router.replace("/(auth)/sign-in");
    else if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  const Tile = ({ name }: { name: keyof typeof Ionicons.glyphMap }) => (
    <View className="h-14 w-14 items-center justify-center rounded-2xl bg-paper">
      <Ionicons name={name} size={22} color="#7C5CFC" />
    </View>
  );

  if (step === "done") {
    return (
      <SafeAreaView className="flex-1 bg-ivory">
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="items-center gap-4">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-violet">
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Eyebrow>Mot de passe modifié</Eyebrow>
            <Text className="text-center font-serif text-3xl text-ink">
              C&apos;est <Accent>fait.</Accent>
            </Text>
            <Text className="text-center text-sm text-ink-3">
              Votre mot de passe a été mis à jour. Vous pouvez vous
              reconnecter en toute <Accent>sérénité</Accent>.
            </Text>
          </View>
        </View>
        <View className="px-6 pb-6">
          <PrimaryButton
            label="Se connecter"
            arrow
            onPress={() => router.replace("/")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ivory">
      <View className="flex-row items-center justify-between px-6 pt-2">
        <Pressable
          onPress={back}
          hitSlop={12}
          className="h-9 w-9 items-center justify-center rounded-full bg-paper"
        >
          <Ionicons name="arrow-back" size={18} color="#283044" />
        </Pressable>
        <Text className="text-sm text-ink-4">
          <Text className="font-bold text-ink">{step}</Text> / 3
        </Text>
        <View className="w-9" />
      </View>

      <View className="flex-1 px-6 pt-6 gap-4">
        {step === 1 && (
          <>
            <Tile name="mail-outline" />
            <Eyebrow>Récupération</Eyebrow>
            <Text className="font-serif text-3xl text-ink">
              Mot de passe <Accent>oublié</Accent> ?
            </Text>
            <Text className="text-sm leading-5 text-ink-3">
              Pas de souci. Entrez votre e-mail, on vous envoie un{" "}
              <Accent>code sécurisé</Accent> pour le réinitialiser.
            </Text>
            <Field
              label="Email"
              placeholder="vous@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {err ? <Text className="text-sm text-bad">{err}</Text> : null}
            <PrimaryButton
              label="Envoyer le code"
              loading={busy}
              onPress={sendCode}
            />
            <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
              <Text className="text-center text-sm text-ink-3">
                Vous vous souvenez ?{" "}
                <Text className="font-medium text-violet">
                  Retour à la connexion
                </Text>
              </Text>
            </Pressable>
          </>
        )}

        {step === 2 && (
          <View className="flex-1">
            <View className="flex-1 items-center justify-center gap-4">
              <View className="h-20 w-28 items-center justify-center rounded-2xl bg-navy">
                <Ionicons name="mail" size={30} color="#fff" />
              </View>
              <Eyebrow>Email envoyé</Eyebrow>
              <Text className="text-center font-serif text-3xl text-ink">
                Vérifiez votre <Accent>boîte mail</Accent>.
              </Text>
              <Text className="text-center text-sm text-ink-3">
                On a envoyé un code de réinitialisation à{"\n"}
                <Text className="font-semibold text-ink">{email}</Text>
              </Text>
            </View>
            <View className="gap-3 pb-2">
              <PrimaryButton
                label="Ouvrir mon application mail"
                onPress={() => Linking.openURL("message://").catch(() => {})}
              />
              <Pressable onPress={() => setStep(3)}>
                <Text className="text-center text-sm font-medium text-violet">
                  J&apos;ai reçu le code →
                </Text>
              </Pressable>
              <Pressable onPress={sendCode}>
                <Text className="text-center text-xs text-ink-4">
                  Rien reçu ? Vérifiez les spams ·{" "}
                  <Text className="font-medium text-violet">Renvoyer</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 3 && (
          <>
            <Tile name="lock-closed-outline" />
            <Eyebrow>Étape finale</Eyebrow>
            <Text className="font-serif text-3xl text-ink">
              Choisissez un <Accent>nouveau</Accent> mot de passe.
            </Text>
            <Text className="text-sm text-ink-3">
              Au moins <Text className="italic">8 caractères</Text>, avec un
              chiffre et une majuscule.
            </Text>
            <Field
              label="Code reçu par e-mail"
              placeholder="123456"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />
            <View className="gap-1.5">
              <Text
                className="text-[11px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 1.2 }}
              >
                Nouveau mot de passe
              </Text>
              <View className="flex-row items-center rounded-2xl border border-line bg-paper px-4">
                <Field
                  label=""
                  placeholder="••••••••"
                  secureTextEntry={!show}
                  value={pwd}
                  onChangeText={setPwd}
                  style={{ flex: 1, borderWidth: 0, paddingHorizontal: 0 }}
                />
                <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
                  <Ionicons
                    name={show ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#8A91A1"
                  />
                </Pressable>
              </View>
              <View className="mt-1 flex-row gap-1.5">
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < strength ? "bg-violet" : "bg-ivory-2"
                    }`}
                  />
                ))}
              </View>
            </View>
            <Field
              label="Confirmer"
              placeholder="••••••••"
              secureTextEntry={!show}
              value={confirm}
              onChangeText={setConfirm}
            />
            {err ? <Text className="text-sm text-bad">{err}</Text> : null}
            <PrimaryButton
              label="Réinitialiser"
              loading={busy}
              disabled={!canReset}
              onPress={resetPwd}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
