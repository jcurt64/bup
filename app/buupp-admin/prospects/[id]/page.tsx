import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProspectDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin
    .from("prospects")
    .select("*, prospect_identity(*), prospect_localisation(*), prospect_vie(*), prospect_pro(*), prospect_patrimoine(*)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const { data: relations } = await admin
    .from("relations")
    .select("id, status, sent_at, decided_at, settled_at, reward_cents, campaigns(name)")
    .eq("prospect_id", id)
    .order("sent_at", { ascending: false })
    .limit(50);

  const { data: tx } = await admin
    .from("transactions")
    .select("id, type, status, amount_cents, description, created_at")
    .eq("account_id", id)
    .eq("account_kind", "prospect")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fiche prospect</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(p, null, 2)}
      </pre>
      <h3 className="text-sm font-semibold">Relations (50 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(relations, null, 2)}
      </pre>
      <h3 className="text-sm font-semibold">Transactions (50 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(tx, null, 2)}
      </pre>
    </div>
  );
}
