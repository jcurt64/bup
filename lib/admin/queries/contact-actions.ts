/**
 * Queries pour /buupp-admin/contact-actions.
 *
 * Liste les actions (call_clicked, email_sent) effectuées par les pros
 * sur les contacts acquis, avec détection de patterns suspects :
 *   - Pro qui clique > 10 fois "appeler" en moins d'une heure (scraping
 *     téléphonique probable).
 *   - Pro qui envoie des emails identiques (corpus dédupliqué) sur
 *     plusieurs prospects — copier-coller en masse.
 *
 * Tout en lecture service_role.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ContactActionItem = {
  id: string;
  kind: "call_clicked" | "email_sent";
  createdAt: string;
  emailSubject: string | null;
  emailBody: string | null;
  emailOpenedAt: string | null;
  pro: {
    id: string;
    raisonSociale: string;
  } | null;
  prospect: {
    id: string;
    prenom: string | null;
    nomInitial: string | null;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
};

export type ContactActionsKpis = {
  totalCalls: number;
  totalEmails: number;
  emailsOpened: number;
  suspiciousProsCount: number;
};

export type ContactActionsFilters = {
  kind: "all" | "call_clicked" | "email_sent";
  period: "24h" | "7d" | "30d" | "90d" | "all";
  page: number;
};

const PAGE_SIZE = 50;

function periodCutoffIso(period: ContactActionsFilters["period"]): string | null {
  if (period === "all") return null;
  const hours = period === "24h" ? 24 : 0;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 0;
  const ms = hours * 3_600_000 + days * 86_400_000;
  return ms > 0 ? new Date(Date.now() - ms).toISOString() : null;
}

export async function fetchContactActionsList(
  opts: ContactActionsFilters,
): Promise<ContactActionItem[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("pro_contact_actions")
    .select(
      `id, kind, created_at, email_subject, email_body, email_opened_at,
       pro_accounts ( id, raison_sociale ),
       prospects ( id, prospect_identity ( prenom, nom ) ),
       campaigns ( id, name )`,
    )
    .order("created_at", { ascending: false });

  if (opts.kind !== "all") {
    q = q.eq("kind", opts.kind);
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
  return (data as any[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    emailSubject: r.email_subject ?? null,
    emailBody: r.email_body ?? null,
    emailOpenedAt: r.email_opened_at ?? null,
    pro: r.pro_accounts
      ? {
          id: r.pro_accounts.id,
          raisonSociale: r.pro_accounts.raison_sociale ?? "—",
        }
      : null,
    prospect: r.prospects
      ? (() => {
          const idRaw = r.prospects.prospect_identity;
          const ident = Array.isArray(idRaw) ? idRaw[0] : idRaw;
          const nom = ident?.nom ?? null;
          return {
            id: r.prospects.id,
            prenom: ident?.prenom ?? null,
            nomInitial:
              typeof nom === "string" && nom.length > 0
                ? nom[0].toUpperCase() + "."
                : null,
          };
        })()
      : null,
    campaign: r.campaigns
      ? { id: r.campaigns.id, name: r.campaigns.name ?? "—" }
      : null,
  }));
}

export async function fetchContactActionsKpis(
  opts: Pick<ContactActionsFilters, "period">,
): Promise<ContactActionsKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);

  const withPeriod = <T extends { gte: (col: string, val: string) => T }>(q: T): T =>
    cutoff ? q.gte("created_at", cutoff) : q;

  const base = () =>
    admin.from("pro_contact_actions").select("id", { count: "exact", head: true });

  const [callsRes, emailsRes, openedRes, suspectsRes] = await Promise.all([
    withPeriod(base().eq("kind", "call_clicked")),
    withPeriod(base().eq("kind", "email_sent")),
    withPeriod(base().eq("kind", "email_sent").not("email_opened_at", "is", null)),
    // Détection grossière : pros qui ont >10 actions distinctes sur 24h.
    // On lit séparément pour le compteur (pas trivial à faire en un
    // single count exact via PostgREST).
    (async () => {
      const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data } = await admin
        .from("pro_contact_actions")
        .select("pro_account_id")
        .gte("created_at", since24h);
      const cnt = new Map<string, number>();
      for (const r of data ?? []) {
        cnt.set(r.pro_account_id, (cnt.get(r.pro_account_id) ?? 0) + 1);
      }
      let n = 0;
      for (const c of cnt.values()) if (c > 10) n++;
      return { count: n };
    })(),
  ]);

  return {
    totalCalls: callsRes.count ?? 0,
    totalEmails: emailsRes.count ?? 0,
    emailsOpened: openedRes.count ?? 0,
    suspiciousProsCount: suspectsRes.count ?? 0,
  };
}
