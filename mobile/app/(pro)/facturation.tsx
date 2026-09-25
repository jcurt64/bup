// Facturation — crédit (/api/pro/wallet), abonnement (/api/pro/plan), carte
// enregistrée (/api/pro/wallet/payment-method + /api/stripe/setup), recharge
// automatique (/api/pro/wallet/auto-recharge) et factures (/api/pro/invoices,
// PDF unitaire /api/pro/invoices/:id/pdf, groupé /api/pro/invoices/download-all).
// Parité web : Pro.jsx fn Facturation + InvoiceFieldsModal (mentions légales
// obligatoires complétées avant chaque téléchargement).
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { InvoiceFieldsSheet } from "../../components/invoice-fields-sheet";
import { RechargeSheet } from "../../components/recharge-sheet";
import {
  Card,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
  Stat,
} from "../../components/screen";
import { ApiError } from "../../lib/api";
import { useProInvoices, useProPlan, useProWallet, type Invoice } from "../../lib/queries";
import {
  apiErrorMessage,
  AUTO_AMOUNT_MIN_EUR,
  AUTO_MAX_EUR,
  AUTO_THRESHOLD_MIN_EUR,
  checkoutSessionId,
  useAutoRecharge,
  usePatchAutoRecharge,
  useProPaymentMethod,
  useReconcileCardSetup,
  useStartCardSetup,
} from "../../lib/queries-pro-billing";
import { useTheme } from "../../lib/theme";
import { useAuthedDownload } from "../../lib/use-authed-download";
import { PURCHASES_ENABLED } from "../../lib/purchases";

function Eyebrow({ children }: { children: string }) {
  return (
    <Text className="font-mono text-[10px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
      {children}
    </Text>
  );
}

// — Abonnement actuel (parité web : label + campagnes utilisées/restantes).
// Le changement de formule se fait dans Mes informations (PlanSection).
function PlanCard() {
  const { c } = useTheme();
  const plan = useProPlan();
  const d = plan.data;
  const cycle = Number(d?.cycleCount);
  const cap = Number(d?.cap);
  const hasUsage = d && Number.isFinite(cycle) && Number.isFinite(cap);
  const left = hasUsage ? Math.max(0, cap - cycle) : 0;
  return (
    <Card>
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: c.tintAmber }}
        >
          <Ionicons name="ribbon-outline" size={22} color={c.accAmber} />
        </View>
        <View className="flex-1">
          <Eyebrow>Abonnement actuel</Eyebrow>
          <Text className="mt-1 font-serif text-[22px] text-ink">{d ? d.label : "…"}</Text>
          {hasUsage ? (
            <Text className="mt-1 text-[12px]">
              <Text style={{ color: c.accent, fontWeight: "600" }}>
                {cycle}/{cap} utilisées
              </Text>
              <Text className="text-ink-4"> · </Text>
              <Text style={{ color: c.good, fontWeight: "600" }}>
                {left} restante{left > 1 ? "s" : ""}
              </Text>
            </Text>
          ) : (
            <Text className="mt-1 text-[12px] text-ink-4">—</Text>
          )}
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/(pro)/informations")}
        accessibilityRole="button"
        className="mt-3 self-start rounded-full px-3 py-1.5 active:opacity-70"
        style={{ borderWidth: 1, borderColor: c.borderSoft }}
      >
        <Text className="text-[12px] font-semibold text-ink-2">Changer de formule</Text>
      </Pressable>
    </Card>
  );
}

// — Carte bancaire enregistrée + enregistrement via Stripe Checkout (setup).
function SavedCardCard() {
  const { c } = useTheme();
  const pm = useProPaymentMethod();
  const start = useStartCardSetup();
  const reconcile = useReconcileCardSetup();
  const [busy, setBusy] = useState(false);
  const card = pm.data?.card;

  async function setupCard() {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await start.mutateAsync();
      if (!url) throw new Error("URL Stripe manquante.");
      const sessionId = checkoutSessionId(url);
      await WebBrowser.openBrowserAsync(url);
      // Retour du navigateur : filet de sécurité si le webhook tarde
      // (no-op si la session n'est pas complétée).
      if (sessionId) {
        const r = await reconcile.mutateAsync({ sessionId }).catch(() => null);
        if (r?.ok) Alert.alert("Carte enregistrée", "Votre carte a bien été enregistrée.");
      }
      await pm.refetch();
    } catch (e) {
      Alert.alert(
        "Enregistrement impossible",
        apiErrorMessage(e, "Impossible d'ouvrir l'enregistrement de carte. Réessayez."),
      );
    } finally {
      setBusy(false);
    }
  }

  const brand = card?.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : "Carte";

  return (
    <Card>
      <Eyebrow>Carte enregistrée</Eyebrow>
      {pm.isPending ? (
        <ActivityIndicator className="mt-3" color={c.accent} />
      ) : card ? (
        <View className="mt-2 flex-row items-center" style={{ gap: 12 }}>
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: c.tintBlue }}
          >
            <Ionicons name="card" size={20} color={c.accBlue} />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-[22px] text-ink">
              {brand} ••{card.last4 ?? "????"}
            </Text>
            <Text className="text-[12px] text-ink-4">
              {card.expMonth && card.expYear
                ? `Expire ${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
                : "—"}
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={setupCard}
            accessibilityRole="button"
            className="rounded-full px-3 py-1.5 active:opacity-70"
            style={{ borderWidth: 1, borderColor: c.borderSoft }}
          >
            {busy ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text className="text-[12px] font-semibold text-ink-2">Remplacer</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View className="mt-2 items-center">
          <View
            className="mb-2 h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: c.tintViolet }}
          >
            <Ionicons name="card-outline" size={28} color={c.accViolet} />
          </View>
          <Text className="font-serif text-lg text-ink">Aucune carte enregistrée</Text>
          <Text className="mt-1 text-center text-[12px] leading-[17px] text-ink-4">
            Ajoutez votre carte pour recharger votre wallet et lancer vos campagnes.
          </Text>
          <Pressable
            disabled={busy}
            onPress={setupCard}
            accessibilityRole="button"
            className="mt-3 flex-row items-center gap-2 rounded-full px-4 py-2.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            {busy ? (
              <ActivityIndicator color={c.btnText} />
            ) : (
              <>
                <Ionicons name="lock-closed" size={14} color={c.btnText} />
                <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>
                  Enregistrer une carte
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </Card>
  );
}

// — Recharge automatique : état, seuil / montant, activation, désactivation.
function AutoRechargeCard({ onOpenRecharge }: { onOpenRecharge: () => void }) {
  const { c } = useTheme();
  const q = useAutoRecharge();
  const patch = usePatchAutoRecharge();
  const d = q.data;
  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [amount, setAmount] = useState("");

  const thresholdEur = d?.thresholdCents ? Math.round(d.thresholdCents / 100) : null;
  const amountEur = d?.amountCents ? Math.round(d.amountCents / 100) : null;

  function startEdit() {
    setThreshold(String(thresholdEur ?? 100));
    setAmount(String(amountEur ?? 200));
    setEditing(true);
  }

  async function run(body: Parameters<typeof patch.mutateAsync>[0], ok?: string) {
    try {
      await patch.mutateAsync(body);
      if (ok) Alert.alert("Recharge automatique", ok);
      return true;
    } catch (e) {
      Alert.alert("Action impossible", apiErrorMessage(e, "Réessayez dans un instant."));
      return false;
    }
  }

  async function saveEdit() {
    const t = parseInt(threshold, 10);
    const a = parseInt(amount, 10);
    if (Number.isNaN(t) || t < AUTO_THRESHOLD_MIN_EUR || t > AUTO_MAX_EUR) {
      Alert.alert("Seuil invalide", `Entre ${AUTO_THRESHOLD_MIN_EUR} € et ${AUTO_MAX_EUR.toLocaleString("fr-FR")} €.`);
      return;
    }
    if (Number.isNaN(a) || a < AUTO_AMOUNT_MIN_EUR || a > AUTO_MAX_EUR) {
      Alert.alert("Montant invalide", `Entre ${AUTO_AMOUNT_MIN_EUR} € et ${AUTO_MAX_EUR.toLocaleString("fr-FR")} €.`);
      return;
    }
    if (await run({ thresholdCents: t * 100, amountCents: a * 100 })) setEditing(false);
  }

  function enable() {
    if (!d?.hasPaymentMethod) {
      // Aucun moyen de paiement : on passe par une recharge manuelle avec la
      // case « Recharge automatique » cochée (sauvegarde de la carte).
      Alert.alert(
        "Moyen de paiement requis",
        "Pour activer la recharge automatique, effectuez une recharge en cochant « Recharge automatique » (ou enregistrez d'abord une carte).",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Recharger", onPress: onOpenRecharge },
        ],
      );
      return;
    }
    run({ enabled: true }, "Recharge automatique activée.");
  }

  function disable() {
    Alert.alert(
      "Désactiver la recharge automatique ?",
      "Votre crédit ne sera plus rechargé automatiquement sous le seuil.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Désactiver", style: "destructive", onPress: () => run({ enabled: false }) },
      ],
    );
  }

  const numInput = (value: string, onChange: (v: string) => void) => (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, 5))}
      keyboardType="number-pad"
      className="font-mono"
      style={{
        width: 90,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.field,
        color: c.text,
        fontSize: 14,
      }}
    />
  );

  return (
    <Card>
      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Ionicons name="repeat" size={18} color={c.accent} />
          <Text className="font-serif text-lg text-ink">Recharge automatique</Text>
        </View>
        {d ? (
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: d.enabled ? c.goodSoft : c.surface2 }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: d.enabled ? c.good : c.textMuted }}
            >
              {d.enabled ? "Active" : "Inactive"}
            </Text>
          </View>
        ) : null}
      </View>

      {q.isPending ? (
        <ActivityIndicator className="mt-3" color={c.accent} />
      ) : q.isError || !d ? (
        <Text className="mt-2 text-[12.5px] text-ink-4">État indisponible pour le moment.</Text>
      ) : (
        <>
          <Text className="mt-2 text-[12.5px] leading-[18px] text-ink-3">
            {d.enabled
              ? `Dès que votre solde passe sous ${thresholdEur ?? "—"} €, ${amountEur ?? "—"} € sont recrédités automatiquement sur votre carte enregistrée.`
              : "Rechargez automatiquement votre crédit dès qu'il passe sous un seuil, pour ne jamais interrompre vos campagnes."}
          </Text>

          {d.enabled && d.lastFailureReason ? (
            <View
              className="mt-2.5 rounded-lg px-2.5 py-2"
              style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" }}
            >
              <Text style={{ color: "#991B1B", fontSize: 11.5, lineHeight: 16 }}>
                <Text style={{ fontWeight: "700" }}>Dernière tentative en échec : </Text>
                {d.lastFailureReason}
                {d.lastFailedAt ? ` (${dateFr(d.lastFailedAt)})` : ""}. Pour réessayer, effectuez
                une recharge manuelle (votre nouveau moyen de paiement remplacera l&apos;ancien).
              </Text>
            </View>
          ) : null}
          {d.enabled && d.lastTriggeredAt ? (
            <Text className="mt-2 text-[11.5px] text-ink-4">
              Dernier déclenchement : {dateFr(d.lastTriggeredAt)}
            </Text>
          ) : null}

          {editing ? (
            <View className="mt-3 gap-2.5">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="w-24 text-[12.5px] text-ink-3">Seuil</Text>
                {numInput(threshold, setThreshold)}
                <Text className="text-[12px] text-ink-4">
                  € ({AUTO_THRESHOLD_MIN_EUR}–{AUTO_MAX_EUR.toLocaleString("fr-FR")})
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="w-24 text-[12.5px] text-ink-3">Montant</Text>
                {numInput(amount, setAmount)}
                <Text className="text-[12px] text-ink-4">
                  € ({AUTO_AMOUNT_MIN_EUR}–{AUTO_MAX_EUR.toLocaleString("fr-FR")})
                </Text>
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => setEditing(false)}
                  className="rounded-full px-3.5 py-2 active:opacity-70"
                  style={{ borderWidth: 1, borderColor: c.borderSoft }}
                >
                  <Text className="text-[12.5px] text-ink-3">Annuler</Text>
                </Pressable>
                <Pressable
                  disabled={patch.isPending}
                  onPress={saveEdit}
                  className="rounded-full px-3.5 py-2 active:opacity-80"
                  style={{ backgroundColor: c.btnBg }}
                >
                  <Text className="text-[12.5px] font-semibold" style={{ color: c.btnText }}>
                    {patch.isPending ? "Enregistrement…" : "Enregistrer"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              {d.enabled ? (
                <>
                  <Pressable
                    onPress={startEdit}
                    className="rounded-full px-3.5 py-2 active:opacity-70"
                    style={{ borderWidth: 1, borderColor: c.borderSoft }}
                  >
                    <Text className="text-[12.5px] font-semibold text-ink-2">
                      Modifier seuil / montant
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={patch.isPending}
                    onPress={disable}
                    className="rounded-full px-3.5 py-2 active:opacity-70"
                    style={{ borderWidth: 1, borderColor: c.borderSoft }}
                  >
                    <Text className="text-[12.5px]" style={{ color: c.bad }}>
                      Désactiver
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  disabled={patch.isPending}
                  onPress={enable}
                  className="rounded-full px-3.5 py-2 active:opacity-80"
                  style={{ backgroundColor: c.btnBg }}
                >
                  <Text className="text-[12.5px] font-semibold" style={{ color: c.btnText }}>
                    {patch.isPending ? "Activation…" : "Activer"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

const STATUS_TONE: Record<string, { icon: string; color: "good" | "warn" | "bad" | "muted" }> = {
  completed: { icon: "✓ ", color: "good" },
  pending: { icon: "◷ ", color: "warn" },
  failed: { icon: "✗ ", color: "bad" },
  canceled: { icon: "— ", color: "muted" },
};

export default function Facturation() {
  const { c } = useTheme();
  const w = useProWallet();
  const inv = useProInvoices();
  const plan = useProPlan();
  const pm = useProPaymentMethod();
  const auto = useAutoRecharge();
  const download = useAuthedDownload();
  // Facture ciblée par la feuille des mentions légales (null = fermée) ;
  // "all" = téléchargement groupé.
  const [prompt, setPrompt] = useState<Invoice | "all" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const invoices = inv.data?.invoices ?? [];

  async function runDownload(target: Invoice | "all") {
    setDownloading(true);
    try {
      if (target === "all") {
        await download("/api/pro/invoices/download-all", "factures-buupp.pdf");
      } else {
        await download(
          `/api/pro/invoices/${encodeURIComponent(target.transactionId)}/pdf`,
          `facture-${target.number}.pdf`,
        );
      }
    } catch (e) {
      Alert.alert(
        "Téléchargement impossible",
        e instanceof ApiError && e.status === 404
          ? "Facture introuvable."
          : e instanceof Error && e.message && !(e instanceof ApiError)
            ? e.message
            : "Réessayez dans un instant.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const tone = (s?: string) => {
    const t = STATUS_TONE[s ?? ""];
    const color =
      t?.color === "good" ? c.good : t?.color === "warn" ? c.warn : t?.color === "bad" ? c.bad : c.textMuted;
    return { icon: t?.icon ?? "", color };
  };

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{ nav: "drawer", eyebrow: "Facturation", title: "Paiements & factures" }}
      onRefresh={async () => {
        await Promise.all([w.refetch(), inv.refetch(), plan.refetch(), pm.refetch(), auto.refetch()]);
      }}
    >
      <QueryGate query={w}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-white/60">
                Crédit disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-paper">
                {eur(d.walletAvailableEur)}
              </Text>
            </Card>
            <View className="flex-row gap-3">
              <Stat label="Solde total" value={eur(d.walletBalanceEur)} />
              <Stat
                label="Réservé"
                value={eur(d.walletReservedEur)}
                hint="campagnes actives"
              />
            </View>
          </>
        )}
      </QueryGate>

      <PlanCard />
      {/* Achats masqués sur iOS (App Store 3.1.1 / 3.1.3(g)) — lib/purchases. */}
      {PURCHASES_ENABLED ? (
        <>
          <SavedCardCard />
          <AutoRechargeCard onOpenRecharge={() => setShowRecharge(true)} />
        </>
      ) : null}

      <View className="mt-2 flex-row items-center justify-between">
        <Text
          className="text-[11px] font-bold uppercase text-ink-4"
          style={{ letterSpacing: 1.2 }}
        >
          Historique des factures
        </Text>
        <Pressable
          disabled={invoices.length === 0 || downloading}
          onPress={() => setPrompt("all")}
          accessibilityRole="button"
          accessibilityLabel="Télécharger toutes les factures (un seul PDF)"
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
          style={{
            borderWidth: 1,
            borderColor: c.borderSoft,
            backgroundColor: c.surface,
            opacity: invoices.length === 0 ? 0.5 : 1,
          }}
        >
          <Ionicons name="download-outline" size={13} color={c.text} />
          <Text className="text-[12px] font-semibold text-ink-2">Tout télécharger</Text>
        </Pressable>
      </View>
      <QueryGate
        query={inv}
        isEmpty={(d) => (d.invoices?.length ?? 0) === 0}
        emptyLabel="Aucune facture pour le moment. Effectuez une recharge pour générer votre première facture."
      >
        {(d) => (
          <View className="gap-2">
            {d.invoices.map((f) => {
              const t = tone(f.status);
              return (
                <View
                  key={f.transactionId ?? f.number}
                  className="flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3"
                  style={{ gap: 8 }}
                >
                  <View className="flex-1 pr-1">
                    <Text className="text-sm text-ink">{f.label}</Text>
                    <Text className="font-mono text-[10px] text-ink-4">
                      {f.number} · {dateFr(f.date)}
                    </Text>
                    <Text className="mt-0.5 text-[11px] font-semibold" style={{ color: t.color }}>
                      {t.icon}
                      {f.statusLabel}
                    </Text>
                  </View>
                  <View className="items-end" style={{ gap: 6 }}>
                    <Text className="font-mono text-sm text-ink-2">{eur(f.amountEur)}</Text>
                    <Pressable
                      disabled={downloading || !f.transactionId}
                      onPress={() => setPrompt(f)}
                      accessibilityRole="button"
                      accessibilityLabel={`Télécharger la facture ${f.number} (PDF)`}
                      className="flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-70"
                      style={{ borderWidth: 1, borderColor: c.borderSoft }}
                    >
                      <Ionicons name="download-outline" size={12} color={c.text} />
                      <Text className="text-[11px] font-semibold text-ink-2">PDF</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </QueryGate>

      {downloading ? (
        <View className="flex-row items-center justify-center gap-2">
          <ActivityIndicator color={c.accent} />
          <Text className="text-[12px] text-ink-4">Génération du PDF…</Text>
        </View>
      ) : null}

      {prompt ? (
        <InvoiceFieldsSheet
          bulk={prompt === "all"}
          invoiceCount={invoices.length}
          invoiceNumber={prompt === "all" ? undefined : prompt.number}
          onClose={() => setPrompt(null)}
          onConfirmed={async () => {
            const target = prompt;
            setPrompt(null);
            // Laisse la feuille (Modal) se fermer avant d'ouvrir la feuille de
            // partage iOS (sinon « present while dismissing » peut l'ignorer).
            await new Promise((r) => setTimeout(r, 400));
            await runDownload(target);
          }}
        />
      ) : null}
      <RechargeSheet visible={showRecharge} onClose={() => setShowRecharge(false)} />
    </ScrollScreen>
  );
}
