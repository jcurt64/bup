/**
 * Accès données du module Tests & Études (service_role uniquement).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clerkClient } from "@/lib/clerk/server";
import { departmentFromPostalCode } from "./department";
import { studyBadge } from "./status";
import { PAID_MENTION, STUDY_TYPE_LABELS, type StudyType } from "./constants";

type Admin = SupabaseClient<Database>;
export type StudyRow = Database["public"]["Tables"]["study_campaigns"]["Row"];

/** Colonnes publiques — jamais external_url / address (réservés aux participants confirmés). */
const PUBLIC_COLS =
  "id, type, title, description, estimated_minutes, reward_cents, min_participants, max_participants, scope, department, signup_deadline, completion_deadline, status, published_at, pro_account_id";

export type PublicStudy = {
  id: string;
  type: StudyType;
  typeLabel: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  rewardCents: number;
  min: number;
  max: number;
  joinedCount: number;
  remainingPlaces: number;
  zone: string;
  scope: string;
  department: string | null;
  signupDeadline: string;
  completionDeadline: string;
  status: string;
  badge: { key: string; label: string };
  proName: string;
  paidMention: string;
};

export async function countJoined(admin: Admin, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>(ids.map((id) => [id, 0]));
  if (!ids.length) return out;
  const { data } = await admin
    .from("study_participations")
    .select("campaign_id")
    .in("campaign_id", ids);
  for (const r of data ?? []) out.set(r.campaign_id, (out.get(r.campaign_id) ?? 0) + 1);
  return out;
}

async function proNames(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await admin.from("pro_accounts").select("id, raison_sociale").in("id", [...new Set(ids)]);
  for (const r of data ?? []) out.set(r.id, r.raison_sociale?.trim() || "Un professionnel");
  return out;
}

function toPublic(r: Pick<StudyRow, "id" | "type" | "title" | "description" | "estimated_minutes" | "reward_cents" | "min_participants" | "max_participants" | "scope" | "department" | "signup_deadline" | "completion_deadline" | "status" | "pro_account_id">, joined: number, proName: string): PublicStudy {
  return {
    id: r.id,
    type: r.type as StudyType,
    typeLabel: STUDY_TYPE_LABELS[r.type as StudyType] ?? r.type,
    title: r.title,
    description: r.description,
    estimatedMinutes: r.estimated_minutes,
    rewardCents: Number(r.reward_cents),
    min: r.min_participants,
    max: r.max_participants,
    joinedCount: joined,
    remainingPlaces: Math.max(0, r.max_participants - joined),
    zone: r.scope === "national" ? "France entière" : `Département ${r.department}`,
    scope: r.scope,
    department: r.department,
    signupDeadline: r.signup_deadline,
    completionDeadline: r.completion_deadline,
    status: r.status,
    badge: studyBadge({ status: r.status, joinedCount: joined, min: r.min_participants, max: r.max_participants }),
    proName,
    paidMention: PAID_MENTION,
  };
}

export type StudyFilters = {
  department?: string | null;
  type?: string | null;
  minRewardCents?: number | null;
  deadlineBefore?: string | null;
};

/** Liste publique : campagnes publiées dont les inscriptions sont ouvertes (+ validées récentes). */
export async function listPublicStudies(admin: Admin, f: StudyFilters = {}, limit = 60): Promise<PublicStudy[]> {
  let q = admin
    .from("study_campaigns")
    .select(PUBLIC_COLS)
    .in("status", ["published", "validated"])
    .gt("completion_deadline", new Date().toISOString())
    .order("signup_deadline", { ascending: true })
    .limit(limit);
  if (f.type) q = q.eq("type", f.type);
  if (f.minRewardCents) q = q.gte("reward_cents", f.minRewardCents);
  if (f.deadlineBefore) q = q.lte("signup_deadline", f.deadlineBefore);
  if (f.department) q = q.or(`scope.eq.national,department.eq.${f.department.replace(/[^0-9AB]/gi, "")}`);
  const { data } = await q;
  const rows = data ?? [];
  const [counts, names] = await Promise.all([
    countJoined(admin, rows.map((r) => r.id)),
    proNames(admin, rows.map((r) => r.pro_account_id)),
  ]);
  return rows.map((r) => toPublic(r, counts.get(r.id) ?? 0, names.get(r.pro_account_id) ?? "Un professionnel"));
}

export async function getPublicStudy(admin: Admin, id: string): Promise<PublicStudy | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin.from("study_campaigns").select(PUBLIC_COLS).eq("id", id).neq("status", "draft").maybeSingle();
  if (!data) return null;
  const [counts, names] = await Promise.all([countJoined(admin, [id]), proNames(admin, [data.pro_account_id])]);
  return toPublic(data, counts.get(id) ?? 0, names.get(data.pro_account_id) ?? "Un professionnel");
}

export type ProspectCtx = {
  prospectId: string;
  prenom: string | null;
  email: string | null;
  department: string | null;
};

export async function prospectContext(admin: Admin, clerkUserId: string): Promise<ProspectCtx | null> {
  const { data: p } = await admin.from("prospects").select("id").eq("clerk_user_id", clerkUserId).maybeSingle();
  if (!p) return null;
  const [{ data: ident }, { data: loc }] = await Promise.all([
    admin.from("prospect_identity").select("prenom, email").eq("prospect_id", p.id).maybeSingle(),
    admin.from("prospect_localisation").select("code_postal").eq("prospect_id", p.id).maybeSingle(),
  ]);
  return {
    prospectId: p.id,
    prenom: ident?.prenom?.trim() || null,
    email: ident?.email?.trim() || null,
    department: departmentFromPostalCode(loc?.code_postal ?? null),
  };
}

export async function proAccountIdFor(admin: Admin, clerkUserId: string): Promise<string | null> {
  const { data } = await admin.from("pro_accounts").select("id").eq("clerk_user_id", clerkUserId).maybeSingle();
  return data?.id ?? null;
}

/** E-mail du pro (pas stocké en base : lu chez Clerk). */
export async function proEmail(admin: Admin, proAccountId: string): Promise<string | null> {
  const { data } = await admin.from("pro_accounts").select("clerk_user_id").eq("id", proAccountId).maybeSingle();
  if (!data?.clerk_user_id) return null;
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(data.clerk_user_id);
    return u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? null;
  } catch {
    return null;
  }
}

/** Identités (prénom + e-mail) d'une liste de prospects. */
export async function prospectIdentities(admin: Admin, ids: string[]): Promise<Map<string, { prenom: string | null; email: string | null }>> {
  const out = new Map<string, { prenom: string | null; email: string | null }>();
  if (!ids.length) return out;
  const { data } = await admin.from("prospect_identity").select("prospect_id, prenom, email").in("prospect_id", [...new Set(ids)]);
  for (const r of data ?? []) out.set(r.prospect_id, { prenom: r.prenom?.trim() || null, email: r.email?.trim() || null });
  return out;
}
