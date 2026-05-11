// app/buupp-admin/pros/[id]/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin.from("pro_accounts").select("*").eq("id", id).maybeSingle();
  if (!pro) notFound();
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, name, status, type, budget_cents, spent_cents, created_at")
    .eq("pro_account_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: tx } = await admin
    .from("transactions")
    .select("id, type, status, amount_cents, description, created_at")
    .eq("account_id", id)
    .eq("account_kind", "pro")
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <div className="space-y-6">
      <h2 className="text-base font-medium">Fiche pro</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(pro, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Campagnes</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(campaigns, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Transactions</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(tx, null, 2)}</pre>
    </div>
  );
}
