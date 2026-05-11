// app/buupp-admin/campagnes/[id]/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CampaignDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("*, pro_accounts(raison_sociale, secteur)")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();
  const { data: relations } = await admin
    .from("relations")
    .select("id, status, sent_at, decided_at, settled_at, reward_cents, prospects(prospect_identity(prenom, email))")
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-6">
      <h2 className="text-base font-medium">Fiche campagne</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(campaign, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Relations (100 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(relations, null, 2)}</pre>
    </div>
  );
}
