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
    .select("id, title, audience, attachment_filename, created_at, sent_email_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <Section title="Nouveau message">
        <BroadcastComposer />
      </Section>
      <Section title="Historique des messages">
        {!broadcasts || broadcasts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Aucun message envoyé pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr style={{ background: "var(--ivory-2)" }}>
                  {["Quand", "Titre", "Audience", "Pièce jointe", "Email"].map((h) => (
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
                {broadcasts.map((b, i) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
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
