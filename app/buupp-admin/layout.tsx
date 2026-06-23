/**
 * Layout du back-office BUUPP. Garde admin re-checkée côté RSC (le
 * middleware fait déjà la même chose — ceinture + bretelles, en cas de
 * config matcher cassée). Métadonnées `noindex, nofollow` pour éviter
 * toute indexation accidentelle.
 */
import type { Metadata } from "next";
import { requireAdminUserOrNotFound } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import AdminShell, { type NavCounts } from "./_components/AdminShell";

export const metadata: Metadata = {
  title: "BUUPP Admin",
  robots: { index: false, follow: false, nocache: true },
};

// Compteurs « pastilles » de la sidebar (cf. maquette da.png). Best-effort :
// 3 COUNT(*) en parallèle (head: true → pas de lignes ramenées). Une erreur
// individuelle retombe sur null → la pastille correspondante n'est pas
// rendue, sans casser le layout.
async function fetchNavCounts(): Promise<NavCounts> {
  const admin = createSupabaseAdminClient();
  const [waitlist, campaigns, signalements] = await Promise.all([
    admin.from("waitlist").select("id", { count: "exact", head: true }),
    admin.from("campaigns").select("id", { count: "exact", head: true }),
    admin
      .from("relation_reports")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
  ]);
  return {
    waitlist: waitlist.error ? null : waitlist.count ?? null,
    campaigns: campaigns.error ? null : campaigns.count ?? null,
    signalements: signalements.error ? null : signalements.count ?? null,
  };
}

export default async function BuuppAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, email } = await requireAdminUserOrNotFound();
  const navCounts = await fetchNavCounts();
  return (
    <AdminShell adminEmail={email} adminUserId={userId} navCounts={navCounts}>
      {children}
    </AdminShell>
  );
}
