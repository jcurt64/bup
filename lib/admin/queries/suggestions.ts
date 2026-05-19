/**
 * Queries pour la page admin `/buupp-admin/suggestions`.
 *
 * - fetchSuggestionsList : liste filtrée (statut, période) + pagination.
 * - fetchSuggestionsKpis : non lues / résolues / total période / e-mail
 *   échoué.
 *
 * Lecture pure Supabase service_role. Pattern calqué sur
 * lib/admin/queries/reports.ts. Les types Supabase générés ne
 * contiennent pas encore `suggestions` (migration manuelle) → cast any.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SuggestionStatus = "unread" | "resolved" | "all";
export type SuggestionPeriod = "7d" | "30d" | "90d" | "all";

export type SuggestionListItem = {
  id: string;
  fromEmail: string | null;
  fromName: string | null;
  fromRole: string | null;
  subject: string | null;
  message: string;
  emailSentAt: string | null;
  readAt: string | null;
  readByClerkId: string | null;
  resolvedAt: string | null;
  resolvedByClerkId: string | null;
  resolvedNote: string | null;
  createdAt: string;
};

export type SuggestionsKpis = {
  unread: number;
  resolved: number;
  totalPeriod: number;
  emailFailed: number;
};

function periodCutoffIso(period: SuggestionPeriod): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE_SIZE = 50;

export async function fetchSuggestionsList(opts: {
  status: SuggestionStatus;
  period: SuggestionPeriod;
  page: number;
}): Promise<SuggestionListItem[]> {
  // Les types Supabase générés ne contiennent pas la table `suggestions`
  // (migration manuelle, types non régénérés). Cast volontaire — même
  // esprit que le `as any[]` sur les rows plus bas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createSupabaseAdminClient() as any;
  let q = admin
    .from("suggestions")
    .select(
      `id, from_email, from_name, from_role, subject, message,
       email_sent_at, email_message_id,
       read_at, read_by_clerk_id,
       resolved_at, resolved_by_clerk_id, resolved_note, created_at`,
    )
    .order("created_at", { ascending: false });

  if (opts.status === "unread") {
    q = q.is("read_at", null);
  } else if (opts.status === "resolved") {
    q = q.not("resolved_at", "is", null);
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
    fromEmail: r.from_email ?? null,
    fromName: r.from_name ?? null,
    fromRole: r.from_role ?? null,
    subject: r.subject ?? null,
    message: r.message ?? "",
    emailSentAt: r.email_sent_at ?? null,
    readAt: r.read_at ?? null,
    readByClerkId: r.read_by_clerk_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    resolvedByClerkId: r.resolved_by_clerk_id ?? null,
    resolvedNote: r.resolved_note ?? null,
    createdAt: r.created_at,
  }));
}

export async function fetchSuggestionsKpis(opts: {
  period: SuggestionPeriod;
}): Promise<SuggestionsKpis> {
  // Les types Supabase générés ne contiennent pas la table `suggestions`
  // (migration manuelle, types non régénérés). Cast volontaire — même
  // esprit que le `as any[]` sur les rows plus bas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createSupabaseAdminClient() as any;
  const cutoff = periodCutoffIso(opts.period);

  const withPeriod = <T extends { gte: (col: string, val: string) => T }>(
    q: T,
  ): T => (cutoff ? q.gte("created_at", cutoff) : q);

  const baseQuery = () =>
    admin.from("suggestions").select("id", { count: "exact", head: true });

  const [unreadRes, resolvedRes, totalRes, failedRes] = await Promise.all([
    withPeriod(baseQuery().is("read_at", null)),
    withPeriod(baseQuery().not("resolved_at", "is", null)),
    withPeriod(baseQuery()),
    withPeriod(baseQuery().is("email_sent_at", null)),
  ]);

  return {
    unread: unreadRes.count ?? 0,
    resolved: resolvedRes.count ?? 0,
    totalPeriod: totalRes.count ?? 0,
    emailFailed: failedRes.count ?? 0,
  };
}
