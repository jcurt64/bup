/**
 * Watermark cryptographique des emails révélés au pro.
 *
 * Au lieu de révéler le vrai email du prospect, on génère un alias unique
 * `prospect+r{slug}@buupp.com` rattaché à la `relation_id`. Tous les mails
 * envoyés à cet alias sont routés vers le vrai email du prospect par un
 * Cloudflare Email Worker (cf. cloudflare-workers/relation-email-router).
 *
 * Si un mail venant d'une autre source que l'alias BUUPP arrive chez le
 * prospect, on remonte instantanément au pro émetteur via la relation —
 * sans avoir à recouper l'audit log `pro_contact_reveals`.
 *
 * `INBOUND_DOMAIN` (par défaut `buupp.com`) : domaine MX géré par Cloudflare
 * Email Routing.
 */

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const INBOUND_DOMAIN = process.env.BUUPP_INBOUND_DOMAIN ?? "buupp.com";
const SLUG_BYTES = 6; // 6 bytes = 12 hex chars = 48 bits d'entropie

function generateSlug(): string {
  return crypto.randomBytes(SLUG_BYTES).toString("hex");
}

export function buildAliasAddress(aliasShort: string): string {
  return `prospect+r${aliasShort}@${INBOUND_DOMAIN}`;
}

/**
 * Récupère l'alias existant pour la relation, ou en crée un nouveau.
 *
 * Idempotent : la contrainte UNIQUE sur `relation_id` garantit qu'on ne
 * peut pas créer deux alias pour la même relation, même en cas de race.
 * En cas de collision sur le slug random (extrêmement rare avec 48 bits),
 * on retente jusqu'à 3 fois avec un nouveau slug.
 */
export async function getOrCreateRelationAlias(
  admin: SupabaseClient<Database>,
  relationId: string,
): Promise<string> {
  const { data: existing, error: readErr } = await admin
    .from("relation_email_aliases")
    .select("alias_short")
    .eq("relation_id", relationId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`relation_email_aliases read failed: ${readErr.message}`);
  }
  if (existing) {
    return existing.alias_short;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    const { error: insertErr } = await admin
      .from("relation_email_aliases")
      .insert({ alias_short: slug, relation_id: relationId });

    if (!insertErr) {
      return slug;
    }
    // 23505 = unique violation. Si c'est la contrainte sur `relation_id`,
    // un autre process l'a créé en parallèle — on relit. Si c'est sur
    // `alias_short`, on retente avec un nouveau slug.
    if (insertErr.code === "23505") {
      const { data: again } = await admin
        .from("relation_email_aliases")
        .select("alias_short")
        .eq("relation_id", relationId)
        .maybeSingle();
      if (again) return again.alias_short;
      // sinon collision pure sur le slug → on retente
      continue;
    }
    throw new Error(`relation_email_aliases insert failed: ${insertErr.message}`);
  }

  throw new Error("relation_email_aliases: could not generate unique alias after 3 attempts");
}

/**
 * Inverse : à partir d'un slug reçu par le Cloudflare Worker, retourne
 * la relation et le vrai email du prospect. Renvoie `null` si l'alias
 * n'existe pas, est révoqué (`revoked_at != null`), ou si le prospect
 * n'a pas d'email renseigné.
 */
export async function resolveAlias(
  admin: SupabaseClient<Database>,
  aliasShort: string,
): Promise<{ relationId: string; prospectEmail: string } | null> {
  const { data, error } = await admin
    .from("relation_email_aliases")
    .select(
      `relation_id,
       relations:relation_id (
         prospects:prospect_id (
           prospect_identity ( email )
         )
       )`,
    )
    .eq("alias_short", aliasShort)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  type IdentRow = { email: string | null };
  type Row = {
    relation_id: string;
    relations: {
      prospects: {
        prospect_identity: IdentRow | IdentRow[] | null;
      } | null;
    } | null;
  };
  const row = data as unknown as Row;
  const prospects = row.relations?.prospects ?? null;
  const identRaw = prospects?.prospect_identity ?? null;
  const ident = Array.isArray(identRaw) ? identRaw[0] ?? null : identRaw;
  const email = ident?.email ?? null;
  if (!email) return null;

  return { relationId: row.relation_id, prospectEmail: email };
}
