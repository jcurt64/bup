/**
 * Queries pour /buupp-admin/contact-clicks — clics du pro sur les icônes de
 * contact d'un prospect (table `pro_contact_clicks`).
 *
 * Chaque ligne = un clic sur l'une des icônes : téléphone, e-mail, SMS,
 * WhatsApp.
 *
 * Détection « accès répétés » : couples (pro × prospect) ayant cliqué
 * ≥ REPEAT_THRESHOLD fois en 24 h, tous canaux confondus — aligné sur le
 * seuil qui déclenche le mail de rappel au pro (lib/pro/contact-click-alert.ts).
 *
 * Lecture service_role.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { REPEAT_THRESHOLD } from "@/lib/pro/contact-click-alert";

export type ContactChannel = "call" | "email" | "sms" | "whatsapp";

export type ContactClickItem = {
  id: string;
  channel: string;
  createdAt: string;
  pro: { id: string; raisonSociale: string } | null;
  prospect: { id: string; prenom: string | null; nomInitial: string | null } | null;
  campaign: { id: string; name: string } | null;
};

export type ContactClicksKpis = {
  totalClicks: number;
  /** Couples (pro, prospect) avec ≥ REPEAT_THRESHOLD clics / 24 h. */
  repeatedPairs: number;
  repeatThreshold: number;
};

export type ContactClicksFilters = {
  channel: "all" | ContactChannel;
  period: "24h" | "7d" | "30d" | "90d" | "all";
  page: number;
};

const PAGE_SIZE = 50;

function periodCutoffIso(period: ContactClicksFilters["period"]): string | null {
  if (period === "all") return null;
  const hours = period === "24h" ? 24 : 0;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  const ms = hours * 3_600_000 + days * 86_400_000;
  return ms > 0 ? new Date(Date.now() - ms).toISOString() : null;
}

export async function fetchContactClicksList(
  opts: ContactClicksFilters,
): Promise<ContactClickItem[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("pro_contact_clicks")
    .select(
      `id, channel, created_at,
       pro_accounts ( id, raison_sociale ),
       prospects ( id, prospect_identity ( prenom, nom ) ),
       campaigns ( id, name )`,
    )
    .order("created_at", { ascending: false });

  if (opts.channel !== "all") {
    q = q.eq("channel", opts.channel);
  }
  const cutoff = periodCutoffIso(opts.period);
  if (cutoff) {
    q = q.gte("created_at", cutoff);
  }
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await q.range(from, to);
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    const proRow = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    const prospectRow = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const campRow = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const idRaw = prospectRow?.prospect_identity;
    const ident = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const nom = ident?.nom ?? null;
    return {
      id: r.id,
      channel: r.channel,
      createdAt: r.created_at,
      pro: proRow ? { id: proRow.id, raisonSociale: proRow.raison_sociale ?? "—" } : null,
      prospect: prospectRow
        ? {
            id: prospectRow.id,
            prenom: ident?.prenom ?? null,
            nomInitial:
              typeof nom === "string" && nom.length > 0
                ? nom[0].toUpperCase() + "."
                : null,
          }
        : null,
      campaign: campRow ? { id: campRow.id, name: campRow.name ?? "—" } : null,
    };
  });
}

export async function fetchContactClicksKpis(
  opts: Pick<ContactClicksFilters, "period">,
): Promise<ContactClicksKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);

  const base = () =>
    admin.from("pro_contact_clicks").select("id", { count: "exact", head: true });
  const withPeriod = <T extends { gte: (c: string, v: string) => T }>(q: T): T =>
    cutoff ? q.gte("created_at", cutoff) : q;

  const [totalRes, repeatedRes] = await Promise.all([
    withPeriod(base()),
    // Accès répétés : clics des 24 h groupés par (pro, prospect), on compte
    // les couples qui franchissent le seuil.
    (async () => {
      const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data } = await admin
        .from("pro_contact_clicks")
        .select("pro_account_id, prospect_id")
        .gte("created_at", since24h);
      const cnt = new Map<string, number>();
      for (const r of (data ?? []) as Array<{
        pro_account_id: string;
        prospect_id: string;
      }>) {
        const key = `${r.pro_account_id}::${r.prospect_id}`;
        cnt.set(key, (cnt.get(key) ?? 0) + 1);
      }
      let pairs = 0;
      for (const c of cnt.values()) if (c >= REPEAT_THRESHOLD) pairs++;
      return pairs;
    })(),
  ]);

  return {
    totalClicks: totalRes.count ?? 0,
    repeatedPairs: repeatedRes,
    repeatThreshold: REPEAT_THRESHOLD,
  };
}
