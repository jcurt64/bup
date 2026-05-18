// Inscription Clerk (squelette — e-mail + mot de passe + code de
// vérification e-mail). Le choix de rôle (prospect/pro) se fait après,
// via /(auth)/role-select, qui appellera la même logique serveur que le
// web. À étoffer (OAuth, gestion d'erreurs fines) selon les besoins.
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function SignUp() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!isLoaded) return;
    setErr(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPending(true);
    } catch (e: unknown) {
      setErr(
        (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
          "Inscription impossible.",
      );
    }
  }

  async function verify() {
    if (!isLoaded) return;
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/");
      }
    } catch (e: unknown) {
      setErr(
        (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
          "Code invalide.",
      );
    }
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-ivory px-6">
      <Text className="font-serif text-3xl text-ink">Créer un compte</Text>
      {!pending ? (
        <>
          <TextInput
            className="rounded-xl border border-line bg-paper px-4 py-3 text-ink"
            placeholder="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="rounded-xl border border-line bg-paper px-4 py-3 text-ink"
            placeholder="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Pressable
            className="mt-2 items-center rounded-xl bg-accent py-3.5 active:opacity-80"
            onPress={start}
          >
            <Text className="font-medium text-paper">S&apos;inscrire</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-sm text-ink-3">
            Code envoyé par e-mail. Saisissez-le :
          </Text>
          <TextInput
            className="rounded-xl border border-line bg-paper px-4 py-3 text-ink"
            placeholder="Code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <Pressable
            className="mt-2 items-center rounded-xl bg-accent py-3.5 active:opacity-80"
            onPress={verify}
          >
            <Text className="font-medium text-paper">Vérifier</Text>
          </Pressable>
        </>
      )}
      {err ? <Text className="text-sm text-bad">{err}</Text> : null}
      <Link href="/(auth)/sign-in" className="mt-3 text-center text-accent">
        J&apos;ai déjà un compte
      </Link>
    </View>
  );
}
