// « La Vitrine » — miniature de la page d'accueil du site du pro (capture via
// GET /api/campaign/[id]/preview, route publique qui redirige vers la
// capture). Réplique mobile de VitrinePreview (Prospect.jsx). Au tap →
// `onVisit` (interstitiel de sortie). Repli globe si la capture échoue.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { apiBase } from "../lib/api";
import { useTheme } from "../lib/theme";

/** Extrait l'id de campagne d'un lien tracké `/api/campaign/{id}/visit`. */
export function campaignIdFromVisitUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/api\/campaign\/([^/]+)\/visit/.exec(url);
  return m ? m[1] : null;
}

const PREVIEW_RETRIES = 5;
const PREVIEW_RETRY_MS = 4000;

export function VitrinePreview({
  campaignId,
  proName,
  onVisit,
}: {
  campaignId: string | null | undefined;
  proName: string;
  onVisit: () => void;
}) {
  const { c } = useTheme();
  // La capture peut être en cours de génération (route → 503) : on réessaie
  // quelques fois avant d'afficher « Aperçu indisponible » (parité web).
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const failed = attempt > PREVIEW_RETRIES;
  const [pendingRetry, setPendingRetry] = useState(false);
  useEffect(() => {
    if (!pendingRetry) return;
    const t = setTimeout(() => {
      setPendingRetry(false);
      setAttempt((a) => a + 1);
    }, PREVIEW_RETRY_MS);
    return () => clearTimeout(t);
  }, [pendingRetry]);
  if (!campaignId) return null;
  let uri: string | null = null;
  try {
    uri = `${apiBase()}/api/campaign/${campaignId}/preview?w=640${attempt ? `&r=${attempt}` : ""}`;
  } catch {
    uri = null;
  }
  return (
    <Pressable
      onPress={onVisit}
      accessibilityRole="link"
      accessibilityLabel={`Visiter le site de ${proName}`}
      className="active:opacity-85"
      style={{
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.field,
      }}
    >
      <View style={{ width: "100%", aspectRatio: 16 / 10 }}>
        {uri && !failed && !loaded ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="hourglass-outline" size={22} color={c.textMuted} />
            <Text style={{ fontSize: 11, color: c.textMuted }}>Aperçu du site en préparation…</Text>
          </View>
        ) : null}
        {uri && !failed ? (
          <Image
            key={attempt}
            source={{ uri }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            contentPosition="top center"
            accessibilityLabel={`Aperçu du site de ${proName}`}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (attempt < PREVIEW_RETRIES) setPendingRetry(true);
              else setAttempt(PREVIEW_RETRIES + 1);
            }}
            transition={150}
          />
        ) : (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="globe-outline" size={26} color={c.textMuted} />
            <Text style={{ fontSize: 11, color: c.textMuted }}>Aperçu indisponible</Text>
          </View>
        )}
        {/* Bandeau bas « Visiter le site » */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 22,
            paddingBottom: 9,
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Ionicons name="globe-outline" size={13} color="#fff" />
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#fff" }}>Visiter le site</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.92)" />
        </LinearGradient>
      </View>
    </Pressable>
  );
}
