/**
 * Queries pour /buupp-admin/pro-reveals — historique des consultations de
 * données prospect par les pros (table `pro_contact_reveals`).
 *
 * Chaque ligne = une révélation : ouverture du détail complet
 * (field='details') ou révélation d'un champ isolé (email/telephone/name).
 *
 * Détection « accès répétés » : couples (pro × prospect) ayant ouvert le
 * DÉTAIL ≥ REPEAT_THRESHOLD fois en 24 h — aligné sur le seuil qui
 * déclenche le mail de transparence au prospect (lib/pro/reveal-alert.ts).
 *
 * Lecture service_role (cross-prospect, ce que la RLS bloquerait).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { REPEAT_THRESHOLD } from "@/lib/pro/reveal-alert";

export type ProRevealField = "details" | "email" | "telephone" | "name";

export type ProRevealItem = {
  id: string;
  field: string;
  revealedAt: string;
  pro: { id: string; raisonSociale: string } | null;
  prospect: { id: string; prenom: string | null; nomInitial: string | null } | null;
  campaign: { id: string; name: string } | null;
};

export type ProRevealsKpis = {
  totalReveals: number;
  totalDetails: number;
  /** Couples (pro, prospect) avec ≥ REPEAT_THRESHOLD ouvertures détail / 24 h. */
  repeatedPairs: number;
  repeatThreshold: number;
};

export type ProRevealsFilters = {
  field: "all" | ProRevealField;
  period: "24h" | "7d" | "30d" | "90d" | "all";
  page: number;
};

const PAGE_SIZE = 50;

function periodCutoffIso(period: ProRevealsFilters["period"]): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  const hours = period === "24h" ? 24 : 0;
  const ms = hours * 3_600_000 + days * 86_400_000;
  return ms > 0 ? new Date(Date.now() - ms).toISOString() : null;
}

export async function fetchProRevealsList(
  opts: ProRevealsFilters,
): Promise<ProRevealItem[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("pro_contact_reveals")
    .select(
      `id, field, revealed_at,
       pro_accounts ( id, raison_sociale ),
       relations ( id, prospects ( id, prospect_identity ( prenom, nom ) ), campaigns ( id, name ) )`,
    )
    .order("revealed_at", { ascending: false });

  if (opts.field !== "all") {
    q = q.eq("field", opts.field);
  }
  const cutoff = periodCutoffIso(opts.period);
  if (cutoff) {
    q = q.gte("revealed_at", cutoff);
  }
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await q.range(from, to);
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    const rel = Array.isArray(r.relations) ? r.relations[0] : r.relations;
    const prospectRow = rel
      ? Array.isArray(rel.prospects)
        ? rel.prospects[0]
        : rel.prospects
      : null;
    const campRow = rel
      ? Array.isArray(rel.campaigns)
        ? rel.campaigns[0]
        : rel.campaigns
      : null;
    const idRaw = prospectRow?.prospect_identity;
    const ident = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const nom = ident?.nom ?? null;
    const proRow = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    return {
      id: r.id,
      field: r.field,
      revealedAt: r.revealed_at,
      pro: proRow
        ? { id: proRow.id, raisonSociale: proRow.raison_sociale ?? "—" }
        : null,
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

export async function fetchProRevealsKpis(
  opts: Pick<ProRevealsFilters, "period">,
): Promise<ProRevealsKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);

  const base = () =>
    admin.from("pro_contact_reveals").select("id", { count: "exact", head: true });
  const withPeriod = <T extends { gte: (c: string, v: string) => T }>(q: T): T =>
    cutoff ? q.gte("revealed_at", cutoff) : q;

  const [totalRes, detailsRes, repeatedRes] = await Promise.all([
    withPeriod(base()),
    withPeriod(base().eq("field", "details")),
    // Accès répétés : on lit les ouvertures de détail des dernières 24 h
    // avec le prospect_id de la relation, puis on compte côté Node les
    // couples (pro, prospect) qui franchissent le seuil.
    (async () => {
      const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data } = await admin
        .from("pro_contact_reveals")
        .select("pro_account_id, relations ( prospect_id )")
        .eq("field", "details")
        .gte("revealed_at", since24h);
      const cnt = new Map<string, number>();
      for (const r of (data ?? []) as Array<{
        pro_account_id: string;
        relations: { prospect_id: string } | { prospect_id: string }[] | null;
      }>) {
        const rel = Array.isArray(r.relations) ? r.relations[0] : r.relations;
        const prospectId = rel?.prospect_id;
        if (!prospectId) continue;
        const key = `${r.pro_account_id}::${prospectId}`;
        cnt.set(key, (cnt.get(key) ?? 0) + 1);
      }
      let pairs = 0;
      for (const c of cnt.values()) if (c >= REPEAT_THRESHOLD) pairs++;
      return pairs;
    })(),
  ]);

  return {
    totalReveals: totalRes.count ?? 0,
    totalDetails: detailsRes.count ?? 0,
    repeatedPairs: repeatedRes,
    repeatThreshold: REPEAT_THRESHOLD,
  };
}
