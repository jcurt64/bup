// Tab bar pilule flottante (cf. public/prototype/tab.png) : barre
// rounded-full claire détachée, ombre ; onglet actif = pastille dégradé
// violet→navy + icône blanche + libellé court ; inactif = icône discrète.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "wallet-outline",
  donnees: "albums-outline",
  relations: "swap-horizontal-outline",
  messages: "chatbubble-ellipses-outline",
  preferences: "options-outline",
};
const LABEL: Record<string, string> = {
  portefeuille: "Portefeuille",
  donnees: "Données",
  relations: "Relations",
  messages: "Messages",
  preferences: "Préf.",
};
const TABS = ["portefeuille", "donnees", "relations", "messages", "preferences"];

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routeByName = Object.fromEntries(
    state.routes.map((r, i) => [r.name, { key: r.key, index: i }]),
  );
  const glass = isLiquidGlassAvailable();
  const shadow = {
    shadowColor: "#0F1629",
    shadowOpacity: glass ? 0.1 : 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  } as const;

  const tabs = (
    <>
      {TABS.map((name) => {
        const entry = routeByName[name];
        if (!entry) return null;
        const focused = state.index === entry.index;
        return (
            <Pressable
              key={name}
              onPress={() => navigation.navigate(name as never)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABEL[name]}
              className="items-center"
              style={{ flex: 1 }}
            >
              {focused ? (
                <LinearGradient
                  colors={["#7C5CFC", "#13235B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    height: 44,
                    width: 44,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={ICON[name]} size={20} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full">
                  <Ionicons name={ICON[name]} size={20} color="#8A91A1" />
                </View>
              )}
              {focused ? (
                <Text className="mt-0.5 text-[10px] font-semibold text-ink">
                  {LABEL[name]}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
    </>
  );

  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: insets.bottom + 10,
      }}
      pointerEvents="box-none"
    >
      {glass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor="rgba(255, 255, 255, 0.22)"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 10,
            ...shadow,
          }}
        >
          {tabs}
        </GlassView>
      ) : (
        <View
          className="flex-row items-center justify-between rounded-full bg-paper px-3 py-2.5"
          style={shadow}
        >
          {tabs}
        </View>
      )}
    </View>
  );
}
