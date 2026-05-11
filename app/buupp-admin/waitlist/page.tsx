import { createSupabaseAdminClient } from "@/lib/supabase/server";
import WaitlistLaunchButton from "../_components/WaitlistLaunchButton";

export const dynamic = "force-dynamic";

export default async function WaitlistAdminPage() {
  const admin = createSupabaseAdminClient();
  const { count: total } = await admin.from("waitlist").select("id", { count: "exact", head: true });
  const { count: notified } = await admin
    .from("waitlist").select("id", { count: "exact", head: true })
    .not("launch_email_sent_at", "is", null);
  const { data: topVilles } = await admin
    .from("waitlist").select("ville").not("ville", "is", null).limit(1000);
  const villeCounts: Record<string, number> = {};
  for (const r of topVilles ?? []) villeCounts[r.ville!] = (villeCounts[r.ville!] ?? 0) + 1;
  const top = Object.entries(villeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const { data: recent } = await admin
    .from("waitlist").select("prenom, email, ville, created_at, ref_code")
    .order("created_at", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Box label="Total inscrits" value={String(total ?? 0)} />
        <Box label="Mails de lancement envoyés" value={String(notified ?? 0)} />
        <Box label="Restant à notifier" value={String((total ?? 0) - (notified ?? 0))} />
      </div>
      <Section title="Top 10 villes">
        <ul className="text-sm">{top.map(([v, n]) => <li key={v} className="border-b border-neutral-100 py-1 flex justify-between"><span>{v}</span><span className="tabular-nums">{n}</span></li>)}</ul>
      </Section>
      <Section title="Lancement officiel">
        <WaitlistLaunchButton />
      </Section>
      <Section title="50 inscrits les plus récents">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500 uppercase"><tr><th>Quand</th><th>Email</th><th>Prénom</th><th>Ville</th><th>RefCode</th></tr></thead>
          <tbody>{(recent ?? []).map((r) => (<tr key={r.email + r.created_at}><td className="py-1 text-xs text-neutral-500">{new Date(r.created_at).toLocaleString("fr-FR")}</td><td>{r.email}</td><td>{r.prenom}</td><td>{r.ville}</td><td>{r.ref_code ?? "—"}</td></tr>))}</tbody>
        </table>
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
function Box({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded p-3"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div
        className="text-[11px] font-bold uppercase"
        style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div
        className="text-base font-semibold tabular-nums mt-0.5"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
