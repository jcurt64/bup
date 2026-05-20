// Détail d'un mouvement Portefeuille — bottom-sheet ouverte au clic sur
// une ligne d'historique. Réplique RelationDetailModal du web (cf.
// public/prototype/components/Prospect.jsx fn RelationDetailModal) :
//   en-tête pro · brief campagne · objet · lancement/fin · récompense
//   + délai · bannière contextuelle (acceptée / encore ouverte / clos)
//   + actions Accepter/Refuser/Fermer mirror les conditions canAccept /
//   canRefuse côté web.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { ReportProSheet } from "./report-pro-sheet";
import { useDecideRelation, type MovementRelation } from "../lib/queries";

// Initiales pour avatar (premier mot + premier mot suivant).
function initials(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// "12 mai 2026" — format date long fr-FR pour les lignes Lancement / Fin.
function fmtLongDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// "12,34 €" — montant fr-FR avec virgule.
function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// "dispo le 12/12/2026" — parité web (Prospect.jsx fn formatAvailableAt).
// Retourne null si l'iso est absent / invalide.
function formatAvailableAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    "dispo le " +
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  );
}

// Compacte [1,2,5] → "1-2,5" (idem helper Portefeuille). Inline pour
// éviter une dépendance circulaire écran ⇄ composant.
function formatPaliers(tiers: number[]): string | null {
  const uniq = [...new Set(tiers.filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
  if (uniq.length === 0) return null;
  const groups: string[] = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i <= uniq.length; i++) {
    const cur = uniq[i];
    if (cur === prev + 1) { prev = cur; continue; }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) { start = cur; prev = cur; }
  }
  return groups.join(",");
}

function tierChipLabel(r: MovementRelation): string {
  const list = Array.isArray(r.tiers) && r.tiers.length > 0
    ? r.tiers
    : (r.tier != null ? [r.tier] : null);
  if (!list) return "Palier —";
  const value = formatPaliers(list);
  if (!value) return "Palier —";
  return `${list.length > 1 ? "Paliers" : "Palier"} ${value}`;
}

// Petit composant : libellé en mono caps + valeur.
function LabelValue({
  icon,
  label,
  children,
  align = "left",
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View className="flex-row items-center gap-1">
        {icon ? <Ionicons name={icon} size={10} color="#8A91A1" /> : null}
        <Text
          className="font-mono text-[10px] uppercase text-ink-4"
          style={{ letterSpacing: 0.8 }}
        >
          {label}
        </Text>
      </View>
      <View className="mt-1">{children}</View>
    </View>
  );
}

export function MovementDetailSheet({
  visible,
  onClose,
  relation,
}: {
  visible: boolean;
  onClose: () => void;
  relation: MovementRelation | null;
}) {
  const decide = useDecideRelation();
  const [busy, setBusy] = useState<"accept" | "refuse" | null>(null);
  // Sous-modale de signalement + état local « déjà signalé » pour
  // basculer immédiatement le footer sans refetch. Initialisé depuis
  // `relation.reported` (annoté côté serveur par reportedRelationIds)
  // pour qu'une relation déjà signalée — typiquement depuis le web —
  // affiche d'emblée le chip « déjà transmis ».
  const [reportOpen, setReportOpen] = useState(false);
  const [reportedLocal, setReportedLocal] = useState(false);

  useEffect(() => {
    setReportedLocal(!!relation?.reported);
  }, [relation?.id, relation?.reported]);

  if (!relation) {
    return <BottomSheet visible={visible} onClose={onClose}>{null}</BottomSheet>;
  }

  const r = relation;
  const alreadyAccepted =
    r.relationStatus === "accepted" || r.relationStatus === "settled";
  const alreadyRefused = r.relationStatus === "refused";
  // Cohérent avec la logique web (RelationDetailModal) : on autorise
  // l'acceptation rétroactive tant que la campagne est ouverte.
  const canAccept = !!r.campaignOpen;
  // Refus possible si déjà acceptée + campagne encore active (refund).
  const canRefuse = alreadyAccepted && !!r.campaignActive;

  async function act(action: "accept" | "refuse") {
    setBusy(action);
    try {
      await decide.mutateAsync({ id: r.id, action });
      onClose();
    } finally {
      setBusy(null);
    }
  }

  // Couleurs de bannière selon état (parité web color-mix accent/good).
  const bannerTone = alreadyAccepted
    ? { bg: "#E8F5EE", border: "#B8DDC4", icon: "#16A34A" as const, label: "Acceptée" }
    : canAccept
      ? { bg: "#EEF2FF", border: "#C7D2FE", icon: "#4F46E5" as const, label: "Encore ouverte" }
      : alreadyRefused
        ? { bg: "#FEF2F2", border: "#FECACA", icon: "#DC2626" as const, label: "Refusée" }
        : { bg: "#F7F4EC", border: "#E6E3DA", icon: "#8A91A1" as const, label: "Clôturée" };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={88}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
      >
        {/* Bannière contextuelle */}
        <View
          className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: bannerTone.bg, borderWidth: 1, borderColor: bannerTone.border }}
        >
          <Ionicons name="information-circle" size={18} color={bannerTone.icon} />
          <Text className="flex-1 text-[13px] leading-5 text-ink">
            {alreadyAccepted ? (
              <>
                <Text className="font-semibold">Déjà acceptée</Text> — votre récompense est
                {r.relationStatus === "settled" ? (
                  " créditée."
                ) : (() => {
                  const avail = formatAvailableAt(r.availableAt);
                  return avail ? (
                    <>
                      {" en séquestre · "}
                      <Text className="font-semibold text-good">{avail}</Text>
                      {"."}
                    </>
                  ) : (
                    " en séquestre."
                  );
                })()}
              </>
            ) : canAccept ? (
              <>
                Cette campagne est <Text className="font-semibold">encore ouverte</Text> — vous pouvez l'accepter rétroactivement.
              </>
            ) : alreadyRefused ? (
              <>Vous avez <Text className="font-semibold">refusé</Text> cette demande.</>
            ) : (
              <>Cette campagne est <Text className="font-semibold">clôturée</Text> — l'acceptation n'est plus possible.</>
            )}
          </Text>
        </View>

        {/* En-tête : avatar pastel + raison sociale + secteur + chip palier */}
        <View className="flex-row items-start gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-violet-soft">
            <Text className="font-serif-bold text-base text-violet">
              {initials(r.pro)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-serif text-xl text-ink" numberOfLines={2}>
              {r.pro}
            </Text>
            {r.sector ? (
              <Text className="mt-0.5 text-[13px] text-ink-4" numberOfLines={1}>
                {r.sector}
              </Text>
            ) : null}
          </View>
          <View className="rounded-full bg-accent-soft px-3 py-1">
            <Text className="text-[11px] font-semibold text-accent-ink">
              {tierChipLabel(r)}
            </Text>
          </View>
        </View>

        {/* Brief campagne (le mot du pro) — encart accent doux, italique */}
        {r.brief ? (
          <View
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#F4F1FB", borderWidth: 1, borderColor: "#E4DEF5" }}
          >
            <Text
              className="font-mono text-[10px] uppercase text-violet"
              style={{ letterSpacing: 0.8 }}
            >
              Le mot du professionnel
            </Text>
            <Text className="mt-1.5 font-serif-italic text-[14px] leading-6 text-ink">
              « {r.brief} »
            </Text>
          </View>
        ) : null}

        {/* Motif */}
        {r.motif ? (
          <View>
            <Text
              className="font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8 }}
            >
              Objet de la demande
            </Text>
            <Text className="mt-1 text-[14px] leading-6 text-ink-2">
              {r.motif}
            </Text>
          </View>
        ) : null}

        {/* Dates : Lancement / Fin */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-line bg-ivory px-3.5 py-3">
            <LabelValue icon="calendar-outline" label="Lancement">
              <Text className="text-[13px] font-medium text-ink">
                {fmtLongDate(r.startDate)}
              </Text>
            </LabelValue>
          </View>
          <View className="flex-1 rounded-2xl border border-line bg-ivory px-3.5 py-3">
            <LabelValue icon="flag-outline" label="Fin">
              <Text className="text-[13px] font-medium text-ink">
                {fmtLongDate(r.endDate)}
              </Text>
            </LabelValue>
          </View>
        </View>

        {/* Récompense + délai */}
        <View className="flex-row items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3.5">
          <LabelValue label="Récompense">
            <Text className="font-serif text-2xl text-violet">
              {fmtEur(r.reward)}
            </Text>
          </LabelValue>
          <LabelValue
            icon="flash-outline"
            label={canAccept && !alreadyAccepted ? "Ouverte jusqu'au" : "Campagne"}
            align="right"
          >
            <Text className="font-mono text-[13px] font-medium text-ink">
              {canAccept && !alreadyAccepted
                ? fmtLongDate(r.endDate)
                : alreadyAccepted
                  ? "Acceptée"
                  : "Clôturée"}
            </Text>
          </LabelValue>
        </View>

        {/* Footer secondaire — signalement (parité web : action discrète
            placée au-dessus des actions principales). Bascule sur un
            chip « déjà transmis » après envoi. */}
        <View className="border-t border-line pt-3">
          {reportedLocal ? (
            <View className="flex-row items-center gap-1.5 self-start rounded-full bg-ivory-2 px-3 py-1">
              <Ionicons name="flag" size={11} color="#8A91A1" />
              <Text className="text-[11px] text-ink-4">
                Signalement déjà transmis
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setReportOpen(true)}
              className="flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="Signaler ce professionnel"
            >
              <Ionicons name="flag-outline" size={13} color="#DC2626" />
              <Text className="text-[12.5px] font-medium text-bad">
                Signaler ce professionnel
              </Text>
            </Pressable>
          )}
        </View>

        {/* Actions — mirror web (cf. RelationDetailModal action block) */}
        <View className="mt-1 flex-row gap-3">
          {canRefuse ? (
            <Pressable
              disabled={busy !== null}
              onPress={() => act("refuse")}
              className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-bad">
                {busy === "refuse" ? "…" : "Refuser"}
              </Text>
            </Pressable>
          ) : null}
          {!alreadyAccepted && canAccept ? (
            <Pressable
              disabled={busy !== null}
              onPress={() => act("accept")}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">
                {busy === "accept" ? "…" : "Accepter"}
              </Text>
            </Pressable>
          ) : null}
          {/* Fermer : seul bouton si aucune action métier possible */}
          {!canRefuse && (alreadyAccepted || !canAccept) ? (
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">Fermer</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <ReportProSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        relation={relation}
        onSubmitted={() => setReportedLocal(true)}
      />
    </BottomSheet>
  );
}
