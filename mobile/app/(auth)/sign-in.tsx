// Connexion Clerk (e-mail + mot de passe). MÊME projet Clerk que le web
// → un compte créé sur le web se connecte ici et retombe sur les mêmes
// données Supabase (via le pont serveur). Cf. MOBILE_APP_SPEC.md §2.
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!isLoaded || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/"); // index ré-aiguille selon le rôle
      } else {
        setErr("Étape d'authentification supplémentaire requise.");
      }
    } catch (e: unknown) {
      const msg =
        (e as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
        "Identifiants invalides.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-ivory px-6">
      <Text className="font-serif text-3xl text-ink">BUUPP</Text>
      <Text className="mb-2 text-sm text-ink-3">
        Connectez-vous avec le même compte que sur le web.
      </Text>

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

      {err ? <Text className="text-sm text-bad">{err}</Text> : null}

      <Pressable
        className="mt-2 items-center rounded-xl bg-accent py-3.5 active:opacity-80"
        disabled={busy}
        onPress={onSubmit}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-medium text-paper">Se connecter</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-up" className="mt-3 text-center text-accent">
        Créer un compte
      </Link>
    </View>
  );
}
