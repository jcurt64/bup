/**
 * /buupp-admin/tests-etudes — campagnes Tests & Études, signalements,
 * contestations et participations conservées après suspension.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { REJECT_REASONS, REPORT_REASONS, STUDY_TYPE_LABELS, type RejectReason, type ReportReason, type StudyType } from "@/lib/studies/constants";
import StudyAdminButton from "./_components/StudyAdminButton";
import { countJoined } from "@/lib/studies/repo";

export const dynamic = "force-dynamic";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const date = (s: string | null) => (s ? new Date(s).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "—");

export default async function TestsEtudesAdminPage() {
  const admin = createSupabaseAdminClient();
  const [{ data: camps }, { data: reports }, { data: disputes }, { data: flag }] = await Promise.all([
    admin.from("study_campaigns").select("id, title, type, status, pro_account_id, reward_cents, min_participants, max_participants, signup_deadline, budget_reserved_cents, cancel_reason, created_at")
      .order("created_at", { ascending: false }).limit(100),
    admin.from("study_reports").select("id, campaign_id, reason, note, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("study_participations").select("id, campaign_id, status, code, done_comment, reject_reason, reject_note, dispute_note, disputed_at")
      .in("status", ["disputed"]).order("disputed_at", { ascending: true }).limit(200),
    admin.from("app_config").select("studies_enabled").maybeSingle(),
  ]);
  const ids = (camps ?? []).map((c) => c.id);
  const joined = await countJoined(admin, ids);
  const reportCount = new Map<string, number>();
  for (const r of reports ?? []) reportCount.set(r.campaign_id, (reportCount.get(r.campaign_id) ?? 0) + 1);
  // Participations conservées après suspension (travail déclaré fait) → à arbitrer.
  const suspendedIds = (camps ?? []).filter((c) => c.status === "canceled" && c.cancel_reason === "admin_suspended").map((c) => c.id);
  const { data: kept } = suspendedIds.length
    ? await admin.from("study_participations").select("id, campaign_id, status, code, done_comment").in("campaign_id", suspendedIds).in("status", ["done", "rejected"])
    : { data: [] };
  const { data: pros } = camps?.length
    ? await admin.from("pro_accounts").select("id, raison_sociale").in("id", [...new Set(camps.map((c) => c.pro_account_id))])
    : { data: [] };
  const proName = new Map((pros ?? []).map((p) => [p.id, p.raison_sociale ?? "—"]));
  const title = new Map((camps ?? []).map((c) => [c.id, c.title]));

  const card = "rounded-xl p-5 mb-6";
  const cardStyle = { background: "var(--paper)", border: "1px solid var(--line)" };
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-1">Tests &amp; Études</h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-4)" }}>
        Module {flag?.studies_enabled ? "ACTIVÉ" : "désactivé"} (app_config.studies_enabled).
      </p>

      <section className={card} style={cardStyle}>
        <h2 className="font-semibold mb-3">Contestations à trancher ({disputes?.length ?? 0})</h2>
        {(disputes ?? []).length === 0 ? <p className="text-sm">Aucune.</p> : (disputes ?? []).map((d) => (
          <div key={d.id} className="py-3 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <div><strong>{title.get(d.campaign_id) ?? d.campaign_id}</strong> · code <code>{d.code ?? "—"}</code> · contesté le {date(d.disputed_at)}</div>
            <div>Refus : {REJECT_REASONS[d.reject_reason as RejectReason] ?? d.reject_reason}{d.reject_note ? ` — ${d.reject_note}` : ""}</div>
            <div>Commentaire « terminé » : {d.done_comment ?? "—"}</div>
            <div>Contestation : {d.dispute_note}</div>
            <div className="mt-2 flex gap-2">
              <StudyAdminButton url={`/api/admin/studies/participations/${d.id}/resolve`} body={{ decision: "approve" }} label="Valider (payer)" confirmText="Confirmer le paiement" tone="good" />
              <StudyAdminButton url={`/api/admin/studies/participations/${d.id}/resolve`} body={{ decision: "reject_final" }} label="Confirmer le refus" confirmText="Confirmer" tone="danger" />
            </div>
          </div>
        ))}
      </section>

      {(kept ?? []).length > 0 && (
        <section className={card} style={cardStyle}>
          <h2 className="font-semibold mb-3">Participations à arbitrer (campagnes suspendues)</h2>
          {(kept ?? []).map((k) => (
            <div key={k.id} className="py-3 text-sm flex flex-wrap gap-3 items-center" style={{ borderTop: "1px solid var(--line)" }}>
              <span><strong>{title.get(k.campaign_id)}</strong> · {k.status} · code <code>{k.code ?? "—"}</code> · {k.done_comment ?? ""}</span>
              <StudyAdminButton url={`/api/admin/studies/participations/${k.id}/resolve`} body={{ decision: "approve" }} label="Payer" confirmText="Confirmer" tone="good" />
              <StudyAdminButton url={`/api/admin/studies/participations/${k.id}/resolve`} body={{ decision: "reject_final" }} label="Refuser" confirmText="Confirmer" tone="danger" />
            </div>
          ))}
        </section>
      )}

      <section className={card} style={cardStyle}>
        <h2 className="font-semibold mb-3">Signalements ({reports?.length ?? 0})</h2>
        {(reports ?? []).length === 0 ? <p className="text-sm">Aucun.</p> : (reports ?? []).map((r) => (
          <div key={r.id} className="py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <strong>{title.get(r.campaign_id) ?? r.campaign_id}</strong> · {REPORT_REASONS[r.reason as ReportReason] ?? r.reason} · {date(r.created_at)}
            {r.note ? <div style={{ color: "var(--ink-3)" }}>{r.note}</div> : null}
          </div>
        ))}
      </section>

      <section className={card} style={cardStyle}>
        <h2 className="font-semibold mb-3">Campagnes ({camps?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ color: "var(--ink-4)" }}>
              <th className="p-2">Campagne</th><th className="p-2">Pro</th><th className="p-2">Statut</th><th className="p-2">Inscrits</th>
              <th className="p-2">Rémunération</th><th className="p-2">Réservé</th><th className="p-2">Signal.</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {(camps ?? []).map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="p-2"><a href={`/tests-etudes/${c.id}`} target="_blank" rel="noreferrer" className="underline">{c.title}</a><div style={{ color: "var(--ink-4)" }}>{STUDY_TYPE_LABELS[c.type as StudyType]}</div></td>
                  <td className="p-2">{proName.get(c.pro_account_id)}</td>
                  <td className="p-2">{c.status}{c.cancel_reason ? ` (${c.cancel_reason})` : ""}</td>
                  <td className="p-2">{joined.get(c.id) ?? 0} / {c.min_participants}–{c.max_participants}</td>
                  <td className="p-2">{eur(Number(c.reward_cents))}</td>
                  <td className="p-2">{eur(Number(c.budget_reserved_cents))}</td>
                  <td className="p-2">{reportCount.get(c.id) ?? 0}</td>
                  <td className="p-2">
                    {(c.status === "published" || c.status === "validated") && (
                      <StudyAdminButton url={`/api/admin/studies/${c.id}/suspend`} label="Suspendre" confirmText="Confirmer la suspension" tone="danger" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
