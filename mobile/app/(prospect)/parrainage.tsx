// Parrainage — /api/prospect/parrainage. Partage du code via Share natif.
// Champs = Prospect.jsx fn Parrainage (web). Parité données : compte à rebours,
// 4 stats, statut filleul, bouton Copier.
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";

import {
  Card,
  dateFr,
  QueryGate,
  ScrollScreen,
  Stat,
} from "../../components/screen";
import { useParrainage } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Paliers de parrainage — noms/couleurs/avantages identiques au web
// (Prospect.jsx REFERRAL_TIERS : Used / Paid / Proud).
const REFERRAL_TIERS = [
  {
    tier: "cuivre",
    label: "Used",
    range: "1 – 2",
    color: "#B87333",
    cardColor: "#15803D",
    desc: "+50 % de coins à chaque acceptation de chaque filleul, sans limite de durée.",
    advantage:
      "Avantage bonus : 50 % des BUUPP coins à chaque acceptation de chaque filleul, sans limite de durée.",
  },
  {
    tier: "argent",
    label: "Paid",
    range: "3 – 9",
    color: "#9CA3AF",
    cardColor: "#4F46E5",
    desc: "Accès aux offres flash 20 min avant tout le monde.",
    advantage:
      "Avantage prioritaire : tous les avantages bonus + accès aux offres flash 20 min avant tout le monde.",
  },
  {
    tier: "or",
    label: "Proud",
    range: "10",
    color: "#E6B422",
    cardColor: "#B45309",
    desc: "Statut Governor — consulté·e en avant-première sur les nouveautés.",
    advantage:
      "Avantage governor : tous les avantages bonus + avantages prioritaire + consulté·e par BUUPP sur les nouveautés (droit de vote).",
  },
] as const;

// Lien de parrainage — MÊME forme que le web (Prospect.jsx : « buupp.com/ref/CODE »),
// utilisé à la fois par « Copier » et « Partager ».
const referralLink = (code: string) => `https://www.buupp.com/ref/${code}`;

function splitCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

const launchLabelFr = (ms: number) =>
  new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ParrainageScreen() {
  const q = useParrainage();
  useRefetchOnFocus(q);

  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // Tick 1s pour le décompte (indépendant du fetch).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Parrainage",
        title: "Invitez, gagnez plus",
        desc: "Partagez votre code. Chaque filleul inscrit augmente vos avantages.",
        nav: "drawer",
      }}
    >
      <QueryGate query={q}>
        {(d) => {
          // Fenêtre de validité du lien : ouverte tant que now < launchAt.
          // launchAt absent → lien actif (pas de fausse expiration).
          const launchMs = d.launchAt ? new Date(d.launchAt).getTime() : null;
          const hasLaunch = launchMs != null && !Number.isNaN(launchMs);
          const expired = hasLaunch && now >= launchMs;
          const capReached = (d?.count ?? 0) >= (d?.cap ?? 10);
          const linkDisabled = expired || capReached;
          const cd = hasLaunch ? splitCountdown(launchMs - now) : null;
          const urgent =
            hasLaunch && !expired && launchMs - now <= 86_400_000;
          const launchLabel = hasLaunch ? launchLabelFr(launchMs) : null;

          const currentTier = REFERRAL_TIERS.find((t) => t.tier === d.badgeTier) ?? null;

          return (
            <>
              {/* « Palier X atteint » — parité web (carte teintée à la couleur
                  du palier + avantage débloqué). */}
              {currentTier ? (
                <View
                  className="flex-row items-center gap-3.5 rounded-3xl p-4"
                  style={{
                    backgroundColor: `${currentTier.color}1F`,
                    borderWidth: 1,
                    borderColor: currentTier.color,
                  }}
                >
                  <Text style={{ fontSize: 28, lineHeight: 34 }}>👑</Text>
                  <View className="flex-1">
                    <Text
                      className="text-[11px] font-bold uppercase text-ink"
                      style={{ letterSpacing: 1.5 }}
                    >
                      Palier {currentTier.label} atteint
                    </Text>
                    <Text className="mt-1 text-[14px] leading-5 text-ink-2">
                      {currentTier.advantage}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Card dark badge={{ icon: "gift-outline", tone: "violet" }}>
                <Text className="font-mono text-[11px] uppercase text-ink-5">
                  Votre lien unique
                </Text>
                <Text
                  className="mt-1 font-mono text-[13px] text-ink-5"
                  numberOfLines={1}
                  style={linkDisabled ? { opacity: 0.45 } : undefined}
                >
                  buupp.com/ref/{d.refCode}
                </Text>
                <Text
                  className="mt-1 font-serif text-3xl tracking-widest text-paper"
                  style={
                    expired
                      ? {
                          opacity: 0.45,
                          textDecorationLine: "line-through",
                        }
                      : undefined
                  }
                >
                  {d.refCode}
                </Text>
                <View className="mt-3 flex-row gap-3">
                  <Pressable
                    className="flex-1 items-center rounded-full bg-paper py-2.5"
                    disabled={linkDisabled}
                    style={linkDisabled ? { opacity: 0.5 } : undefined}
                    onPress={async () => {
                      if (linkDisabled) return;
                      await Clipboard.setStringAsync(referralLink(d.refCode));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Text className="text-sm font-semibold text-ink">
                      {capReached ? "Plafond atteint" : expired ? "Lien expiré" : copied ? "Copié !" : "Copier"}
                    </Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 items-center rounded-full border border-paper/30 py-2.5"
                    disabled={linkDisabled}
                    style={linkDisabled ? { opacity: 0.5 } : undefined}
                    onPress={() => {
                      if (linkDisabled) return;
                      Share.share({
                        message: `Rejoins BUUPP avec mon code ${d.refCode} : ${referralLink(d.refCode)}`,
                      });
                    }}
                  >
                    <Text className="text-sm font-semibold text-paper">
                      Partager
                    </Text>
                  </Pressable>
                </View>
                {capReached ? (
                  <Text className="mt-3 text-[12.5px] leading-5 text-paper/80">
                    Plafond de {d.cap} filleuls atteint — votre lien est désormais désactivé. Bravo !
                  </Text>
                ) : null}
              </Card>

              {hasLaunch && !expired && cd ? (
                <Card>
                  <Text
                    className="text-[11px] font-bold uppercase text-violet"
                    style={{ letterSpacing: 1 }}
                  >
                    ⏳ Lien valable uniquement avant le lancement
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-ink-3">
                    Votre lien de parrainage cesse d&apos;être valide au
                    lancement officiel (le {launchLabel}). Après cette date,
                    plus aucun filleul ne sera crédité — partagez-le dès
                    maintenant.
                  </Text>
                  <View className="mt-3 flex-row gap-2">
                    {(
                      [
                        ["JOURS", cd.d],
                        ["H", cd.h],
                        ["MIN", cd.m],
                        ["SEC", cd.s],
                      ] as const
                    ).map(([lbl, val]) => (
                      <View
                        key={lbl}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          urgent
                            ? "border-bad bg-bad/10"
                            : "border-line bg-ivory"
                        }`}
                      >
                        <Text
                          className={`font-serif text-xl ${
                            urgent ? "text-bad" : "text-ink"
                          }`}
                        >
                          {pad(val)}
                        </Text>
                        <Text
                          className={`mt-0.5 font-mono text-[9px] ${
                            urgent ? "text-bad" : "text-ink-4"
                          }`}
                          style={{ letterSpacing: 1 }}
                        >
                          {lbl}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {hasLaunch && expired ? (
                <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
                  <Text
                    className="text-[11px] font-bold uppercase text-bad"
                    style={{ letterSpacing: 1 }}
                  >
                    🔒 Lien de parrainage désactivé
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-bad">
                    La phase de pré-inscription est terminée (lancement le{" "}
                    {launchLabel}). Votre lien ne crédite plus de filleul.
                  </Text>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Stat
                  label="Filleuls actifs"
                  value={String(d.count)}
                  hint={`/ ${d.cap} max`}
                />
                <Stat
                  label="Places restantes"
                  value={String(Math.max(0, d.cap - d.count))}
                  hint="avant plafond"
                />
              </View>
              <View className="flex-row gap-3">
                <Stat
                  label="Votre palier"
                  value={currentTier?.label ?? "—"}
                  hint={d.count > 0 ? "avantages débloqués" : "invitez pour débloquer"}
                  accent={currentTier != null}
                />
                <Stat
                  label="Statut"
                  value={d.count > 0 ? "Actif" : "En attente"}
                  hint={
                    d.count >= d.cap
                      ? "Plafond atteint"
                      : "Invitez vos proches"
                  }
                />
              </View>

              {/* Prochain palier — message adaptatif (Used 1 / Paid 3 / Proud
                  10 filleuls ; noms de paliers identiques au web). */}
              {(() => {
                const byTier = Object.fromEntries(REFERRAL_TIERS.map((t) => [t.tier, t]));
                const next =
                  d.count < 1
                    ? { n: 1, t: byTier.cuivre }
                    : d.count < 3
                      ? { n: 3, t: byTier.argent }
                      : d.count < 10
                        ? { n: 10, t: byTier.or }
                        : null;
                if (!next) {
                  return (
                    <Text className="text-sm text-ink-3">
                      🏆 Palier{" "}
                      <Text style={{ color: byTier.or.color, fontWeight: "700" }}>Proud</Text>{" "}
                      atteint — vous êtes au sommet du parrainage !
                    </Text>
                  );
                }
                const left = next.n - d.count;
                return (
                  <Text className="text-sm text-ink-3">
                    Plus que{" "}
                    <Text className="font-semibold text-ink">
                      {left} filleul{left > 1 ? "s" : ""}
                    </Text>{" "}
                    pour décrocher le palier{" "}
                    <Text style={{ color: next.t.color, fontWeight: "700" }}>{next.t.label}</Text>.
                  </Text>
                );
              })()}

              <Card badge={{ icon: "trophy-outline", tone: "amber" }}>
                <Text className="font-serif text-base text-ink">
                  Avantages fondateur·ice
                </Text>
                <Text className="mt-1.5 text-[13px] leading-5 text-ink-3">
                  Inscrire un filleul le rend Fondateur·ice à son tour. Selon votre nombre de filleuls, vous débloquez des avantages cumulatifs :
                </Text>
                <View className="mt-3 gap-2.5">
                  {REFERRAL_TIERS.map((t) => {
                    const isCurrent = d.badgeTier === t.tier;
                    return (
                      <View
                        key={t.tier}
                        className="rounded-2xl p-3"
                        style={{
                          borderWidth: isCurrent ? 1.5 : 1,
                          borderColor: isCurrent ? t.cardColor : "rgba(120,120,120,0.18)",
                        }}
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View
                            className="rounded-full px-2.5 py-0.5"
                            style={{ backgroundColor: t.cardColor }}
                          >
                            <Text className="font-mono text-[11px] font-semibold text-white">
                              {t.range}
                            </Text>
                          </View>
                          <Text className="font-serif text-lg text-ink">{t.label}</Text>
                        </View>
                        <Text className="mt-1.5 text-[13px] leading-5 text-ink-3">{t.desc}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card badge={{ icon: "people-outline", tone: "coral" }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-serif text-lg text-ink">
                    Vos filleuls
                  </Text>
                  <Text className="font-mono text-xs text-ink-4">
                    {d.count} / {d.cap}
                  </Text>
                </View>
                {d.filleuls.length > 0 ? (
                  <View className="mt-2 gap-1.5">
                    {d.filleuls.map((f, i) => (
                      <View key={i} className="flex-row justify-between">
                        <Text className="flex-1 text-sm text-ink-2">
                          {[f.prenom, f.nom].filter(Boolean).join(" ") || "—"}
                          {f.ville ? ` · ${f.ville}` : ""}
                        </Text>
                        <Text className="font-mono text-xs text-ink-4">
                          {dateFr(f.createdAt)}
                        </Text>
                        <Text className="ml-3 font-mono text-xs text-good">
                          Inscrit ✓
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-1 text-xs text-ink-4">
                    Vous n&apos;avez pas encore de filleul. Partagez votre
                    lien pour débloquer vos avantages fondateur·ice.
                  </Text>
                )}
              </Card>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
