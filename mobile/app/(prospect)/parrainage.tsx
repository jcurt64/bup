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
        nav: "back",
      }}
    >
      <QueryGate query={q}>
        {(d) => {
          // Fenêtre de validité du lien : ouverte tant que now < launchAt.
          // launchAt absent → lien actif (pas de fausse expiration).
          const launchMs = d.launchAt ? new Date(d.launchAt).getTime() : null;
          const hasLaunch = launchMs != null && !Number.isNaN(launchMs);
          const expired = hasLaunch && now >= launchMs;
          const cd = hasLaunch ? splitCountdown(launchMs - now) : null;
          const urgent =
            hasLaunch && !expired && launchMs - now <= 86_400_000;
          const launchLabel = hasLaunch ? launchLabelFr(launchMs) : null;

          return (
            <>
              <Card dark badge={{ icon: "gift-outline", tone: "violet" }}>
                <Text className="font-mono text-[11px] uppercase text-ink-5">
                  Votre code
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
                    disabled={expired}
                    style={expired ? { opacity: 0.5 } : undefined}
                    onPress={async () => {
                      if (expired) return;
                      await Clipboard.setStringAsync(d.refCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Text className="text-sm font-semibold text-ink">
                      {expired
                        ? "Lien expiré"
                        : copied
                          ? "Copié ✓"
                          : "Copier"}
                    </Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 items-center rounded-full border border-paper/30 py-2.5"
                    disabled={expired}
                    style={expired ? { opacity: 0.5 } : undefined}
                    onPress={() => {
                      if (expired) return;
                      Share.share({
                        message: `Rejoins BUUPP avec mon code ${d.refCode} : https://www.buupp.com/inscription/prospect?ref=${d.refCode}`,
                      });
                    }}
                  >
                    <Text className="text-sm font-semibold text-paper">
                      Partager
                    </Text>
                  </Pressable>
                </View>
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
                  label="Bonus actuel"
                  value={d.vipEligible ? `+${d.vipFlatBonusEur} €` : "×2"}
                  hint={
                    d.vipEligible
                      ? `flat (budget > ${d.vipBudgetMinEur} €)`
                      : "1er mois post-lancement"
                  }
                  accent={d.vipEligible}
                />
                <Stat
                  label="Statut"
                  value={
                    d.vipEligible
                      ? "VIP"
                      : d.count > 0
                        ? "Actif"
                        : "En attente"
                  }
                  hint={
                    d.vipEligible
                      ? "Palier débloqué"
                      : d.count >= d.cap
                        ? "Plafond atteint"
                        : "Invitez vos proches"
                  }
                  accent={d.vipEligible}
                />
              </View>

              {d.vipEligible ? (
                <Card>
                  <Text className="text-sm text-good">
                    ✓ Éligible VIP ({d.vipThreshold} filleuls) — bonus{" "}
                    {d.vipFlatBonusEur} €
                  </Text>
                </Card>
              ) : null}

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
                    lien pour gagner les avantages VIP.
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
