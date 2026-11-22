// Mes données — /api/prospect/donnees (lecture + édition des coordonnées via
// PATCH /api/prospect/donnees, tier "identity").
//
// Pivot « mise en relation pure » : BUUPP ne collecte plus que 4 données —
// prénom, initiale du nom, téléphone, e-mail. Le professionnel ne voit que le
// prénom et l'initiale ; appels et e-mails passent par la plateforme BUUPP.
// Le téléphone n'est jamais PATCHé ici : saisie/changement uniquement via la
// vérification SMS (PhoneVerifySheet), parité web PhoneVerifyModal.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, Text, TextInput, View } from "react-native";

import { PhoneVerifySheet } from "../../components/phone-verify-sheet";
import { QueryGate, ScrollScreen } from "../../components/screen";
import type { CompactExtra } from "../../lib/header-scroll";
import { nomInitial } from "../../lib/contact-channels";
import { useTheme } from "../../lib/theme";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import { useProspectDonnees, usePatchDonnees } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Base web (= prod que pointe le mobile) — sert les pages légales (/rgpd…).
const WEB_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://www.buupp.com";

type FieldKey = "prenom" | "nom" | "telephone" | "email";
type FieldDef = {
  key: FieldKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const FIELDS: FieldDef[] = [
  { key: "prenom", label: "Prénom", icon: "person-outline" },
  { key: "nom", label: "Initiale du nom", icon: "text-outline" },
  { key: "telephone", label: "Téléphone", icon: "call-outline" },
  { key: "email", label: "E-mail", icon: "mail-outline" },
];

// « … » animé du bouton Enregistrer (Animated natif RN, sans dépendance).
const LOADER_DOT_COLORS = ["#A78BFA", "#F472B6", "#FBBF24"] as const;

function ThreeDotsLoader() {
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]);
    const loop = Animated.loop(
      Animated.stagger(160, [pulse(a0), pulse(a1), pulse(a2)]),
    );
    loop.start();
    return () => loop.stop();
  }, [a0, a1, a2]);

  const dot = (v: Animated.Value, color: string) => (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
        ],
      }}
    />
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Enregistrement en cours"
      style={{ flexDirection: "row", alignItems: "center", gap: 7, height: 24 }}
    >
      {dot(a0, LOADER_DOT_COLORS[0])}
      {dot(a1, LOADER_DOT_COLORS[1])}
      {dot(a2, LOADER_DOT_COLORS[2])}
    </View>
  );
}

function RowFieldIcon({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: c.tintViolet,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Ionicons name={icon} size={17} color={c.accVioletDeep} />
    </View>
  );
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

export default function Donnees() {
  const { c, mode } = useTheme();
  const q = useProspectDonnees();
  const patch = usePatchDonnees();
  useRefetchOnFocus(q);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({});
  // Masque l'affichage des valeurs (•••• ••••) sans toucher au stockage.
  const [pseudonymized, setPseudonymized] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState<{ initialPhone: string } | null>(
    null,
  );

  const identity = (q.data?.identity ?? {}) as Record<string, unknown>;
  const filledCount = FIELDS.filter((f) => str(identity[f.key]).trim() !== "")
    .length;

  const compactExtras: CompactExtra[] | undefined = q.data
    ? [
        {
          icon: "person-outline",
          value: `${filledCount}/${FIELDS.length}`,
          color: c.accViolet,
          bg: c.accentSoft,
        },
        {
          icon: pseudonymized ? "eye-off-outline" : "eye-outline",
          onPress: () => setPseudonymized((v) => !v),
          color: pseudonymized ? "#FFFFFF" : c.accVioletDeep,
          bg: pseudonymized ? c.accViolet : c.accentSoft,
          accessibilityLabel: pseudonymized
            ? "Afficher mes données"
            : "Masquer mes données",
        },
      ]
    : undefined;

  async function save() {
    // Rien de modifié → on referme sans appeler l'API (le PATCH rejette un
    // payload `fields` vide).
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v === undefined) continue;
      fields[k] = k === "nom" ? nomInitial(v) : v.trim();
    }
    if (Object.keys(fields).length === 0) {
      setEditing(false);
      return;
    }
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      Alert.alert("Adresse e-mail invalide", "Vérifiez votre adresse e-mail.");
      return;
    }
    try {
      await patch.mutateAsync({ tier: "identity", fields });
      setEditing(false);
      setDraft({});
    } catch (e) {
      Alert.alert(
        "Enregistrement impossible",
        e instanceof Error && e.message
          ? e.message
          : "Une erreur est survenue. Réessayez dans un instant.",
      );
    }
  }

  return (
    <ScrollScreen onRefresh={q.refetch} compactExtras={compactExtras}>
      {/* Hero — card gradient. */}
      <LinearGradient
        colors={HERO_GRADIENT[mode]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={{
          borderRadius: 22,
          padding: 20,
          shadowColor: "#5B3FE0",
          shadowOpacity: 0.26,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 14 },
          elevation: 6,
        }}
      >
        <View className="flex-row items-start justify-between gap-3.5">
          <View className="flex-1">
            <Text
              className="text-[11px] font-bold uppercase text-white/70"
              style={{ letterSpacing: 1.6 }}
            >
              Mes données
            </Text>
            <Text className="mt-1 font-serif text-2xl text-white">
              Mes coordonnées
            </Text>
            <Text className="mt-2 text-[14px] leading-5 text-white/80">
              BUUPP ne vous demande que l&apos;essentiel pour être mis en
              relation : votre prénom, l&apos;initiale de votre nom, votre
              téléphone et votre e-mail.
            </Text>
          </View>
          <View
            className="items-center justify-center"
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.16)",
              flexShrink: 0,
            }}
          >
            <Ionicons name="id-card-outline" size={24} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      {/* Card droits RGPD. */}
      <View
        style={{
          flexDirection: "row",
          gap: 13,
          padding: 16,
          borderRadius: 18,
          backgroundColor: c.tintAmber,
          borderWidth: 1,
          borderColor: c.borderSoft,
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.borderSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={19} color={c.accAmber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="font-serif" style={{ fontSize: 16.5, color: c.text }}>
            Vos droits sur vos données
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: c.accAmber,
              marginTop: 2,
            }}
          >
            ARTICLES 15 À 22 DU RGPD
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 12.5,
              lineHeight: 19,
              color: c.textSub,
            }}
          >
            Rendez-vous sur la{" "}
            <Text
              style={{ fontWeight: "600", textDecorationLine: "underline" }}
              onPress={() =>
                void WebBrowser.openBrowserAsync(
                  `${WEB_BASE}/rgpd?from=mobile-app`,
                  {
                    presentationStyle:
                      WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                  },
                )
              }
            >
              page de gestion des données personnelles
            </Text>{" "}
            pour toute information et l&apos;exercice de vos droits.
          </Text>
        </View>
      </View>

      <QueryGate query={q}>
        {(d) => {
          const row = (d.identity ?? {}) as Record<string, unknown>;
          const phoneIsVerified = Boolean(d.identityMeta?.phoneVerifiedAt);
          const complete = filledCount === FIELDS.length;
          return (
            <View className="gap-3">
              {/* Card « Cacher vos données » — pseudonymisation d'affichage. */}
              <Pressable
                onPress={() => setPseudonymized((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: pseudonymized }}
                accessibilityLabel="Cacher vos données"
                className="active:opacity-80"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 15,
                  borderRadius: 18,
                  backgroundColor: c.tintViolet,
                  borderWidth: 1,
                  borderColor: c.violetSoft,
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: pseudonymized ? c.accViolet : c.surface,
                    borderWidth: 1,
                    borderColor: pseudonymized ? c.accViolet : c.violetSoft,
                    flexShrink: 0,
                  }}
                >
                  <Ionicons
                    name={pseudonymized ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color={pseudonymized ? "#FFFFFF" : c.accVioletDeep}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-serif"
                    style={{ fontSize: 16.5, color: c.text }}
                  >
                    Cacher vos données
                  </Text>
                  <Text style={{ fontSize: 12.5, color: c.textSub, marginTop: 2 }}>
                    {pseudonymized
                      ? "Affichage masqué — vos données restent enregistrées"
                      : "Masquez l'affichage de vos coordonnées."}
                  </Text>
                </View>
                <View
                  style={{
                    width: 46,
                    height: 27,
                    borderRadius: 999,
                    backgroundColor: pseudonymized ? c.accViolet : c.track,
                    flexShrink: 0,
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: 3,
                      left: pseudonymized ? 22 : 3,
                      width: 21,
                      height: 21,
                      borderRadius: 999,
                      backgroundColor: c.surface,
                    }}
                  />
                </View>
              </Pressable>

              {/* Card unique « Mes coordonnées ». */}
              <View
                className="overflow-hidden rounded-[24px] bg-paper"
                style={{
                  borderWidth: 1,
                  borderColor: c.borderSoft,
                  shadowColor: "#000000",
                  shadowOpacity: 0.08,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 4,
                }}
              >
                <View
                  className="flex-row items-center"
                  style={{
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingTop: 15,
                    paddingBottom: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: c.track,
                  }}
                >
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: c.accentSoft,
                    }}
                  >
                    <Ionicons name="id-card-outline" size={20} color={c.accent} />
                  </View>
                  <Text
                    className="flex-1 font-serif"
                    style={{ fontSize: 20, color: c.text }}
                  >
                    Mes coordonnées
                  </Text>
                  <View
                    className="flex-row items-center"
                    style={{
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: complete ? c.goodSoft : c.accentSoft,
                    }}
                  >
                    {complete ? (
                      <Ionicons name="checkmark" size={12} color={c.good} />
                    ) : null}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: complete ? c.good : c.accent,
                      }}
                    >
                      {complete ? "Complet" : `${filledCount}/${FIELDS.length}`}
                    </Text>
                  </View>
                </View>

                {/* Réassurance mise en relation. */}
                <View
                  className="flex-row items-start"
                  style={{
                    gap: 9,
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    backgroundColor: c.tintViolet,
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={15}
                    color={c.accVioletDeep}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      lineHeight: 19,
                      color: c.textSub,
                    }}
                  >
                    Le professionnel ne voit que votre prénom et l&apos;initiale
                    de votre nom. Appels et e-mails passent par BUUPP.
                  </Text>
                </View>

                {editing ? (
                  <View className="gap-3 px-5 py-4">
                    {FIELDS.map((f) => {
                      const current =
                        draft[f.key] !== undefined
                          ? (draft[f.key] as string)
                          : str(row[f.key]);
                      return (
                        <View key={f.key} className="gap-1.5">
                          <View className="flex-row items-center gap-2">
                            <Ionicons name={f.icon} size={14} color={c.accent} />
                            <Text className="text-[13px] uppercase text-ink-4">
                              {f.label}
                            </Text>
                          </View>
                          {f.key === "telephone" ? (
                            <>
                              <Text className="text-base text-ink-3">
                                {current.trim() !== "" ? current : "—"}
                              </Text>
                              <Text className="text-[13px] text-ink-4">
                                Enregistré uniquement après vérification par SMS
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setPhoneSheet({ initialPhone: str(row.telephone) })
                                }
                                accessibilityRole="button"
                                className="mt-1 flex-row items-center justify-center gap-2 self-start rounded-full border border-line bg-paper px-4 py-2 active:opacity-70"
                              >
                                <Ionicons
                                  name="chatbubble-ellipses-outline"
                                  size={14}
                                  color={c.accVioletDeep}
                                />
                                <Text
                                  className="text-[13px] font-semibold"
                                  style={{ color: c.accVioletDeep }}
                                >
                                  {str(row.telephone).trim() === ""
                                    ? "Ajouter et vérifier par SMS"
                                    : phoneIsVerified
                                      ? "Changer de numéro"
                                      : "Vérifier par SMS"}
                                </Text>
                              </Pressable>
                            </>
                          ) : (
                            <TextInput
                              value={current}
                              onChangeText={(v) =>
                                setDraft((s) => ({
                                  ...s,
                                  [f.key]: f.key === "nom" ? nomInitial(v) : v,
                                }))
                              }
                              maxLength={f.key === "nom" ? 1 : undefined}
                              autoCapitalize={
                                f.key === "email"
                                  ? "none"
                                  : f.key === "nom"
                                    ? "characters"
                                    : "words"
                              }
                              autoCorrect={false}
                              keyboardType={
                                f.key === "email" ? "email-address" : "default"
                              }
                              placeholder={
                                f.key === "nom"
                                  ? "Ex. D"
                                  : f.key === "email"
                                    ? "vous@exemple.fr"
                                    : "Ex. Marie"
                              }
                              placeholderTextColor={c.textMuted}
                              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
                            />
                          )}
                        </View>
                      );
                    })}
                    <View className="mt-1 flex-row gap-2">
                      <Pressable
                        disabled={patch.isPending}
                        className="flex-1 items-center rounded-full border border-line py-2.5"
                        onPress={() => {
                          setEditing(false);
                          setDraft({});
                        }}
                      >
                        <Text className="text-base text-ink-3">Annuler</Text>
                      </Pressable>
                      <Pressable
                        disabled={patch.isPending}
                        className="flex-1 items-center rounded-full py-2.5"
                        style={{ backgroundColor: c.btnBg }}
                        onPress={() => void save()}
                      >
                        {patch.isPending ? (
                          <ThreeDotsLoader />
                        ) : (
                          <Text
                            className="text-base font-semibold"
                            style={{ color: c.btnText }}
                          >
                            Enregistrer
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View>
                    {FIELDS.map((f, idx) => {
                      const raw = str(row[f.key]).trim();
                      const main = f.key === "nom" ? nomInitial(raw) : raw;
                      const isEmpty = main === "";
                      const isMasked = pseudonymized && !isEmpty;
                      const displayed = isMasked
                        ? "•••• ••••"
                        : f.key === "nom" && main
                          ? `${main}.`
                          : main;
                      const isPhone = f.key === "telephone";
                      const phoneVerified =
                        isPhone && phoneIsVerified && !isEmpty && !isMasked;
                      const phoneUnverified =
                        isPhone && !phoneIsVerified && !isEmpty && !isMasked;
                      return (
                        <View
                          key={f.key}
                          className="flex-row items-center"
                          style={{
                            gap: 13,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: idx === FIELDS.length - 1 ? 0 : 1,
                            borderBottomColor: c.track,
                          }}
                        >
                          <RowFieldIcon icon={f.icon} />
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              fontSize: 14.5,
                              fontWeight: main ? "500" : "400",
                              color: main ? c.text : c.textSub,
                            }}
                          >
                            {f.label}
                          </Text>
                          <View
                            className="flex-row items-center justify-end"
                            style={{ gap: 7, maxWidth: "62%" }}
                          >
                            {isEmpty ? (
                              <Pressable
                                onPress={() =>
                                  isPhone
                                    ? setPhoneSheet({ initialPhone: "" })
                                    : setEditing(true)
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`Ajouter ${f.label}`}
                                hitSlop={6}
                                className="flex-row items-center active:opacity-70"
                                style={{
                                  gap: 5,
                                  paddingHorizontal: 11,
                                  paddingVertical: 6,
                                  borderRadius: 999,
                                  backgroundColor: c.tintViolet,
                                  borderWidth: 1,
                                  borderColor: c.violetSoft,
                                }}
                              >
                                <Ionicons
                                  name="add"
                                  size={14}
                                  color={c.accVioletDeep}
                                />
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: "700",
                                    color: c.accVioletDeep,
                                  }}
                                >
                                  Ajouter
                                </Text>
                              </Pressable>
                            ) : (
                              <Text
                                numberOfLines={1}
                                style={{
                                  flexShrink: 1,
                                  textAlign: "right",
                                  fontSize: 13.5,
                                  color: c.text,
                                }}
                              >
                                {displayed}
                              </Text>
                            )}
                            {phoneVerified ? (
                              <View
                                className="items-center justify-center"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 999,
                                  backgroundColor: c.goodSoft,
                                  flexShrink: 0,
                                }}
                              >
                                <Ionicons name="checkmark" size={11} color={c.good} />
                              </View>
                            ) : null}
                            {phoneUnverified ? (
                              <Pressable
                                onPress={() => setPhoneSheet({ initialPhone: main })}
                                accessibilityRole="button"
                                accessibilityLabel="Téléphone non vérifié — vérifier par SMS"
                                hitSlop={6}
                                style={{
                                  paddingVertical: 2,
                                  paddingHorizontal: 7,
                                  borderRadius: 999,
                                  backgroundColor: "rgba(217,119,6,0.14)",
                                  flexShrink: 0,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: "600",
                                    color: c.warn,
                                  }}
                                >
                                  Non vérifié
                                </Text>
                              </Pressable>
                            ) : null}
                            {isPhone && !isEmpty ? (
                              <Pressable
                                onPress={() => setPhoneSheet({ initialPhone: main })}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  phoneIsVerified
                                    ? "Changer de numéro (vérification SMS)"
                                    : "Vérifier le téléphone par SMS"
                                }
                                hitSlop={6}
                                className="items-center justify-center active:opacity-70"
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  borderColor: c.borderSoft,
                                  backgroundColor: c.surface,
                                  flexShrink: 0,
                                }}
                              >
                                <Ionicons
                                  name="pencil-outline"
                                  size={13}
                                  color={c.textSub}
                                />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                    <View
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        backgroundColor: c.tintViolet,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Modifier mes coordonnées"
                        onPress={() => setEditing(true)}
                        className="flex-row items-center justify-center active:opacity-70"
                        style={{
                          gap: 7,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: c.surface,
                          borderWidth: 1,
                          borderColor: c.borderSoft,
                        }}
                      >
                        <Ionicons name="pencil-outline" size={16} color={c.text} />
                        <Text
                          style={{ fontSize: 12.5, fontWeight: "600", color: c.text }}
                        >
                          Modifier
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      </QueryGate>

      <PhoneVerifySheet
        visible={phoneSheet !== null}
        initialPhone={phoneSheet?.initialPhone}
        onClose={() => setPhoneSheet(null)}
      />
    </ScrollScreen>
  );
}
