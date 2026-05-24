// Bannière in-app slide-down affichée quand un push arrive en
// foreground (le shouldShowBanner du handler est false, donc l'OS ne
// montre pas sa propre bannière). Auto-dismiss 4s + swipe-up.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PushBannerMessage = {
  type: "classic" | "flash";
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type Ctx = {
  show: (msg: PushBannerMessage) => void;
  hide: () => void;
};

const PushBannerContext = createContext<Ctx | null>(null);

export function usePushBanner(): Ctx {
  const ctx = useContext(PushBannerContext);
  if (!ctx) throw new Error("usePushBanner hors PushBannerProvider");
  return ctx;
}

const AUTO_DISMISS_MS = 4000;
const SLIDE_MS = 280;

export function PushBannerProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<PushBannerMessage | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ty = useSharedValue(-160);
  const op = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    ty.value = withTiming(-160, { duration: 200, easing: Easing.in(Easing.cubic) });
    op.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(setMsg)(null);
    });
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [op, ty]);

  const show = useCallback(
    (next: PushBannerMessage) => {
      setMsg(next);
      ty.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
      op.value = withTiming(1, { duration: SLIDE_MS });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, AUTO_DISMISS_MS);
    },
    [hide, op, ty],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));

  const swipeUp = Gesture.Pan().onEnd((e) => {
    if (e.translationY < -20) runOnJS(hide)();
  });

  function onTap() {
    if (!msg) return;
    const screen = msg.data.screen as string | undefined;
    const relationId = msg.data.relationId as string | undefined;
    const campaignId = msg.data.campaignId as string | undefined;
    if (screen === "relations" && relationId) {
      router.push(`/(prospect)/relations?focusRelation=${encodeURIComponent(relationId)}`);
    } else if (screen === "flash-deals" && campaignId) {
      router.push(`/(prospect)/portefeuille?openFlash=${encodeURIComponent(campaignId)}`);
    }
    hide();
  }

  const ctxValue = useRef<Ctx>({ show, hide });
  ctxValue.current = { show, hide };

  return (
    <PushBannerContext.Provider value={ctxValue.current}>
      {children}
      {msg ? (
        <GestureDetector gesture={swipeUp}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                position: "absolute",
                top: insets.top + 8,
                left: 12,
                right: 12,
                zIndex: 1000,
              },
              aStyle,
            ]}
          >
            <Pressable
              onPress={onTap}
              accessibilityRole="button"
              accessibilityLabel={`${msg.title}. ${msg.body}. Touchez pour ouvrir.`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                borderLeftWidth: 4,
                backgroundColor: msg.type === "flash" ? "#0F1629" : "#FFFFFF",
                borderLeftColor: msg.type === "flash" ? "#FF7A6B" : "#7C5CFC",
                shadowColor: "#0F1629",
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: Platform.OS === "android" ? 6 : 0,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    msg.type === "flash" ? "rgba(255,122,107,0.18)" : "#EDE9FE",
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {msg.type === "flash" ? "⚡" : "👋"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontWeight: "600",
                    fontSize: 14,
                    color: msg.type === "flash" ? "#FFFFFF" : "#0F1629",
                  }}
                >
                  {msg.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 13,
                    marginTop: 2,
                    color: msg.type === "flash" ? "rgba(255,255,255,0.85)" : "#5B6478",
                  }}
                >
                  {msg.body}
                </Text>
              </View>
              <Pressable
                onPress={hide}
                hitSlop={10}
                accessibilityLabel="Fermer"
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={msg.type === "flash" ? "rgba(255,255,255,0.6)" : "#8A91A1"}
                />
              </Pressable>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </PushBannerContext.Provider>
  );
}
