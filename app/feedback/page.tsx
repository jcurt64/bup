/**
 * Atterrissage du clic sur l'un des 3 boutons feedback du mail
 * "Sollicitation refusée" :
 *   /feedback?relationId=<uuid>&reason=<entreprise-douteuse|faible-remuneration|pas-interesse>
 *
 * Insère la raison dans `relation_feedback` (idempotent : on déduplique
 * par couple relation_id + reason avant insert) puis affiche une carte
 * "Merci pour votre avis" type popup.
 *
 * Aucune auth nécessaire — le lien email est l'authentification implicite.
 * Pour limiter l'abus, on valide simplement que la relation existe.
 */

import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REASON_LABELS: Record<string, string> = {
  "entreprise-douteuse": "Entreprise douteuse",
  "faible-remuneration": "Faible rémunération",
  "pas-interesse": "Pas intéressé",
};

type SearchParams = Promise<{
  relationId?: string;
  reason?: string;
}>;

async function recordFeedback(
  relationId: string,
  reason: string,
): Promise<{ ok: boolean; alreadyRecorded: boolean; reason: string }> {
  const admin = createSupabaseAdminClient();
  // Vérifie que la relation existe (sans exposer plus que nécessaire).
  const { data: rel, error: relErr } = await admin
    .from("relations")
    .select("id")
    .eq("id", relationId)
    .maybeSingle();
  if (relErr || !rel) {
    return { ok: false, alreadyRecorded: false, reason };
  }
  // Idempotence : si la même raison a déjà été enregistrée pour cette
  // relation, on ne réinsère pas (cas d'un double-clic email).
  const { data: existing } = await admin
    .from("relation_feedback")
    .select("id")
    .eq("relation_id", relationId)
    .eq("reason", reason)
    .maybeSingle();
  if (existing) {
    return { ok: true, alreadyRecorded: true, reason };
  }
  const { error: insErr } = await admin
    .from("relation_feedback")
    .insert({ relation_id: relationId, reason });
  if (insErr) {
    console.error("[/feedback] insert failed", insErr);
    return { ok: false, alreadyRecorded: false, reason };
  }
  return { ok: true, alreadyRecorded: false, reason };
}

export default async function FeedbackPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const relationId = (sp.relationId ?? "").trim();
  const reason = (sp.reason ?? "").trim();

  let status: "ok" | "invalid" | "unknown_reason" = "ok";
  let recorded: { alreadyRecorded: boolean } | null = null;

  if (!relationId || !reason) {
    status = "invalid";
  } else if (!REASON_LABELS[reason]) {
    status = "unknown_reason";
  } else {
    const r = await recordFeedback(relationId, reason);
    if (!r.ok) status = "invalid";
    else recorded = { alreadyRecorded: r.alreadyRecorded };
  }

  const reasonLabel = REASON_LABELS[reason] ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F7F4EC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        color: "#0F1629",
      }}
    >
      <div
        style={{
          background: "#FFFEF8",
          border: "1px solid #EAE3D0",
          borderRadius: 18,
          padding: "36px 32px 32px",
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 30px 80px -20px rgba(15,22,41,.18)",
          textAlign: "center",
        }}
      >
        {status === "ok" ? (
          <>
            <div
              aria-hidden
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#22C55E",
                color: "#FFFEF8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 26,
                fontWeight: 500,
                margin: "0 0 12px",
                lineHeight: 1.2,
              }}
            >
              Merci pour votre avis
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "#3A4150",
                margin: "0 0 12px",
              }}
            >
              Cela nous aidera à améliorer nos services.
            </p>
            {reasonLabel && (
              <p
                style={{
                  fontSize: 12.5,
                  color: "#6B7180",
                  margin: "0 0 22px",
                  letterSpacing: ".02em",
                }}
              >
                Raison enregistrée :{" "}
                <strong style={{ color: "#0F1629" }}>{reasonLabel}</strong>
                {recorded?.alreadyRecorded ? " (déjà reçue)" : ""}
              </p>
            )}
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "11px 22px",
                background: "#0F1629",
                color: "#FFFEF8",
                textDecoration: "none",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Retour à l’accueil
            </Link>
          </>
        ) : (
          <>
            <div
              aria-hidden
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#FEE2E2",
                color: "#B91C1C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              !
            </div>
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 24,
                fontWeight: 500,
                margin: "0 0 12px",
              }}
            >
              Lien invalide
            </h1>
            <p style={{ fontSize: 14, color: "#3A4150", margin: "0 0 22px" }}>
              Le lien que vous venez de cliquer n’est plus valide. Vous pouvez
              tout de même retourner sur votre espace BUUPP.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "11px 22px",
                background: "#0F1629",
                color: "#FFFEF8",
                textDecoration: "none",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Retour à l’accueil
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
