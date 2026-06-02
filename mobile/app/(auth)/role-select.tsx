import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Accent, BrandLogo, LegalFooter } from "../../components/ui";
import { setRoleIntent } from "../../lib/role-intent";

export default function RoleSelect() {
  const router = useRouter();
  // Mémorise le rôle choisi (SecureStore) AVANT de naviguer : le 1er appel
  // API matérialisera ce rôle côté serveur (ensureProspect / ensureProAccount).
  const choose = (role: "prospect" | "pro", href: string) => {
    void setRoleIntent(role);
    router.replace(href as never);
  };
  return (
    <View className="flex-1 justify-center gap-5 bg-ivory px-6">
      <BrandLogo small />
      <View className="gap-1">
        <Text className="text-center font-serif text-3xl text-ink">
          Vous <Accent>êtes…</Accent>
        </Text>
        <Text className="text-center text-lg leading-6 text-ink-3">
          Le choix est définitif (un compte = prospect OU pro).
        </Text>
      </View>

      <Pressable
        className="rounded-3xl border border-line bg-paper p-5 active:opacity-80"
        style={{
          shadowColor: "#0F1629",
          shadowOpacity: 0.05,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        }}
        onPress={() => choose("prospect", "/(prospect)/portefeuille")}
      >
        <Text className="text-lg font-medium text-ink">Particulier</Text>
        <Text className="mt-1 text-sm text-ink-3">
          Je monétise mes données et accepte des mises en relation.
        </Text>
      </Pressable>

      <Pressable
        className="rounded-3xl border border-line bg-paper p-5 active:opacity-80"
        style={{
          shadowColor: "#0F1629",
          shadowOpacity: 0.05,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        }}
        onPress={() => choose("pro", "/(pro)/overview")}
      >
        <Text className="text-lg font-medium text-ink">Professionnel</Text>
        <Text className="mt-1 text-sm text-ink-3">
          Je lance des campagnes pour acquérir des contacts.
        </Text>
      </Pressable>

      <LegalFooter />
    </View>
  );
}
