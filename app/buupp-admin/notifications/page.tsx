import { createSupabaseAdminClient } from "@/lib/supabase/server";
import BroadcastComposer from "./_components/BroadcastComposer";

export const dynamic = "force-dynamic";

const AUDIENCE_LABEL: Record<"prospects" | "pros" | "all", string> = {
  prospects: "Tous les prospects",
  pros: "Tous les pros",
  all: "Tous les utilisateurs",
};

export default async function NotificationsAdminPage() {
  const admin = createSupabaseAdminClient();
  const { data: broadcasts } = await admin
    .from("admin_broadcasts")
    .select(
      "id, title, audience, attachment_filename, created_at, sent_email_at, total_recipients",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  // Stats per-broadcast (taux d'ouverture pixel + lectures in-app). Deux
  // requêtes parallèles, regroupage en mémoire pour ne pas multiplier les
  // round-trips sur l'historique 50 lignes.
  const list = broadcasts ?? [];
  const ids = list.map((b) => b.id);
  const openCounts = new Map<string, number>();
  const readCounts = new Map<string, number>();
  if (ids.length > 0) {
    const [openRes, readRes] = await Promise.all([
      admin
        .from("admin_broadcast_recipients")
        .select("broadcast_id")
        .in("broadcast_id", ids)
        .not("opened_at", "is", null),
      admin
        .from("admin_broadcast_reads")
        .select("broadcast_id")
        .in("broadcast_id", ids),
    ]);
    for (const r of openRes.data ?? []) {
      openCounts.set(r.broadcast_id, (openCounts.get(r.broadcast_id) ?? 0) + 1);
    }
    for (const r of readRes.data ?? []) {
      readCounts.set(r.broadcast_id, (readCounts.get(r.broadcast_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Nouveau message">
        <BroadcastComposer />
      </Section>
      <Section title="Historique des messages">
        {list.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Aucun message envoyé pour l'instant.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm border-collapse min-w-205">
                <thead>
                  <tr style={{ background: "var(--ivory-2)" }}>
                    {[
                      "Quand",
                      "Titre",
                      "Audience",
                      "Pièce jointe",
                      "Envoyé",
                      "Ouverts email",
                      "Lus in-app",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-[11px] font-bold uppercase px-3 py-2 text-left"
                        style={{
                          color: "var(--accent-ink)",
                          fontFamily: "var(--mono)",
                          letterSpacing: "0.06em",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((b, i) => {
                    const total = b.total_recipients ?? 0;
                    const opens = openCounts.get(b.id) ?? 0;
                    const reads = readCounts.get(b.id) ?? 0;
                    return (
                      <tr
                        key={b.id}
                        style={{
                          background: i % 2 === 1 ? "var(--ivory)" : "transparent",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        <td
                          className="px-3 py-2 text-xs whitespace-nowrap"
                          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
                        >
                          {new Date(b.created_at).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2" style={{ color: "var(--ink-2)" }}>
                          {b.title}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-3)" }}>
                          {AUDIENCE_LABEL[b.audience]}
                        </td>
                        <td
                          className="px-3 py-2 text-xs"
                          style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}
                        >
                          {b.attachment_filename ?? "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-xs"
                          style={{ color: b.sent_email_at ? "var(--ink-3)" : "var(--ink-4)" }}
                        >
                          {b.sent_email_at ? "Envoyé" : "En cours…"}
                        </td>
                        <RateCell count={opens} total={total} />
                        <RateCell count={reads} total={total} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: "var(--ink-4)" }}
            >
              <strong>Ouverts email</strong> = mesure via pixel transparent
              (RGPD/CNIL — voir{" "}
              <a href="/cookies" className="underline" style={{ color: "var(--ink-3)" }}>
                politique cookies
              </a>
              ). Métrique approximative : Apple Mail Privacy Protection
              pré-charge toutes les images → surévaluation pour les utilisateurs
              Apple ; Gmail/Outlook bloquent par défaut → sous-évaluation.
              Utile en relatif entre broadcasts.
              <br />
              <strong>Lus in-app</strong> = clic sur la notification depuis la
              cloche ou l'onglet « Mes messages » du dashboard. Plus précis,
              mais ne compte pas les lectures faites directement dans l'email.
            </p>
          </>
        )}
      </Section>
    </div>
  );
}

function RateCell({ count, total }: { count: number; total: number }) {
  const rate = total > 0 ? Math.round((count * 100) / total) : null;
  return (
    <td
      className="px-3 py-2 text-xs whitespace-nowrap"
      style={{ color: "var(--ink-2)", fontFamily: "var(--mono)" }}
    >
      {total === 0 ? (
        <span style={{ color: "var(--ink-4)" }}>—</span>
      ) : (
        <>
          <span className="tabular-nums">{count}</span>
          <span style={{ color: "var(--ink-4)" }}> / {total}</span>
          {rate !== null && (
            <span style={{ marginLeft: 6, color: "var(--accent-ink)", fontWeight: 600 }}>
              {rate}%
            </span>
          )}
        </>
      )}
    </td>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2
        className="text-[12px] font-bold uppercase"
        style={{ color: "var(--accent-ink)", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}
      >
        {title}
      </h2>
      <div
        className="rounded-lg p-4"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderLeft: "3px solid var(--accent)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
