// Sélection de rôle (prospect/pro) après inscription. BUUPP impose
// l'EXCLUSIVITÉ de rôle : c'est le serveur qui matérialise/garde le rôle
// (ensureRole) — ici on ne fait que rediriger vers l'espace voulu ;
// l'appel à /api/me/role (puis aux routes /prospect|/pro) déclenche le
// provisioning côté serveur, identique au web. Un conflit éventuel
// (compte déjà typé dans l'autre rôle) sera renvoyé par l'API et devra
// afficher le même message que le web (à brancher).
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function RoleSelect() {
  const router = useRouter();
  return (
    <View className="flex-1 justify-center gap-5 bg-ivory px-6">
      <Text className="font-serif text-3xl text-ink">Vous êtes…</Text>
      <Text className="text-sm text-ink-3">
        Le choix est définitif (un compte = prospect OU pro).
      </Text>

      <Pressable
        className="rounded-2xl border border-line bg-paper p-5 active:opacity-80"
        onPress={() => router.replace("/(prospect)/portefeuille")}
      >
        <Text className="text-lg font-medium text-ink">Particulier</Text>
        <Text className="mt-1 text-sm text-ink-3">
          Je monétise mes données et accepte des mises en relation.
        </Text>
      </Pressable>

      <Pressable
        className="rounded-2xl border border-line bg-paper p-5 active:opacity-80"
        onPress={() => router.replace("/(pro)/overview")}
      >
        <Text className="text-lg font-medium text-ink">Professionnel</Text>
        <Text className="mt-1 text-sm text-ink-3">
          Je lance des campagnes pour acquérir des contacts.
        </Text>
      </Pressable>
    </View>
  );
}
